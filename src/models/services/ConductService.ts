import { supabase } from '@/config/supabase';
import { CONDUCT_FLAG_THRESHOLD, CONDUCT_WINDOW_DAYS } from '@/config/constants';
import { DriverViolation, ViolationStatus } from '@/models/entities/Association';
import { fetchAllRows } from '@/utils/supabaseUtils';

/** Statuses the admin has confirmed as real violations; these are counted. */
export const COUNTED_VIOLATION_STATUSES: ViolationStatus[] = ['confirmed', 'resolved'];

export interface InvalidCancellation {
  id: string;
  passenger_id: string;
  cancellation_reason: string | null;
  cancelled_at: string;
}

export interface ConductSummary {
  userId: string;
  /** Confirmed/resolved violations with an incident date inside the window. */
  confirmedViolations: number;
  /** Passenger cancellations the server marked as having no valid reason. */
  invalidCancellations: number;
  /** Three confirmed violations within the window: needs admin review. */
  flagged: boolean;
  /** Three invalid cancellations within the window: needs admin review. */
  repeatedCancellations: boolean;
}

/**
 * Penalty already given to an account (migration 091). Suspended and
 * deactivated accounts are never flagged; after a penalty only what comes
 * later counts toward a new flag.
 */
export interface ConductPenalty {
  status?: string | null;
  conduct_action_at?: string | null;
}

const PENALIZED_STATUSES = ['suspended', 'deactivated'];

type CountedViolation = Pick<DriverViolation, 'driver_id' | 'passenger_id' | 'status' | 'incident_date'> & {
  created_at?: string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Local midnight of the first day of the rolling window that ends today. */
export const conductWindowStart = (now: Date = new Date()): Date => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (CONDUCT_WINDOW_DAYS - 1));
  return start;
};

const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Pure tally so the screens and tests share one definition of "flagged". */
export const summarizeConduct = (
  violations: CountedViolation[],
  cancellations: Pick<InvalidCancellation, 'passenger_id' | 'cancelled_at'>[],
  now: Date = new Date(),
  penalties: Map<string, ConductPenalty> = new Map()
): Map<string, ConductSummary> => {
  const start = conductWindowStart(now);
  const startKey = toDateKey(start);
  // 091: once penalized, only records made after the penalty count again.
  const penaltyAt = (userId: string) => {
    const at = penalties.get(userId)?.conduct_action_at;
    return at ? new Date(at).getTime() : null;
  };
  const afterPenalty = (userId: string, when?: string | null) => {
    const at = penaltyAt(userId);
    return at === null || (!!when && new Date(when).getTime() > at);
  };
  const summaries = new Map<string, ConductSummary>();
  const entry = (userId: string) => {
    let s = summaries.get(userId);
    if (!s) {
      s = { userId, confirmedViolations: 0, invalidCancellations: 0, flagged: false, repeatedCancellations: false };
      summaries.set(userId, s);
    }
    return s;
  };

  violations.forEach((v) => {
    const userId = v.driver_id || v.passenger_id;
    if (!userId || !COUNTED_VIOLATION_STATUSES.includes(v.status)) return;
    if (String(v.incident_date).slice(0, 10) < startKey) return;
    if (!afterPenalty(userId, v.created_at)) return;
    entry(userId).confirmedViolations += 1;
  });
  cancellations.forEach((c) => {
    if (new Date(c.cancelled_at).getTime() < start.getTime()) return;
    if (!afterPenalty(c.passenger_id, c.cancelled_at)) return;
    entry(c.passenger_id).invalidCancellations += 1;
  });

  summaries.forEach((s) => {
    const penalized = PENALIZED_STATUSES.includes(penalties.get(s.userId)?.status ?? '');
    s.flagged = !penalized && s.confirmedViolations >= CONDUCT_FLAG_THRESHOLD;
    s.repeatedCancellations = !penalized && s.invalidCancellations >= CONDUCT_FLAG_THRESHOLD;
  });
  return summaries;
};

export class ConductService {
  /** Admin view: every user's tally for the current window. */
  async getWeeklySummaries(): Promise<{
    summaries: Map<string, ConductSummary>;
    cancellations: InvalidCancellation[];
  }> {
    const start = conductWindowStart();
    const [violations, cancellations, penalties] = await Promise.all([
      this.countedViolationsSince(start),
      this.invalidCancellationsSince(start),
      this.penalties(),
    ]);
    return { summaries: summarizeConduct(violations, cancellations, new Date(), penalties), cancellations };
  }

  /** The signed-in user's own records (RLS limits both queries to them). */
  async getMyConduct(userId: string, role: 'driver' | 'passenger'): Promise<{
    violations: DriverViolation[];
    summary: ConductSummary;
  }> {
    const start = conductWindowStart();
    const [{ data, error }, cancellations, penalties] = await Promise.all([
      supabase
        .from('driver_violations')
        .select('*')
        .eq(role === 'driver' ? 'driver_id' : 'passenger_id', userId)
        .order('incident_date', { ascending: false }),
      role === 'passenger' ? this.invalidCancellationsSince(start, userId) : Promise.resolve([]),
      this.penalties(userId),
    ]);
    if (error) throw error;
    const violations = (data ?? []) as DriverViolation[];
    const summary = summarizeConduct(violations, cancellations, new Date(), penalties).get(userId) ?? {
      userId, confirmedViolations: 0, invalidCancellations: 0, flagged: false, repeatedCancellations: false,
    };
    return { violations, summary };
  }

  private async countedViolationsSince(start: Date) {
    const { data, error } = await supabase
      .from('driver_violations')
      .select('driver_id, passenger_id, status, incident_date, created_at')
      .in('status', COUNTED_VIOLATION_STATUSES)
      .gte('incident_date', toDateKey(start));
    if (error) throw error;
    return (data ?? []) as CountedViolation[];
  }

  /**
   * Accounts that already received a penalty (one user, or every penalized
   * account). Before migration 091 only the suspended / deactivated status is
   * known, so a warning does not close the flag until 091 is applied.
   */
  private async penalties(userId?: string): Promise<Map<string, ConductPenalty>> {
    type Row = { id: string } & ConductPenalty;
    const read = (cols: string, filter: (query: any) => any) =>
      fetchAllRows<Row>(() => {
        const query = supabase.from('users').select(cols).order('id');
        return userId ? query.eq('id', userId) : filter(query);
      });
    const merged = new Map<string, Row>();
    const add = (rows: Row[]) => rows.forEach((r) => merged.set(r.id, { ...merged.get(r.id), ...r }));
    try {
      add(await read('id, status', (q) => q.in('status', PENALIZED_STATUSES)));
      add(await read('id, status, conduct_action_at', (q) => q.not('conduct_action_at', 'is', null)));
    } catch (e) {
      // Before 091 the stamp column is missing; the tally is advisory, so it
      // still loads with whatever was read.
      console.warn('conduct penalties unavailable:', e);
    }
    return merged;
  }

  private async invalidCancellationsSince(start: Date, passengerId?: string): Promise<InvalidCancellation[]> {
    let query = supabase
      .from('bookings')
      .select('id, passenger_id, cancellation_reason, cancelled_at')
      .eq('status', 'cancelled')
      .eq('cancelled_by', 'passenger')
      .eq('cancellation_valid', false)
      .gte('cancelled_at', start.toISOString())
      .order('cancelled_at', { ascending: false });
    if (passengerId) query = query.eq('passenger_id', passengerId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as InvalidCancellation[];
  }
}

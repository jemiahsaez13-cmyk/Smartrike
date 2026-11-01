import { supabase } from '@/config/supabase';
import { CONDUCT_FLAG_THRESHOLD, CONDUCT_WINDOW_DAYS } from '@/config/constants';
import { DriverViolation, ViolationStatus } from '@/models/entities/Association';

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
  violations: Pick<DriverViolation, 'driver_id' | 'passenger_id' | 'status' | 'incident_date'>[],
  cancellations: Pick<InvalidCancellation, 'passenger_id' | 'cancelled_at'>[],
  now: Date = new Date()
): Map<string, ConductSummary> => {
  const start = conductWindowStart(now);
  const startKey = toDateKey(start);
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
    entry(userId).confirmedViolations += 1;
  });
  cancellations.forEach((c) => {
    if (new Date(c.cancelled_at).getTime() < start.getTime()) return;
    entry(c.passenger_id).invalidCancellations += 1;
  });

  summaries.forEach((s) => {
    s.flagged = s.confirmedViolations >= CONDUCT_FLAG_THRESHOLD;
    s.repeatedCancellations = s.invalidCancellations >= CONDUCT_FLAG_THRESHOLD;
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
    const [violations, cancellations] = await Promise.all([
      this.countedViolationsSince(start),
      this.invalidCancellationsSince(start),
    ]);
    return { summaries: summarizeConduct(violations, cancellations), cancellations };
  }

  /** The signed-in user's own records (RLS limits both queries to them). */
  async getMyConduct(userId: string, role: 'driver' | 'passenger'): Promise<{
    violations: DriverViolation[];
    summary: ConductSummary;
  }> {
    const start = conductWindowStart();
    const [{ data, error }, cancellations] = await Promise.all([
      supabase
        .from('driver_violations')
        .select('*')
        .eq(role === 'driver' ? 'driver_id' : 'passenger_id', userId)
        .order('incident_date', { ascending: false }),
      role === 'passenger' ? this.invalidCancellationsSince(start, userId) : Promise.resolve([]),
    ]);
    if (error) throw error;
    const violations = (data ?? []) as DriverViolation[];
    const summary = summarizeConduct(violations, cancellations).get(userId) ?? {
      userId, confirmedViolations: 0, invalidCancellations: 0, flagged: false, repeatedCancellations: false,
    };
    return { violations, summary };
  }

  private async countedViolationsSince(start: Date) {
    const { data, error } = await supabase
      .from('driver_violations')
      .select('driver_id, passenger_id, status, incident_date')
      .in('status', COUNTED_VIOLATION_STATUSES)
      .gte('incident_date', toDateKey(start));
    if (error) throw error;
    return (data ?? []) as Pick<DriverViolation, 'driver_id' | 'passenger_id' | 'status' | 'incident_date'>[];
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

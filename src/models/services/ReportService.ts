import { supabase } from '@/config/supabase';

export interface FileReportPayload {
  bookingId?: string | null;
  reporterId: string;
  reportedId: string;
  reporterRole: 'passenger' | 'driver';
  reason: string;
  details?: string;
}

/** Reasons a driver can flag a passenger with. */
export const DRIVER_REPORT_REASONS = [
  'No-show at pickup',
  'Rude or abusive behavior',
  'Unsafe conduct',
  'Refused to pay the fare',
  'Fake / prank booking',
  'Other',
] as const;

export type ReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned';

export interface ReportRow {
  id: string;
  booking_id: string | null;
  reporter_id: string;
  reported_id: string;
  reporter_role: 'passenger' | 'driver';
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  reporterName?: string;
  reportedName?: string;
}

export class ReportService {
  // Plain insert (no .select()) so the row need not be read back — the reporter
  // can SELECT it under RLS anyway, but keeping it minimal avoids a round-trip.
  async fileReport(p: FileReportPayload): Promise<void> {
    if (!p.reason?.trim()) throw new Error('Please choose a reason.');
    const { error } = await supabase.from('reports').insert({
      booking_id: p.bookingId ?? null,
      reporter_id: p.reporterId,
      reported_id: p.reportedId,
      reporter_role: p.reporterRole,
      reason: p.reason,
      details: p.details?.trim() || null,
    });
    if (error) throw error;
  }

  // Admin: list every report (RLS lets only admins read all) with the
  // reporter/reported names resolved in one batch.
  async listReports(): Promise<ReportRow[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const rows = (data ?? []) as ReportRow[];
    const ids = Array.from(new Set(rows.flatMap((r) => [r.reporter_id, r.reported_id]).filter(Boolean)));
    if (ids.length) {
      const { data: users } = await supabase.from('users').select('id, name').in('id', ids);
      const nameById = new Map<string, string>((users ?? []).map((u: any) => [u.id, u.name as string]));
      rows.forEach((r) => {
        r.reporterName = nameById.get(r.reporter_id) ?? 'User';
        r.reportedName = nameById.get(r.reported_id) ?? 'User';
      });
    }
    return rows;
  }

  // Admin: change a report's status (reviewed / dismissed / actioned).
  async setStatus(id: string, status: ReportStatus): Promise<void> {
    const { error } = await supabase.from('reports').update({ status }).eq('id', id);
    if (error) throw error;
  }
}

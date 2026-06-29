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
}

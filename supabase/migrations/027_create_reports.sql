-- =============================================================================
-- 027_create_reports.sql
--
-- User reports: a driver can report a passenger (and vice-versa) for a booking.
-- Reporter files + sees their own reports; admins see/manage everything.
--
-- Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reporter_role VARCHAR(20) NOT NULL CHECK (reporter_role IN ('passenger', 'driver')),
  reason VARCHAR(80) NOT NULL,
  details TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reported_id ON public.reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users file own reports" ON public.reports;
CREATE POLICY "Users file own reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users view own filed reports" ON public.reports;
CREATE POLICY "Users view own filed reports" ON public.reports
  FOR SELECT TO authenticated
  USING (reporter_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Admins manage all reports" ON public.reports;
CREATE POLICY "Admins manage all reports" ON public.reports
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

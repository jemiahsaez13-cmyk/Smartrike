-- One source report per violation; retain the violation if the report is removed.
ALTER TABLE public.driver_violations
  ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS driver_violations_report_id_key
  ON public.driver_violations(report_id) WHERE report_id IS NOT NULL;

-- Lock the report so retries/concurrent reviews cannot create duplicate records.
-- Both writes succeed together or roll back together.
CREATE OR REPLACE FUNCTION public.record_report_violation(p_report_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  source_report public.reports%ROWTYPE;
  violation_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator permission required.';
  END IF;
  SELECT * INTO source_report FROM public.reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found.'; END IF;
  SELECT id INTO violation_id FROM public.driver_violations WHERE report_id = p_report_id;
  IF violation_id IS NOT NULL THEN
    UPDATE public.reports SET status = 'actioned' WHERE id = p_report_id;
    RETURN violation_id;
  END IF;
  IF source_report.status NOT IN ('open', 'reviewed') THEN
    RAISE EXCEPTION 'Reopen the report before recording a violation.';
  END IF;
  IF source_report.reporter_role <> 'passenger' OR NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = source_report.reported_id AND user_type = 'driver'
  ) THEN RAISE EXCEPTION 'Only reports against drivers can become driver violations.'; END IF;
  INSERT INTO public.driver_violations
    (driver_id, report_id, violation_type, description, incident_date, status, created_by)
  VALUES (source_report.reported_id, source_report.id, source_report.reason,
    source_report.details, source_report.created_at::date, 'open', public.current_app_user_id())
  RETURNING id INTO violation_id;
  UPDATE public.reports SET status = 'actioned' WHERE id = p_report_id;
  RETURN violation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_report_violation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_report_violation(UUID) TO authenticated;

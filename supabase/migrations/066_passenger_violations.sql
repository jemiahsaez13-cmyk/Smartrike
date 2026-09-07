-- Extend existing records without changing driver IDs or driver-only queries.
ALTER TABLE public.driver_violations ALTER COLUMN driver_id DROP NOT NULL;
ALTER TABLE public.driver_violations
  ADD COLUMN IF NOT EXISTS passenger_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.driver_violations DROP CONSTRAINT IF EXISTS violation_exactly_one_subject;
ALTER TABLE public.driver_violations ADD CONSTRAINT violation_exactly_one_subject
  CHECK ((driver_id IS NOT NULL) <> (passenger_id IS NOT NULL));
ALTER TABLE public.driver_violations DROP CONSTRAINT IF EXISTS passenger_violation_no_franchise;
ALTER TABLE public.driver_violations ADD CONSTRAINT passenger_violation_no_franchise
  CHECK (passenger_id IS NULL OR franchise_id IS NULL);
CREATE INDEX IF NOT EXISTS passenger_violations_date_idx
  ON public.driver_violations(passenger_id, incident_date DESC) WHERE passenger_id IS NOT NULL;

-- Enforce role matching for both manual records and report conversions.
CREATE OR REPLACE FUNCTION public.validate_violation_subject()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  subject_id UUID := COALESCE(NEW.driver_id, NEW.passenger_id);
  subject_role TEXT := CASE WHEN NEW.driver_id IS NOT NULL THEN 'driver' ELSE 'passenger' END;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = subject_id AND user_type = subject_role) THEN
    RAISE EXCEPTION 'Selected user does not match the violation role.';
  END IF;
  IF NEW.report_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.reports WHERE id = NEW.report_id AND reported_id = subject_id
  ) THEN RAISE EXCEPTION 'Violation must reference the reported user.'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_violation_subject ON public.driver_violations;
CREATE TRIGGER validate_violation_subject BEFORE INSERT OR UPDATE OF driver_id, passenger_id, report_id
  ON public.driver_violations FOR EACH ROW EXECUTE FUNCTION public.validate_violation_subject();

CREATE OR REPLACE FUNCTION public.record_report_violation(p_report_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  source_report public.reports%ROWTYPE;
  violation_id UUID;
  subject_role TEXT;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Administrator permission required.'; END IF;
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
  SELECT user_type INTO subject_role FROM public.users WHERE id = source_report.reported_id;
  IF subject_role NOT IN ('driver', 'passenger') OR subject_role IS NULL
    OR subject_role = source_report.reporter_role THEN
    RAISE EXCEPTION 'Report must target a driver or passenger of the opposite role.';
  END IF;
  INSERT INTO public.driver_violations
    (driver_id, passenger_id, report_id, violation_type, description, incident_date, status, created_by)
  VALUES (
    CASE WHEN subject_role = 'driver' THEN source_report.reported_id END,
    CASE WHEN subject_role = 'passenger' THEN source_report.reported_id END,
    source_report.id, source_report.reason, source_report.details,
    COALESCE(source_report.created_at::date, CURRENT_DATE), 'open', public.current_app_user_id()
  ) RETURNING id INTO violation_id;
  UPDATE public.reports SET status = 'actioned' WHERE id = p_report_id;
  RETURN violation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_report_violation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_report_violation(UUID) TO authenticated;
-- Existing admin management and driver-own-row RLS remain unchanged. Passenger
-- records are admin-managed and never visible through the driver-own-row policy.

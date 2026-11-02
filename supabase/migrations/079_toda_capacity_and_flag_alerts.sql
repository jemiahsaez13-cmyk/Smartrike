-- =============================================================================
-- 079 · TODA approved unit capacity, admin alerts for flagged accounts
-- -----------------------------------------------------------------------------
--  1. toda_associations.approved_units: number of tricycle units the TODA is
--     authorised to operate (NULL = not set). The app compares it with the
--     units holding an issued MTOP and warns when the TODA is full. Blocking
--     issuance at capacity comes later with body-number slots (B5).
--  2. Admins are notified the moment an account becomes flagged, so they no
--     longer have to open the Violations screen to notice:
--       · a driver/passenger reaches 3 confirmed violations in the rolling
--         7 days (today + 6 days before, Philippine time), or
--       · a passenger reaches 3 cancellations without a valid reason in the
--         same window.
--     It fires once, when the count reaches the threshold, not on every later
--     violation. Must match CONDUCT_FLAG_THRESHOLD / CONDUCT_WINDOW_DAYS in
--     src/config/constants.ts.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Approved unit capacity ───────────────────────────────────────────────
ALTER TABLE public.toda_associations
  ADD COLUMN IF NOT EXISTS approved_units INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.toda_associations'::regclass
       AND conname = 'toda_associations_approved_units_check'
  ) THEN
    ALTER TABLE public.toda_associations
      ADD CONSTRAINT toda_associations_approved_units_check
      CHECK (approved_units IS NULL OR (approved_units >= 0 AND approved_units <= 10000));
  END IF;
END;
$$;

COMMENT ON COLUMN public.toda_associations.approved_units IS
  'Tricycle units the TODA is authorised to operate. NULL = not set.';

-- ── 2. Flag alerts ──────────────────────────────────────────────────────────
-- First day of the rolling window, in Philippine time (matches the app).
CREATE OR REPLACE FUNCTION public.conduct_window_start_date()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (NOW() AT TIME ZONE 'Asia/Manila')::date - 6;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins(p_title TEXT, p_body TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, type, title, body, read)
  SELECT u.id, 'system_alert', p_title, p_body, FALSE
    FROM public.users u
   WHERE u.user_type = 'admin' AND u.status = 'active';
$$;
REVOKE ALL ON FUNCTION public.notify_admins(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admins(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.notify_admins(TEXT, TEXT) FROM authenticated;

-- 2a. Confirmed violations
CREATE OR REPLACE FUNCTION public.alert_flagged_violations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  UUID := COALESCE(NEW.driver_id, NEW.passenger_id);
  v_count INTEGER;
  v_name  TEXT;
  v_role  TEXT;
BEGIN
  -- Only when this row starts counting (newly confirmed, or recorded as such).
  IF v_user IS NULL OR NEW.status NOT IN ('confirmed', 'resolved') THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('confirmed', 'resolved') THEN RETURN NULL; END IF;
  IF NEW.incident_date < public.conduct_window_start_date() THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_count
    FROM public.driver_violations v
   WHERE COALESCE(v.driver_id, v.passenger_id) = v_user
     AND v.status IN ('confirmed', 'resolved')
     AND v.incident_date >= public.conduct_window_start_date();

  IF v_count <> 3 THEN RETURN NULL; END IF;

  SELECT name, user_type INTO v_name, v_role FROM public.users WHERE id = v_user;
  PERFORM public.notify_admins(
    'Account flagged for review',
    format('%s (%s) now has %s confirmed violations in the last 7 days. Review the records in Violations before imposing a restriction.',
      COALESCE(v_name, 'A user'), COALESCE(v_role, 'user'), v_count)
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS alert_flagged_violations_trigger ON public.driver_violations;
CREATE TRIGGER alert_flagged_violations_trigger
  AFTER INSERT OR UPDATE OF status ON public.driver_violations
  FOR EACH ROW EXECUTE FUNCTION public.alert_flagged_violations();

-- 2b. Cancellations without a valid reason (stamped by 077's BEFORE trigger)
CREATE OR REPLACE FUNCTION public.alert_repeated_cancellations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_name  TEXT;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled'
     OR NEW.cancelled_by IS DISTINCT FROM 'passenger'
     OR NEW.cancellation_valid IS DISTINCT FROM FALSE
     OR NEW.passenger_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.bookings b
   WHERE b.passenger_id = NEW.passenger_id
     AND b.status = 'cancelled'
     AND b.cancelled_by = 'passenger'
     AND b.cancellation_valid = FALSE
     AND b.cancelled_at >= (public.conduct_window_start_date()::timestamp AT TIME ZONE 'Asia/Manila');

  IF v_count <> 3 THEN RETURN NULL; END IF;

  SELECT name INTO v_name FROM public.users WHERE id = NEW.passenger_id;
  PERFORM public.notify_admins(
    'Passenger flagged: repeated cancellations',
    format('%s has cancelled %s bookings without a valid reason in the last 7 days. Review them in Violations → Needs admin review.',
      COALESCE(v_name, 'A passenger'), v_count)
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS alert_repeated_cancellations_trigger ON public.bookings;
CREATE TRIGGER alert_repeated_cancellations_trigger
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.alert_repeated_cancellations();

COMMIT;

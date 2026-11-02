-- =============================================================================
-- 084 · Driver sign-up without registration photos
-- -----------------------------------------------------------------------------
-- The license / plate / OR / CR photos are already required in the MTOP
-- application, and a driver cannot operate without an MTOP, so the separate
-- sign-up upload (078) is dropped from the app:
--   1. guard_driver_verification (078) no longer requires four approved photos
--      before an admin verifies a driver. Drivers still cannot change the
--      document summary themselves. MTOP approval keeps verifying (069).
--   2. The "driver documents to review" admin alert (083) is removed; the
--      new-driver alert points the admin to the MTOP application instead.
-- driver_documents and earlier uploads are kept (admins still see them on the
-- driver profile). Apply after 083. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Verification no longer waits for sign-up photos ──────────────────────
CREATE OR REPLACE FUNCTION public.guard_driver_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- The driver must never edit the summary; trusted functions run as owner.
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin()
     AND NEW.driver_documents_status IS DISTINCT FROM OLD.driver_documents_status THEN
    RAISE EXCEPTION 'Document status is set by the administrator review.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. Admin alerts ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS alert_admins_driver_documents_trigger ON public.users;
DROP FUNCTION IF EXISTS public.alert_admins_driver_documents();

CREATE OR REPLACE FUNCTION public.alert_admins_new_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_type = 'driver' THEN
    PERFORM public.notify_admins_event(
      'admin_new_driver',
      'New driver registered',
      format('%s signed up as a driver. They are verified once their MTOP application is approved.', COALESCE(NEW.name, NEW.email))
    );
  ELSIF NEW.user_type = 'passenger' THEN
    PERFORM public.notify_admins_event(
      'admin_new_passenger',
      'New passenger registered',
      format('%s created a passenger account.', COALESCE(NEW.name, NEW.email))
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

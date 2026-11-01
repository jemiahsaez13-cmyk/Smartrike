-- =============================================================================
-- 077 · Cancellation reasons, confirmed violations, permanent deactivation
-- -----------------------------------------------------------------------------
--  1. Bookings record who cancelled, why, and whether the reason is valid.
--     The server decides validity from the reason (the app's flag is never
--     trusted), and the details are locked once written. Only a passenger
--     cancellation can be invalid; system/admin cancellations are always valid.
--  2. Violations gain a 'confirmed' status: open → confirmed → resolved, or
--     open → dismissed. Confirmed and resolved violations count toward the
--     three-per-week admin review flag (computed in the app).
--  3. Passengers can read their own violation records (drivers already can).
--  4. Accounts can be permanently deactivated by an administrator through
--     admin_deactivate_user(). A deactivated account cannot be reactivated or
--     deleted from the app, so its rides, payments and violations are kept.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Booking cancellation details ─────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT
    CHECK (cancelled_by IN ('passenger', 'driver', 'system', 'admin')),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_valid BOOLEAN,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_invalid_cancellations
  ON public.bookings (passenger_id, cancelled_at DESC)
  WHERE status = 'cancelled' AND cancellation_valid = FALSE;

-- Mirrors CANCELLATION_REASONS in src/config/constants.ts.
CREATE OR REPLACE FUNCTION public.is_valid_cancellation_reason(
  p_reason TEXT,
  p_old_status TEXT,
  p_created_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    -- The app closes a search no driver answered (REQUEST_FRESHNESS_MINUTES
    -- = 20); one minute of slack covers a phone clock that runs ahead.
    WHEN p_reason = 'No driver accepted in time' THEN
      p_old_status = 'pending' AND p_created_at <= NOW() - INTERVAL '19 minutes'
    ELSE p_reason IN (
      'Driver is taking too long',
      'Driver asked me to cancel',
      'Emergency',
      'Wrong pickup or drop-off location'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_booking_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_me      UUID    := public.current_app_user_id();
  v_trusted BOOLEAN := current_user NOT IN ('authenticated', 'anon') OR public.is_admin();
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    NEW.cancelled_at := NOW();
    -- Trusted callers (admin, SECURITY DEFINER functions) may name the source.
    IF NOT v_trusted OR NEW.cancelled_by IS NULL THEN
      NEW.cancelled_by := CASE
        WHEN public.is_admin() THEN 'admin'
        WHEN current_user NOT IN ('authenticated', 'anon') THEN 'system'
        WHEN OLD.passenger_id = v_me THEN 'passenger'
        WHEN OLD.driver_id = v_me THEN 'driver'
        ELSE 'system'
      END;
    END IF;
    NEW.cancellation_reason := NULLIF(left(btrim(COALESCE(NEW.cancellation_reason, '')), 300), '');
    NEW.cancellation_valid := CASE
      WHEN NEW.cancelled_by = 'passenger'
        THEN COALESCE(public.is_valid_cancellation_reason(NEW.cancellation_reason, OLD.status, OLD.created_at), FALSE)
      ELSE TRUE
    END;
    RETURN NEW;
  END IF;

  IF NOT v_trusted
     AND ROW(NEW.cancelled_by, NEW.cancellation_reason, NEW.cancellation_valid, NEW.cancelled_at)
         IS DISTINCT FROM
         ROW(OLD.cancelled_by, OLD.cancellation_reason, OLD.cancellation_valid, OLD.cancelled_at) THEN
    RAISE EXCEPTION 'Cancellation details cannot be changed.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_booking_cancellation_trigger ON public.bookings;
CREATE TRIGGER stamp_booking_cancellation_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.stamp_booking_cancellation();

-- ── 2. Violation status: + confirmed ────────────────────────────────────────
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.driver_violations'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%open%dismissed%'
  LOOP
    EXECUTE format('ALTER TABLE public.driver_violations DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.driver_violations ADD CONSTRAINT driver_violations_status_check
  CHECK (status IN ('open', 'confirmed', 'resolved', 'dismissed'));

CREATE INDEX IF NOT EXISTS idx_driver_violations_counted
  ON public.driver_violations (incident_date DESC)
  WHERE status IN ('confirmed', 'resolved');

-- ── 3. Passengers read their own violations ─────────────────────────────────
DROP POLICY IF EXISTS "Passengers view own violations" ON public.driver_violations;
CREATE POLICY "Passengers view own violations" ON public.driver_violations
  FOR SELECT TO authenticated USING (passenger_id = public.current_app_user_id());

-- ── 4. Permanent account deactivation ───────────────────────────────────────
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.users'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%active%suspended%'
       AND pg_get_constraintdef(oid) NOT ILIKE '%verification_status%'
       AND pg_get_constraintdef(oid) NOT ILIKE '%current_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'inactive', 'suspended', 'deactivated'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- Direct API writes (including an admin's) can never deactivate, reactivate a
-- deactivated account, or edit the deactivation record. Only the
-- SECURITY DEFINER admin_deactivate_user() below runs as the owner.
CREATE OR REPLACE FUNCTION public.lock_deactivated_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'deactivated' AND NEW.status IS DISTINCT FROM 'deactivated' THEN
    RAISE EXCEPTION 'This account was permanently deactivated and cannot be reactivated.'
      USING ERRCODE = '42501';
  END IF;
  IF (NEW.status = 'deactivated' AND OLD.status IS DISTINCT FROM 'deactivated')
     OR ROW(NEW.deactivated_at, NEW.deactivated_by, NEW.deactivation_reason)
        IS DISTINCT FROM ROW(OLD.deactivated_at, OLD.deactivated_by, OLD.deactivation_reason) THEN
    RAISE EXCEPTION 'Use the Permanently Deactivate action to deactivate an account.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_deactivated_account_trigger ON public.users;
CREATE TRIGGER lock_deactivated_account_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.lock_deactivated_account();

CREATE OR REPLACE FUNCTION public.admin_deactivate_user(p_user_id UUID, p_reason TEXT)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.users;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can deactivate accounts.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = public.current_app_user_id() THEN
    RAISE EXCEPTION 'You cannot deactivate your own account.';
  END IF;
  IF length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Give the reason for the deactivation.';
  END IF;

  UPDATE public.users
     SET status = 'deactivated',
         deactivated_at = NOW(),
         deactivated_by = public.current_app_user_id(),
         deactivation_reason = left(btrim(p_reason), 500),
         current_status = 'offline'
   WHERE id = p_user_id
     AND user_type IN ('driver', 'passenger')
     AND status <> 'deactivated'
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a driver or passenger account that is not yet deactivated can be deactivated.';
  END IF;

  -- An open ride request must not keep showing to drivers.
  UPDATE public.bookings
     SET status = 'cancelled',
         cancelled_by = 'admin',
         cancellation_reason = 'Account deactivated'
   WHERE passenger_id = p_user_id
     AND status = 'pending';

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_deactivate_user(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_deactivate_user(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_user(UUID, TEXT) TO authenticated;

-- 068 version, plus: deactivated accounts are kept for accountability.
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id UUID;
  v_status  TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can delete accounts.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = public.current_app_user_id() THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;

  SELECT auth_id, status INTO v_auth_id, v_status FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That account no longer exists.';
  END IF;
  IF v_status = 'deactivated' THEN
    RAISE EXCEPTION 'Deactivated accounts are kept with their ride and violation records and cannot be deleted.';
  END IF;

  -- public.users.auth_id cascades from auth.users; the explicit delete covers
  -- deployments where that foreign key was changed.
  DELETE FROM auth.users WHERE id = v_auth_id;
  DELETE FROM public.users WHERE id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

COMMIT;

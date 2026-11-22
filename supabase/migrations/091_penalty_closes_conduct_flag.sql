-- =============================================================================
-- 091 · A penalty closes the conduct flag
-- -----------------------------------------------------------------------------
-- Once the admin acts on a flagged account, the flag and its alert stop:
--
--   • users.conduct_action / conduct_action_at record the latest penalty:
--       - 'suspended' / 'deactivated' are stamped automatically whenever the
--         account status changes to it (Suspend Account, admin_deactivate_user);
--       - 'warning' is stamped by admin_record_conduct_warning() when the admin
--         sends an official warning.
--     Direct API writes cannot change these two columns.
--   • The count starts again after the penalty: only violations recorded and
--     invalid cancellations made after conduct_action_at count toward a new
--     flag, so three new ones flag the account again.
--   • Suspended and deactivated accounts are never flagged and raise no alert.
--
-- Must match summarizeConduct() in src/models/services/ConductService.ts.
-- Apply after 079. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Penalty record ───────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS conduct_action    TEXT,
  ADD COLUMN IF NOT EXISTS conduct_action_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.users'::regclass
       AND conname = 'users_conduct_action_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_conduct_action_check
      CHECK (conduct_action IS NULL OR conduct_action IN ('warning', 'suspended', 'deactivated'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.users.conduct_action IS
  'Latest penalty on a flagged account: warning, suspended or deactivated (091).';
COMMENT ON COLUMN public.users.conduct_action_at IS
  'When the latest penalty was given; the conduct flag counts only what comes after (091).';

-- Existing suspended / deactivated accounts already carry their penalty.
UPDATE public.users
   SET conduct_action    = status,
       conduct_action_at = COALESCE(deactivated_at, NOW())
 WHERE status IN ('suspended', 'deactivated')
   AND conduct_action_at IS NULL;

-- ── 2. Stamp suspension / deactivation, lock direct writes ──────────────────
-- SECURITY INVOKER on purpose (like 068/077): trusted SECURITY DEFINER
-- functions run as the owner, so admin_record_conduct_warning() passes.
CREATE OR REPLACE FUNCTION public.stamp_conduct_action()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('suspended', 'deactivated') AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.conduct_action    := NEW.status;
    NEW.conduct_action_at := NOW();
  ELSIF current_user IN ('authenticated', 'anon')
        AND ROW(NEW.conduct_action, NEW.conduct_action_at)
            IS DISTINCT FROM ROW(OLD.conduct_action, OLD.conduct_action_at) THEN
    RAISE EXCEPTION 'Penalties are recorded by the Issue Warning, Suspend and Deactivate actions.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_conduct_action_trigger ON public.users;
CREATE TRIGGER stamp_conduct_action_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.stamp_conduct_action();

-- ── 3. Official warning ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_record_conduct_warning(p_user_id UUID)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.users;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can record a warning.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.users
     SET conduct_action    = 'warning',
         conduct_action_at = NOW()
   WHERE id = p_user_id
     AND user_type IN ('driver', 'passenger')
     AND status <> 'deactivated'
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an active or suspended driver or passenger account can receive a warning.';
  END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_record_conduct_warning(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_record_conduct_warning(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_record_conduct_warning(UUID) TO authenticated;

-- ── 4. Flag alerts (079) count only what comes after the penalty ────────────
CREATE OR REPLACE FUNCTION public.alert_flagged_violations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   UUID := COALESCE(NEW.driver_id, NEW.passenger_id);
  v_count  INTEGER;
  v_name   TEXT;
  v_role   TEXT;
  v_status TEXT;
  v_since  TIMESTAMPTZ;
BEGIN
  -- Only when this row starts counting (newly confirmed, or recorded as such).
  IF v_user IS NULL OR NEW.status NOT IN ('confirmed', 'resolved') THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('confirmed', 'resolved') THEN RETURN NULL; END IF;
  IF NEW.incident_date < public.conduct_window_start_date() THEN RETURN NULL; END IF;

  SELECT name, user_type, status, conduct_action_at
    INTO v_name, v_role, v_status, v_since
    FROM public.users WHERE id = v_user;

  -- 091: a penalty was already given.
  IF v_status IN ('suspended', 'deactivated') THEN RETURN NULL; END IF;
  IF v_since IS NOT NULL AND NEW.created_at <= v_since THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_count
    FROM public.driver_violations v
   WHERE COALESCE(v.driver_id, v.passenger_id) = v_user
     AND v.status IN ('confirmed', 'resolved')
     AND v.incident_date >= public.conduct_window_start_date()
     AND (v_since IS NULL OR v.created_at > v_since);

  IF v_count <> 3 THEN RETURN NULL; END IF;

  PERFORM public.notify_admins(
    'Account flagged for review',
    format('%s (%s) now has %s confirmed violations in the last 7 days. Review the records in Violations before imposing a restriction.',
      COALESCE(v_name, 'A user'), COALESCE(v_role, 'user'), v_count)
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.alert_repeated_cancellations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  INTEGER;
  v_name   TEXT;
  v_status TEXT;
  v_since  TIMESTAMPTZ;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled'
     OR NEW.cancelled_by IS DISTINCT FROM 'passenger'
     OR NEW.cancellation_valid IS DISTINCT FROM FALSE
     OR NEW.passenger_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT name, status, conduct_action_at
    INTO v_name, v_status, v_since
    FROM public.users WHERE id = NEW.passenger_id;

  -- 091: a penalty was already given.
  IF v_status IN ('suspended', 'deactivated') THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_count
    FROM public.bookings b
   WHERE b.passenger_id = NEW.passenger_id
     AND b.status = 'cancelled'
     AND b.cancelled_by = 'passenger'
     AND b.cancellation_valid = FALSE
     AND b.cancelled_at >= (public.conduct_window_start_date()::timestamp AT TIME ZONE 'Asia/Manila')
     AND (v_since IS NULL OR b.cancelled_at > v_since);

  IF v_count <> 3 THEN RETURN NULL; END IF;

  PERFORM public.notify_admins(
    'Passenger flagged: repeated cancellations',
    format('%s has cancelled %s bookings without a valid reason in the last 7 days. Review them in Violations → Needs admin review.',
      COALESCE(v_name, 'A passenger'), v_count)
  );
  RETURN NULL;
END;
$$;

COMMIT;

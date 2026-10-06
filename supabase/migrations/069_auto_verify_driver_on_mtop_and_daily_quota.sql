-- =============================================================================
-- 069 · Auto-verify drivers with an approved MTOP + per-driver daily quota
--
--  1. When an MTOP application reaches 'approved' (payment verified) or
--     'issued', the driver's account is verified automatically. The admin
--     already checked the driver's license and documents during the MTOP
--     review, so a separate account approval in User Management is no longer
--     needed. Existing drivers who already hold an approved/issued MTOP are
--     backfilled.
--  2. users.daily_quota lets each driver set their own daily earnings goal
--     (the app falls back to ₱800 when it is NULL).
--
-- Idempotent — safe to re-run. Apply in the Supabase SQL editor after 068.
-- =============================================================================

BEGIN;

-- ── 1. Auto-verify driver on MTOP approval ──────────────────────────────────
-- SECURITY DEFINER so the update runs as the owner and passes
-- protect_user_self_managed_fields() regardless of who advanced the MTOP.
CREATE OR REPLACE FUNCTION public.verify_driver_on_mtop_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved', 'issued')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.users
       SET verification_status = 'verified'
     WHERE id = NEW.driver_id
       AND user_type = 'driver'
       AND verification_status IS DISTINCT FROM 'verified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verify_driver_on_mtop_approval_trigger ON public.franchise_applications;
CREATE TRIGGER verify_driver_on_mtop_approval_trigger
  AFTER INSERT OR UPDATE OF status ON public.franchise_applications
  FOR EACH ROW EXECUTE FUNCTION public.verify_driver_on_mtop_approval();

-- Backfill drivers who already have an approved or issued MTOP.
UPDATE public.users u
   SET verification_status = 'verified'
 WHERE u.user_type = 'driver'
   AND u.verification_status IS DISTINCT FROM 'verified'
   AND EXISTS (
     SELECT 1 FROM public.franchise_applications f
      WHERE f.driver_id = u.id
        AND f.status IN ('approved', 'issued')
   );

-- ── 2. Per-driver daily quota ───────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_quota NUMERIC(10, 2);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_daily_quota_range;
ALTER TABLE public.users ADD CONSTRAINT users_daily_quota_range
  CHECK (daily_quota IS NULL OR (daily_quota > 0 AND daily_quota <= 100000));

COMMIT;

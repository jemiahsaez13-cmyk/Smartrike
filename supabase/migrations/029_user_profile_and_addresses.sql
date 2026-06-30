-- =============================================================================
-- 029_user_profile_and_addresses.sql
--
-- 1. Adds onboarding fields to `users`:
--      - home_address       : the rider's primary address (set during setup)
--      - profile_completed  : gate that forces brand-new accounts (incl. Google
--                             sign-in) through the profile-setup screen once.
--    Existing users are backfilled as completed so they are never disrupted.
--
-- 2. Adds `user_addresses` — a Shopee-style saved-address book a passenger can
--    add to, edit, and reuse when booking. Owner has full CRUD; admins see all.
--
-- Idempotent.
-- =============================================================================

-- ── users: onboarding columns ───────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS home_address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false;

-- Everyone who already exists keeps using the app without an onboarding wall.
-- Only accounts created from now on default to profile_completed = false.
UPDATE public.users SET profile_completed = true WHERE profile_completed = false;

-- ── user_addresses: saved address book ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label VARCHAR(40) NOT NULL DEFAULT 'Home',
  recipient_name VARCHAR(120),
  recipient_phone VARCHAR(20),
  full_address TEXT NOT NULL,
  notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own addresses" ON public.user_addresses;
CREATE POLICY "Users view own addresses" ON public.user_addresses
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users insert own addresses" ON public.user_addresses;
CREATE POLICY "Users insert own addresses" ON public.user_addresses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users update own addresses" ON public.user_addresses;
CREATE POLICY "Users update own addresses" ON public.user_addresses
  FOR UPDATE TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users delete own addresses" ON public.user_addresses;
CREATE POLICY "Users delete own addresses" ON public.user_addresses
  FOR DELETE TO authenticated
  USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Admins manage all addresses" ON public.user_addresses;
CREATE POLICY "Admins manage all addresses" ON public.user_addresses
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Keep a single default per user: whenever a row is flagged default, clear the
-- flag on that user's other rows.
CREATE OR REPLACE FUNCTION public.enforce_single_default_address()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.user_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_default_address ON public.user_addresses;
CREATE TRIGGER trg_single_default_address
  AFTER INSERT OR UPDATE OF is_default ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_address();

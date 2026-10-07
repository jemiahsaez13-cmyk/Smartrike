-- =============================================================================
-- 076 · Email OTP verification before account creation
-- -----------------------------------------------------------------------------
-- Passengers and drivers must enter the 6-digit code emailed to them before
-- their Smart Trike account exists:
--   1. Remove the auto-confirm trigger (migration 041) so Supabase Auth sends
--      the signup OTP and keeps the address unconfirmed until it is verified.
--   2. Create the public.users profile only once the email is confirmed. An
--      unverified sign-up leaves no profile, so it cannot sign in, appear in
--      admin lists, or be matched for rides.
--
-- Requires custom SMTP + "Confirm email" (mailer_autoconfirm = false), which
-- `npm run auth:configure-email` sets up.
-- Idempotent: safe to run more than once.
-- =============================================================================

DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_email();

-- Users created already-confirmed (service-role bootstrap, admin tooling) still
-- get their profile immediately on insert.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- Self sign-ups get their profile the moment the OTP is verified. The
-- handle_new_user() insert is ON CONFLICT (auth_id) DO NOTHING, so a later
-- re-confirmation (e.g. email change) never duplicates the profile.
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

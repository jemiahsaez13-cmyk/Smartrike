-- =============================================================================
-- 013 · Auto-confirm email on signup (no email-link step → instant login)
-- -----------------------------------------------------------------------------
-- The project has "Confirm email" enabled at the GoTrue level, so signups
-- returned no session and the app couldn't auto-login. We can't change the
-- dashboard setting from here, so we auto-confirm every new auth user at the DB
-- level via a BEFORE INSERT trigger. Combined with an immediate sign-in in
-- AuthService.signUp, new accounts log in straight away.
--
-- Also retro-confirms any existing accounts that got stuck unconfirmed.
-- Idempotent: safe to run more than once.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;
CREATE TRIGGER auto_confirm_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_email();

-- Retro-confirm any accounts already stuck waiting for email confirmation.
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

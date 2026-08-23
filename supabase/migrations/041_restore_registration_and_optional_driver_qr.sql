-- Restore the project's original instant email registration behavior, make
-- driver payment QR images optional, and keep unverified drivers offline.

-- This deployment does not have SMTP credentials configured. Confirm email
-- addresses server-side so sign-up can return to the established create/login
-- flow instead of leaving new accounts waiting for an undeliverable OTP.
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;
CREATE TRIGGER auto_confirm_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_email();

-- Recover accounts created while the email-confirmation regression was active.
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL AND email IS NOT NULL;

-- QR is a convenience; account details remain sufficient for online payment.
UPDATE public.driver_payment_methods
SET qr_code_url = NULL
WHERE btrim(COALESCE(qr_code_url, '')) = '';

ALTER TABLE public.driver_payment_methods
  ALTER COLUMN qr_code_url DROP NOT NULL;

ALTER TABLE public.driver_payment_methods
  DROP CONSTRAINT IF EXISTS driver_payment_methods_qr_code_url_check;

ALTER TABLE public.driver_payment_methods
  ADD CONSTRAINT driver_payment_methods_qr_code_url_check
  CHECK (
    qr_code_url IS NULL
    OR (
      qr_code_url ~ '^data:image/(jpeg|jpg|png|webp);base64,'
      AND octet_length(qr_code_url) <= 3500000
    )
  );

-- Driver verification is an administrator-owned authorization field. A
-- modified client must not be able to approve its own driver profile.
CREATE OR REPLACE FUNCTION public.protect_user_authorization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND (
       NEW.user_type IS DISTINCT FROM OLD.user_type
       OR NEW.auth_id IS DISTINCT FROM OLD.auth_id
       OR lower(NEW.email) IS DISTINCT FROM lower(OLD.email)
       OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
     ) THEN
    RAISE EXCEPTION 'Identity, role, and driver verification fields can only be changed by an administrator.'
      USING ERRCODE = '42501';
  END IF;

  NEW.email := lower(NEW.email);
  RETURN NEW;
END;
$$;

-- Logging in is always allowed for an active pending driver, but operating is
-- not. This complements the booking RLS policies by preventing a pending or
-- rejected driver from advertising an online/on-trip status through the API.
CREATE OR REPLACE FUNCTION public.enforce_verified_driver_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.user_type = 'driver'
     AND COALESCE(NEW.verification_status, 'pending') <> 'verified'
     AND COALESCE(NEW.current_status, 'offline') <> 'offline' THEN
    IF TG_OP = 'UPDATE'
       AND NEW.verification_status IS DISTINCT FROM OLD.verification_status
       AND (auth.uid() IS NULL OR public.is_admin()) THEN
      NEW.current_status := 'offline';
    ELSE
      RAISE EXCEPTION 'Driver verification is required before going online or operating trips.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_verified_driver_operation_insert ON public.users;
CREATE TRIGGER enforce_verified_driver_operation_insert
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_driver_operation();

DROP TRIGGER IF EXISTS enforce_verified_driver_operation_update ON public.users;
CREATE TRIGGER enforce_verified_driver_operation_update
  BEFORE UPDATE OF current_status, verification_status, user_type ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_driver_operation();

REVOKE ALL ON FUNCTION public.auto_confirm_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_verified_driver_operation() FROM PUBLIC;

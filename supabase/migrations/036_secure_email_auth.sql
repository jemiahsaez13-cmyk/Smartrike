-- =============================================================================
-- 036 · Secure email authentication and authorization boundaries
-- =============================================================================

-- Email confirmation is handled by Supabase Auth. Remove the legacy trigger
-- that silently marked every new address as verified.
DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_email();

-- Profiles are still created server-side, but public signup metadata may only
-- select passenger or driver. Administrator access is provisioned separately
-- with the service-role bootstrap script.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta             jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  requested_type   text  := lower(COALESCE(meta->>'user_type', ''));
  safe_user_type   text;
BEGIN
  safe_user_type := CASE WHEN requested_type = 'driver' THEN 'driver' ELSE 'passenger' END;

  INSERT INTO public.users (
    auth_id, email, name, phone, user_type, status, rating, total_trips,
    license_number, toda_membership, vehicle_details, verification_status
  ) VALUES (
    new.id,
    lower(new.email),
    COALESCE(NULLIF(trim(meta->>'name'), ''), split_part(new.email, '@', 1)),
    NULL,
    safe_user_type,
    'active',
    5.0,
    0,
    NULLIF(trim(meta->>'license_number'), ''),
    NULLIF(trim(meta->>'toda_membership'), ''),
    CASE WHEN meta ? 'vehicle_details' THEN meta->'vehicle_details' ELSE NULL END,
    CASE WHEN safe_user_type = 'driver' THEN 'pending' ELSE NULL END
  )
  ON CONFLICT (auth_id) DO NOTHING;

  RETURN new;
END;
$$;

-- Canonical, case-insensitive profile email uniqueness mirrors Supabase Auth's
-- email identity uniqueness and prevents duplicate public profiles.
UPDATE public.users SET email = lower(email) WHERE email <> lower(email);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON public.users (lower(email));

-- RLS controls which rows users can update, but it does not restrict individual
-- columns. Block ordinary authenticated users from changing identity/role fields.
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
       new.user_type IS DISTINCT FROM old.user_type
       OR new.auth_id IS DISTINCT FROM old.auth_id
       OR lower(new.email) IS DISTINCT FROM lower(old.email)
     ) THEN
    RAISE EXCEPTION 'Identity and role fields can only be changed by an administrator.'
      USING ERRCODE = '42501';
  END IF;

  new.email := lower(new.email);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_authorization_fields_trigger ON public.users;
CREATE TRIGGER protect_user_authorization_fields_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_authorization_fields();

REVOKE ALL ON FUNCTION public.protect_user_authorization_fields() FROM PUBLIC;

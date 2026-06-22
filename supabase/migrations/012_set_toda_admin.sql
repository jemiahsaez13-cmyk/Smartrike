-- =============================================================================
-- 012 · Promote todaadmin@gmail.com to admin
-- -----------------------------------------------------------------------------
-- This account was created via signup (which defaults new users to 'passenger').
-- It is the FEDTODAB administrator, so set its role to 'admin'. Idempotent.
-- =============================================================================

UPDATE public.users
SET
  user_type = 'admin',
  status = 'active',
  verification_status = NULL
WHERE lower(email) = 'todaadmin@gmail.com';

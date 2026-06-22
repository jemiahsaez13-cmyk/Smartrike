-- =============================================================================
-- 014 · One-off cleanup — remove ALL accounts except the admin
-- -----------------------------------------------------------------------------
-- Requested data purge: keep only todaadmin@gmail.com and delete every other
-- user. Deleting from auth.users cascades to public.users (auth_id FK) and on
-- to bookings / franchise_applications / etc. via their FK rules.
--
-- DESTRUCTIVE and not reversible. Idempotent: re-running deletes nothing once
-- only the admin remains.
-- =============================================================================

-- Remove every auth account except the admin (cascades to public.users).
DELETE FROM auth.users
WHERE lower(email) <> 'todaadmin@gmail.com';

-- Safety net: drop any orphaned public profiles that weren't tied to auth.users.
DELETE FROM public.users
WHERE lower(email) <> 'todaadmin@gmail.com';

-- =============================================================================
-- 094 · The MTOP follows the driver's TODA
-- -----------------------------------------------------------------------------
-- 1. When the admin assigns a driver to another TODA (users.toda_membership),
--    the driver's current MTOP records move to that TODA
--    (franchise_applications.toda):
--      • "Current" = not rejected, body number not released, and not an issued
--        record that is terminated, transferred or superseded by a renewal.
--        Those old records keep their TODA as history.
--      • The unit's route (route_id, 082) is cleared when it is not a route of
--        the new TODA; the admin picks a route of the new TODA if needed.
--      • Refused, with the reason, when the unit's body number is already held
--        in the new TODA. The TODA assignment is then not saved either.
--      • Removing the driver's TODA (no TODA) leaves the MTOP as it is.
-- 2. Renaming a TODA renames it on every MTOP record and driver.
--
-- Apply after 093. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Driver assigned to another TODA ──────────────────────────────────────
-- Runs as the caller: only an administrator (or the server) can change
-- users.toda_membership (068), and enforce_mtop_workflow lets an
-- administrator change these MTOP columns.
CREATE OR REPLACE FUNCTION public.sync_mtop_toda_with_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_new   TEXT := NULLIF(btrim(NEW.toda_membership), '');
  v_taken TEXT;
BEGIN
  IF v_new IS NULL THEN
    RETURN NEW;
  END IF;

  -- A body number is unique per TODA (072 / 082).
  SELECT mine.body_number INTO v_taken
  FROM public.franchise_applications mine
  JOIN public.franchise_applications other
    ON upper(btrim(other.body_number)) = upper(btrim(mine.body_number))
   AND lower(btrim(other.toda)) = lower(v_new)
   AND other.driver_id IS DISTINCT FROM NEW.id
   AND other.body_number_released_at IS NULL
   AND other.status <> 'rejected'
   AND NOT (other.status = 'issued' AND COALESCE(other.franchise_status, 'active') IN ('terminated', 'transferred', 'renewed'))
  WHERE mine.driver_id = NEW.id
    AND COALESCE(btrim(mine.body_number), '') <> ''
    AND lower(btrim(COALESCE(mine.toda, ''))) <> lower(v_new)
    AND mine.body_number_released_at IS NULL
    AND mine.status <> 'rejected'
    AND NOT (mine.status = 'issued' AND COALESCE(mine.franchise_status, 'active') IN ('terminated', 'transferred', 'renewed'))
  LIMIT 1;

  IF v_taken IS NOT NULL THEN
    RAISE EXCEPTION 'Body number % is already used in %. Change this unit''s body number first, then assign the TODA.',
      v_taken, v_new
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.franchise_applications f
     SET toda = v_new,
         route_id = CASE
           WHEN EXISTS (
             SELECT 1
             FROM public.toda_routes r
             JOIN public.toda_associations t ON t.id = r.toda_id
             WHERE r.id = f.route_id AND lower(btrim(t.name)) = lower(v_new)
           ) THEN f.route_id
           ELSE NULL
         END,
         updated_at = NOW()
   WHERE f.driver_id = NEW.id
     AND lower(btrim(COALESCE(f.toda, ''))) <> lower(v_new)
     AND f.body_number_released_at IS NULL
     AND f.status <> 'rejected'
     AND NOT (f.status = 'issued' AND COALESCE(f.franchise_status, 'active') IN ('terminated', 'transferred', 'renewed'));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_mtop_toda_with_membership_trigger ON public.users;
CREATE TRIGGER sync_mtop_toda_with_membership_trigger
  AFTER UPDATE OF toda_membership ON public.users
  FOR EACH ROW
  WHEN (NEW.toda_membership IS DISTINCT FROM OLD.toda_membership)
  EXECUTE FUNCTION public.sync_mtop_toda_with_membership();

-- ── 2. TODA renamed ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rename_toda_everywhere()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.franchise_applications
     SET toda = NEW.name, updated_at = NOW()
   WHERE lower(btrim(toda)) = lower(btrim(OLD.name));

  UPDATE public.users
     SET toda_membership = NEW.name
   WHERE lower(btrim(toda_membership)) = lower(btrim(OLD.name));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rename_toda_everywhere_trigger ON public.toda_associations;
CREATE TRIGGER rename_toda_everywhere_trigger
  AFTER UPDATE OF name ON public.toda_associations
  FOR EACH ROW
  WHEN (NEW.name IS DISTINCT FROM OLD.name)
  EXECUTE FUNCTION public.rename_toda_everywhere();

COMMIT;

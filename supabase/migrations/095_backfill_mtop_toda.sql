-- =============================================================================
-- 095 · Bring existing MTOPs in line with the driver's TODA
-- -----------------------------------------------------------------------------
-- 094 moves the MTOP only when the TODA changes after it is applied. Drivers
-- whose TODA was changed before that still show the old TODA on their MTOP.
-- This moves their current MTOP records (same rules as 094) to the TODA in
-- users.toda_membership, and clears a route_id that is not a route of it.
--
-- Skipped, and listed as a NOTICE: a record whose body number is already held
-- in the driver's TODA. Fix the body number, then assign the TODA again.
-- Drivers without a TODA are not touched.
--
-- enforce_mtop_workflow (092) allows MTOP edits only from an administrator's
-- session, so it is switched off for this one update and back on before the
-- commit. Apply after 094. Safe to run more than once.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT f.id, f.body_number, f.toda AS old_toda, btrim(u.toda_membership) AS new_toda, u.name
    FROM public.franchise_applications f
    JOIN public.users u ON u.id = f.driver_id
    WHERE NULLIF(btrim(u.toda_membership), '') IS NOT NULL
      AND lower(btrim(COALESCE(f.toda, ''))) <> lower(btrim(u.toda_membership))
      AND f.body_number_released_at IS NULL
      AND f.status <> 'rejected'
      AND NOT (f.status = 'issued' AND COALESCE(f.franchise_status, 'active') IN ('terminated', 'transferred', 'renewed'))
      AND COALESCE(btrim(f.body_number), '') <> ''
      AND EXISTS (
        SELECT 1 FROM public.franchise_applications o
        WHERE upper(btrim(o.body_number)) = upper(btrim(f.body_number))
          AND lower(btrim(o.toda)) = lower(btrim(u.toda_membership))
          AND o.driver_id IS DISTINCT FROM f.driver_id
          AND o.body_number_released_at IS NULL
          AND o.status <> 'rejected'
          AND NOT (o.status = 'issued' AND COALESCE(o.franchise_status, 'active') IN ('terminated', 'transferred', 'renewed'))
      )
  LOOP
    RAISE NOTICE 'Skipped MTOP % of %: body number % is already used in % (MTOP stays in %).',
      r.id, r.name, r.body_number, r.new_toda, r.old_toda;
  END LOOP;
END;
$$;

ALTER TABLE public.franchise_applications DISABLE TRIGGER enforce_mtop_workflow_trigger;

UPDATE public.franchise_applications f
   SET toda = btrim(u.toda_membership),
       route_id = CASE
         WHEN EXISTS (
           SELECT 1
           FROM public.toda_routes r
           JOIN public.toda_associations t ON t.id = r.toda_id
           WHERE r.id = f.route_id AND lower(btrim(t.name)) = lower(btrim(u.toda_membership))
         ) THEN f.route_id
         ELSE NULL
       END,
       updated_at = NOW()
  FROM public.users u
 WHERE u.id = f.driver_id
   AND NULLIF(btrim(u.toda_membership), '') IS NOT NULL
   AND lower(btrim(COALESCE(f.toda, ''))) <> lower(btrim(u.toda_membership))
   AND f.body_number_released_at IS NULL
   AND f.status <> 'rejected'
   AND NOT (f.status = 'issued' AND COALESCE(f.franchise_status, 'active') IN ('terminated', 'transferred', 'renewed'))
   AND NOT (
     COALESCE(btrim(f.body_number), '') <> ''
     AND EXISTS (
       SELECT 1 FROM public.franchise_applications o
       WHERE upper(btrim(o.body_number)) = upper(btrim(f.body_number))
         AND lower(btrim(o.toda)) = lower(btrim(u.toda_membership))
         AND o.driver_id IS DISTINCT FROM f.driver_id
         AND o.body_number_released_at IS NULL
         AND o.status <> 'rejected'
         AND NOT (o.status = 'issued' AND COALESCE(o.franchise_status, 'active') IN ('terminated', 'transferred', 'renewed'))
     )
   );

ALTER TABLE public.franchise_applications ENABLE TRIGGER enforce_mtop_workflow_trigger;

COMMIT;

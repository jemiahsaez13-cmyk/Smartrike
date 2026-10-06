-- =============================================================================
-- 070 · Franchise succession requires an app account + broader relationships
--
--  1. franchise_events.to_user_id and franchise_applications.current_holder_id
--     link a succession to the successor's Smart Trike account, so the admin
--     picks an existing account instead of typing a name.
--  2. Relationship choices become spouse / child / parent / sibling /
--     other_relative. 'unmarried_eldest_child' stays allowed for old rows.
--  3. event_type now also allows 'change_of_unit' (the 035 CHECK never did,
--     so Change of Unit events failed to insert).
--  4. The 069 auto-verify trigger also fires when an issued MTOP moves to a
--     new driver_id (succession), so the successor can operate right away.
--
-- Idempotent — safe to re-run. Apply in the Supabase SQL editor after 069.
-- =============================================================================

BEGIN;

ALTER TABLE public.franchise_events
  ADD COLUMN IF NOT EXISTS to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS current_holder_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.franchise_events
  DROP CONSTRAINT IF EXISTS franchise_events_relationship_check;
ALTER TABLE public.franchise_events
  ADD CONSTRAINT franchise_events_relationship_check
  CHECK (relationship IS NULL OR relationship IN (
    'spouse', 'child', 'parent', 'sibling', 'other_relative',
    'unmarried_eldest_child', 'third_party'
  ));

ALTER TABLE public.franchise_events
  DROP CONSTRAINT IF EXISTS franchise_events_event_type_check;
ALTER TABLE public.franchise_events
  ADD CONSTRAINT franchise_events_event_type_check
  CHECK (event_type IN (
    'renewal', 'succession_transfer', 'third_party_transfer', 'termination', 'change_of_unit'
  ));

-- New succession events must name the successor's account.
ALTER TABLE public.franchise_events
  DROP CONSTRAINT IF EXISTS franchise_events_succession_account_check;
ALTER TABLE public.franchise_events
  ADD CONSTRAINT franchise_events_succession_account_check
  CHECK (event_type <> 'succession_transfer' OR to_user_id IS NOT NULL) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_franchise_events_to_user ON public.franchise_events(to_user_id);

-- Succession moves the MTOP to the successor (driver_id changes). Extend the
-- 069 auto-verify so the new holder is verified like any approved MTOP driver.
CREATE OR REPLACE FUNCTION public.verify_driver_on_mtop_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved', 'issued')
     AND (TG_OP = 'INSERT'
          OR OLD.status IS DISTINCT FROM NEW.status
          OR OLD.driver_id IS DISTINCT FROM NEW.driver_id) THEN
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
  AFTER INSERT OR UPDATE OF status, driver_id ON public.franchise_applications
  FOR EACH ROW EXECUTE FUNCTION public.verify_driver_on_mtop_approval();

COMMIT;

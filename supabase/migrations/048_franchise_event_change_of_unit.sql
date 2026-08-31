-- =============================================================================
-- 048 · Change of Unit columns on franchise_events (Module 12)
--
-- Adds four nullable columns to franchise_events to record unit replacement
-- details when event_type = 'change_of_unit':
--   new_plate_number  — new tricycle plate
--   new_body_number   — new body number
--   or_number         — LTO Official Receipt number of the new unit
--   cr_number         — LTO Certificate of Registration number of the new unit
--
-- Idempotent — safe to re-run.
-- =============================================================================

ALTER TABLE public.franchise_events
  ADD COLUMN IF NOT EXISTS new_plate_number  VARCHAR(30)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS new_body_number   VARCHAR(30)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS or_number         VARCHAR(60)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cr_number         VARCHAR(60)  DEFAULT NULL;

COMMENT ON COLUMN public.franchise_events.new_plate_number IS 'New plate number recorded on a change_of_unit event.';
COMMENT ON COLUMN public.franchise_events.new_body_number  IS 'New body number recorded on a change_of_unit event.';
COMMENT ON COLUMN public.franchise_events.or_number        IS 'LTO Official Receipt number of the replacement unit.';
COMMENT ON COLUMN public.franchise_events.cr_number        IS 'LTO Certificate of Registration number of the replacement unit.';

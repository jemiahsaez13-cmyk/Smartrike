-- =============================================================================
-- 051 · Change of Unit image columns on franchise_applications
--
-- Adds three image columns so drivers can attach photos with their COU request:
--
--   cou_or_image    data-URI / URL of the OR (Official Receipt) photo
--   cou_cr_image    data-URI / URL of the CR (Certificate of Registration) photo
--   cou_unit_image  data-URI / URL of the new unit (tricycle) photo
--
-- Idempotent — safe to re-run.
-- =============================================================================

ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS cou_or_image    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_cr_image    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_unit_image  TEXT DEFAULT NULL;

COMMENT ON COLUMN public.franchise_applications.cou_or_image   IS 'Photo of the LTO Official Receipt for the new unit (data-URI or URL).';
COMMENT ON COLUMN public.franchise_applications.cou_cr_image   IS 'Photo of the LTO Certificate of Registration for the new unit (data-URI or URL).';
COMMENT ON COLUMN public.franchise_applications.cou_unit_image IS 'Photo of the replacement tricycle unit (data-URI or URL).';

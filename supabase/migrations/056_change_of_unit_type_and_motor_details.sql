-- Distinguish sidecar replacement from motor replacement and retain the
-- motor manufacturer/model supplied by the driver for administrator review.
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS cou_unit_type VARCHAR(20)
    CHECK (cou_unit_type IN ('sidecar', 'motor', 'both')),
  ADD COLUMN IF NOT EXISTS cou_vehicle_make VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cou_vehicle_model VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vehicle_make VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(100);

COMMENT ON COLUMN public.franchise_applications.cou_unit_type IS 'Requested component replacement: sidecar or motor.';
COMMENT ON COLUMN public.franchise_applications.cou_vehicle_make IS 'Manufacturer/make of the requested replacement motor.';
COMMENT ON COLUMN public.franchise_applications.cou_vehicle_model IS 'Model of the requested replacement motor.';

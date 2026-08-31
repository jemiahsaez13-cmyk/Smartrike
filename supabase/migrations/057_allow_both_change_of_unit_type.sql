-- Allow one request to replace both the motor and sidecar.
ALTER TABLE public.franchise_applications
  DROP CONSTRAINT IF EXISTS franchise_applications_cou_unit_type_check;

ALTER TABLE public.franchise_applications
  ADD CONSTRAINT franchise_applications_cou_unit_type_check
  CHECK (cou_unit_type IN ('sidecar', 'motor', 'both'));

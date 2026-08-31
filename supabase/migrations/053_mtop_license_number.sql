-- Capture the driver's account license number on every MTOP submission so
-- administrators can compare it with the required license image.
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS license_number VARCHAR(50);

COMMENT ON COLUMN public.franchise_applications.license_number IS
  'Read-only snapshot of the license number from the driver account at MTOP submission time.';

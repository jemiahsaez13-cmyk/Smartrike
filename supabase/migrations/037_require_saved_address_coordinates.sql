-- Saved addresses must be backed by an exact map pin. Existing legacy rows
-- without coordinates remain readable so users can open and repair them, but
-- new rows and address/location edits cannot be written without a valid pair.

CREATE OR REPLACE FUNCTION public.require_saved_address_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NULL
     OR NEW.longitude IS NULL
     OR NEW.latitude < -90
     OR NEW.latitude > 90
     OR NEW.longitude < -180
     OR NEW.longitude > 180 THEN
    RAISE EXCEPTION 'A valid confirmed map pin is required for every saved address.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_saved_address_coordinates ON public.user_addresses;
CREATE TRIGGER trg_require_saved_address_coordinates
  BEFORE INSERT OR UPDATE OF full_address, latitude, longitude
  ON public.user_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.require_saved_address_coordinates();

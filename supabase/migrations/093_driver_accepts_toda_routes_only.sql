-- =============================================================================
-- 093 · A driver accepts only rides on their TODA's routes
-- -----------------------------------------------------------------------------
-- A driver may accept a booking only when the TODA they belong to
-- (users.toda_membership = toda_associations.name) has a route in
-- toda_routes between the pickup and drop-off barangays, in either
-- direction. Example: a driver whose TODA has no Sawi – Balimbing route
-- cannot accept a ride from Sawi to Balimbing.
--
-- A place's barangay is pickup_location / dropoff_location ->> 'barangay'
-- (set by the app when the passenger picks a place). A place without it
-- (older bookings, a pinned map spot) matches a barangay its address names.
-- Names compare without case, punctuation and "Poblacion", so
-- "Isok I (Poblacion)" and "Isok I" are the same barangay.
--
-- The app hides other rides from the driver and gives the reason on accept
-- (src/utils/todaRoute.ts uses the same matching). This trigger makes the
-- rule hold for direct API writes. Admins are not limited.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.barangay_key(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(lower(COALESCE(p_value, '')), '\mpoblacion\M', ' ', 'g'),
    '[^a-z0-9ñ]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.place_in_barangay(p_place JSONB, p_barangay TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_place IS NULL OR public.barangay_key(p_barangay) = '' THEN false
    WHEN NULLIF(btrim(p_place->>'barangay'), '') IS NOT NULL
      THEN public.barangay_key(p_place->>'barangay') = public.barangay_key(p_barangay)
    ELSE position(' ' || public.barangay_key(p_barangay) || ' '
                  IN ' ' || public.barangay_key(p_place->>'address') || ' ') > 0
  END;
$$;

-- True when the driver's TODA has a route for the trip (either direction).
CREATE OR REPLACE FUNCTION public.driver_toda_covers_booking(
  p_driver UUID, p_pickup JSONB, p_dropoff JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.toda_associations t
      ON lower(btrim(t.name)) = lower(btrim(u.toda_membership))
    JOIN public.toda_routes r ON r.toda_id = t.id
    WHERE u.id = p_driver
      AND (
        (public.place_in_barangay(p_pickup, r.from_barangay)
          AND public.place_in_barangay(p_dropoff, r.to_barangay))
        OR (public.place_in_barangay(p_pickup, r.to_barangay)
          AND public.place_in_barangay(p_dropoff, r.from_barangay))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.driver_toda_covers_booking(UUID, JSONB, JSONB) TO authenticated;

-- Runs as the caller (not SECURITY DEFINER) so current_user still tells a
-- client write from a server-side one, like 068's status trigger.
CREATE OR REPLACE FUNCTION public.enforce_driver_toda_route()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_toda TEXT;
BEGIN
  IF NOT (OLD.status = 'pending' AND NEW.status = 'accepted' AND NEW.driver_id IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF public.driver_toda_covers_booking(NEW.driver_id, NEW.pickup_location, NEW.dropoff_location) THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(btrim(toda_membership), '') INTO v_toda
  FROM public.users WHERE id = NEW.driver_id;

  RAISE EXCEPTION USING
    MESSAGE = CASE
      WHEN v_toda IS NULL
        THEN 'You are not assigned to a TODA yet. Ask the admin to assign you before accepting rides.'
      ELSE format('This ride is not on a %s route. You can only accept rides between barangays your TODA serves.', v_toda)
    END,
    ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS enforce_driver_toda_route_trigger ON public.bookings;
CREATE TRIGGER enforce_driver_toda_route_trigger
  BEFORE UPDATE OF status, driver_id ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_driver_toda_route();

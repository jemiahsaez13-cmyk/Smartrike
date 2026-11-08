-- =============================================================================
-- 087 · Passenger changes the drop-off during the ride (D7)
-- -----------------------------------------------------------------------------
--  1. booking_route_changes: one row per request. It keeps the original
--     drop-off, distance and fare next to the requested ones, so it is also the
--     audit of every change (accepted, declined, withdrawn or expired).
--     At most one request per booking is pending at a time.
--  2. request_dropoff_change(booking, location, distance): the passenger, while
--     the driver is on the way (accepted) or during the ride (in-transit).
--     Distance and fare are recomputed server-side with the same rules as
--     enforce_booking_insert (080), using the booking's own rates, ride type,
--     passenger count and discount:
--       - in-transit: pickup → driver's current position → new drop-off (the
--         part already ridden still counts); without a recent driver position,
--         pickup → new drop-off.
--       - accepted: pickup → new drop-off.
--     The app's road distance is accepted when plausible (not shorter than the
--     straight line, not more than 3x + 2 km longer), as at booking time.
--     The driver is notified. Nothing on the booking changes yet.
--  3. respond_dropoff_change(change, accept, reason): the assigned driver.
--     Only on accept do bookings.dropoff_location / distance /
--     estimated_duration / discount_amount / total_fare change. The passenger
--     is notified either way.
--  4. cancel_dropoff_change(change): the passenger withdraws a pending request.
--  5. A pending request expires when the ride is completed or cancelled, and
--     no online payment proof can be sent while a request waits.
--  6. protect_booking_financial_fields (081) also locks pickup, drop-off and
--     distance, and lets respond_dropoff_change update them.
--
-- A change is refused once a ride payment was submitted or verified, because
-- the fare can no longer move (same rule as revert_booking_discount, 081).
-- Apply after 086. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Requests + audit ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_route_changes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id             UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  requested_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  booking_status         TEXT NOT NULL,
  old_dropoff_location   JSONB NOT NULL,
  old_distance           NUMERIC(8, 2),
  old_total_fare         NUMERIC(10, 2) NOT NULL,
  old_discount_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  new_dropoff_location   JSONB NOT NULL,
  new_distance           NUMERIC(8, 2) NOT NULL,
  new_total_fare         NUMERIC(10, 2) NOT NULL,
  new_discount_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  new_estimated_duration INTEGER,
  -- Driver position used for the distance (in-transit only), for the audit.
  via_location           JSONB,
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  decline_reason         TEXT,
  requested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at             TIMESTAMPTZ,
  decided_by             UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_route_changes_booking
  ON public.booking_route_changes (booking_id, requested_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS booking_route_changes_one_pending
  ON public.booking_route_changes (booking_id) WHERE status = 'pending';

ALTER TABLE public.booking_route_changes ENABLE ROW LEVEL SECURITY;

-- Same visibility as the booking: passenger, assigned driver, admins. The
-- subquery runs under the caller's own RLS on bookings.
DROP POLICY IF EXISTS "View route changes with their booking" ON public.booking_route_changes;
CREATE POLICY "View route changes with their booking" ON public.booking_route_changes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_route_changes.booking_id)
  );
-- No INSERT/UPDATE/DELETE policies: writes go through the functions below.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_route_changes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

-- ── Shared: fare for a distance on an existing booking (080 rules) ──────────
CREATE OR REPLACE FUNCTION public.route_change_fare(p_booking public.bookings, p_distance NUMERIC)
RETURNS TABLE (total_fare NUMERIC, discount_amount NUMERIC, estimated_duration INTEGER)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_km       INTEGER := GREATEST(1, CEIL(COALESCE(p_distance, 0)))::INTEGER;
  v_route    NUMERIC;
  v_discount NUMERIC;
  v_count    INTEGER := LEAST(5, GREATEST(1, COALESCE(p_booking.passenger_count, 1)));
BEGIN
  -- The booking keeps the rates (and peak multiplier) it was priced with.
  v_route := ROUND((COALESCE(p_booking.base_fare, 120)
                    + (v_km - 1) * COALESCE(p_booking.per_km_rate, 10))
                   * COALESCE(p_booking.peak_hour_multiplier, 1), 2);
  IF p_booking.ride_type = 'priority' THEN
    v_route := v_route + GREATEST(12, v_route * 0.15);
  END IF;
  -- discount_pct is 0 after the driver removed the discount (081).
  v_discount := ROUND(ROUND(v_route, 2) * COALESCE(p_booking.discount_pct, 0) / 100, 2);
  total_fare := ROUND(v_route * v_count - v_discount, 2);
  discount_amount := v_discount;
  estimated_duration := CEIL(COALESCE(p_distance, 0) / 30 * 60)::INTEGER;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.route_change_fare(public.bookings, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.route_change_fare(public.bookings, NUMERIC) FROM anon;

CREATE OR REPLACE FUNCTION public.km_between(p_lat1 DOUBLE PRECISION, p_lng1 DOUBLE PRECISION,
                                             p_lat2 DOUBLE PRECISION, p_lng2 DOUBLE PRECISION)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (6371 * 2 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  )))::NUMERIC;
$$;

-- ── 2. Passenger: request ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_dropoff_change(
  p_booking_id UUID,
  p_location   JSONB,
  p_distance   NUMERIC DEFAULT NULL
)
RETURNS public.booking_route_changes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me       UUID := public.current_app_user_id();
  v_booking  public.bookings;
  v_change   public.booking_route_changes;
  v_lat      DOUBLE PRECISION;
  v_lng      DOUBLE PRECISION;
  v_address  TEXT;
  v_details  TEXT;
  v_loc      JSONB;
  v_p_lat    DOUBLE PRECISION;
  v_p_lng    DOUBLE PRECISION;
  v_d_lat    DOUBLE PRECISION;
  v_d_lng    DOUBLE PRECISION;
  v_via      JSONB;
  v_v_lat    DOUBLE PRECISION;
  v_v_lng    DOUBLE PRECISION;
  v_straight NUMERIC;
  v_distance NUMERIC;
  v_fare     RECORD;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_me IS NULL OR v_booking.passenger_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;
  IF v_booking.status NOT IN ('accepted', 'in-transit') OR v_booking.driver_id IS NULL THEN
    RAISE EXCEPTION 'The drop-off can only be changed while your driver is on the way or during the ride.';
  END IF;
  IF v_booking.payment_status = 'completed' OR EXISTS (
    SELECT 1 FROM public.ride_payment_submissions p
     WHERE p.booking_id = p_booking_id AND p.status IN ('pending', 'verified')
  ) THEN
    RAISE EXCEPTION 'A payment was already sent for this ride, so the drop-off and fare can no longer change. Ask your driver directly.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.booking_route_changes c
     WHERE c.booking_id = p_booking_id AND c.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Your driver has not answered your last drop-off change yet. Wait for it, or withdraw it first.';
  END IF;
  IF (SELECT count(*) FROM public.booking_route_changes c WHERE c.booking_id = p_booking_id) >= 5 THEN
    RAISE EXCEPTION 'You have reached the limit of 5 drop-off changes for this ride. Talk to your driver.';
  END IF;

  BEGIN
    v_lat := (p_location->>'latitude')::DOUBLE PRECISION;
    v_lng := (p_location->>'longitude')::DOUBLE PRECISION;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Choose a valid drop-off on the map.';
  END;
  IF v_lat IS NULL OR v_lng IS NULL OR abs(v_lat) > 90 OR abs(v_lng) > 180 THEN
    RAISE EXCEPTION 'Choose a valid drop-off on the map.';
  END IF;
  v_address := left(NULLIF(btrim(COALESCE(p_location->>'address', '')), ''), 300);
  v_details := left(NULLIF(btrim(COALESCE(p_location->>'details', '')), ''), 120);
  v_loc := jsonb_build_object('latitude', v_lat, 'longitude', v_lng,
                              'address', COALESCE(v_address, 'Pinned destination'));
  IF v_details IS NOT NULL THEN
    v_loc := v_loc || jsonb_build_object('details', v_details);
  END IF;
  IF p_location ? 'place_id' THEN
    v_loc := v_loc || jsonb_build_object('place_id', left(p_location->>'place_id', 200));
  END IF;

  v_p_lat := (v_booking.pickup_location->>'latitude')::DOUBLE PRECISION;
  v_p_lng := (v_booking.pickup_location->>'longitude')::DOUBLE PRECISION;
  v_d_lat := (v_booking.dropoff_location->>'latitude')::DOUBLE PRECISION;
  v_d_lng := (v_booking.dropoff_location->>'longitude')::DOUBLE PRECISION;
  IF public.km_between(v_d_lat, v_d_lng, v_lat, v_lng) < 0.05 THEN
    RAISE EXCEPTION 'That is the same drop-off as now. Choose a different place.';
  END IF;

  -- During the ride the part already ridden still counts.
  IF v_booking.status = 'in-transit' THEN
    SELECT dl.latitude::DOUBLE PRECISION, dl.longitude::DOUBLE PRECISION
      INTO v_v_lat, v_v_lng
      FROM public.driver_locations dl
     WHERE dl.driver_id = v_booking.driver_id
       AND dl."timestamp"::timestamptz > NOW() - INTERVAL '5 minutes'
     LIMIT 1;
  END IF;
  IF v_v_lat IS NOT NULL AND v_v_lng IS NOT NULL THEN
    v_via := jsonb_build_object('latitude', v_v_lat, 'longitude', v_v_lng);
    v_straight := public.km_between(v_p_lat, v_p_lng, v_v_lat, v_v_lng)
                + public.km_between(v_v_lat, v_v_lng, v_lat, v_lng);
  ELSE
    v_straight := public.km_between(v_p_lat, v_p_lng, v_lat, v_lng);
  END IF;
  v_distance := p_distance;
  IF v_distance IS NULL OR v_distance < v_straight * 0.95 OR v_distance > v_straight * 3 + 2 THEN
    v_distance := v_straight;
  END IF;
  v_distance := ROUND(v_distance, 2);

  SELECT * INTO v_fare FROM public.route_change_fare(v_booking, v_distance);

  INSERT INTO public.booking_route_changes (
    booking_id, requested_by, booking_status,
    old_dropoff_location, old_distance, old_total_fare, old_discount_amount,
    new_dropoff_location, new_distance, new_total_fare, new_discount_amount, new_estimated_duration,
    via_location, status
  ) VALUES (
    v_booking.id, v_me, v_booking.status,
    v_booking.dropoff_location, v_booking.distance, v_booking.total_fare, COALESCE(v_booking.discount_amount, 0),
    v_loc, v_distance, v_fare.total_fare, v_fare.discount_amount, v_fare.estimated_duration,
    v_via, 'pending'
  )
  RETURNING * INTO v_change;

  INSERT INTO public.notifications (user_id, type, title, body, booking_id, read)
  VALUES (
    v_booking.driver_id,
    'booking_update',
    'Passenger wants a new drop-off',
    format('New drop-off: %s. New fare ₱%s (was ₱%s). Open the trip to accept or decline.',
           left(COALESCE(v_address, 'pinned on the map'), 120),
           to_char(v_change.new_total_fare, 'FM999999990.00'),
           to_char(v_change.old_total_fare, 'FM999999990.00')),
    v_booking.id,
    FALSE
  );

  RETURN v_change;
END;
$$;
REVOKE ALL ON FUNCTION public.request_dropoff_change(UUID, JSONB, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_dropoff_change(UUID, JSONB, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_dropoff_change(UUID, JSONB, NUMERIC) TO authenticated;

-- ── 3. Driver: accept / decline ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_dropoff_change(
  p_change_id UUID,
  p_accept    BOOLEAN,
  p_reason    TEXT DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      UUID := public.current_app_user_id();
  v_change  public.booking_route_changes;
  v_booking public.bookings;
  v_fare    RECORD;
  v_reason  TEXT := left(NULLIF(btrim(COALESCE(p_reason, '')), ''), 300);
  v_old_fare     NUMERIC;
  v_old_discount NUMERIC;
BEGIN
  SELECT * INTO v_change FROM public.booking_route_changes WHERE id = p_change_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Drop-off change not found.';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_change.booking_id FOR UPDATE;
  IF NOT FOUND OR v_me IS NULL OR v_booking.driver_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Drop-off change not found.';
  END IF;
  IF v_change.status <> 'pending' THEN
    RAISE EXCEPTION 'This drop-off change was already %.',
      CASE v_change.status WHEN 'cancelled' THEN 'withdrawn by the passenger' ELSE v_change.status END;
  END IF;

  IF NOT COALESCE(p_accept, FALSE) THEN
    UPDATE public.booking_route_changes
       SET status = 'declined', decline_reason = v_reason, decided_at = NOW(), decided_by = v_me
     WHERE id = p_change_id;
    INSERT INTO public.notifications (user_id, type, title, body, booking_id, read)
    VALUES (
      v_booking.passenger_id,
      'booking_update',
      'Drop-off change declined',
      format('Your driver kept the original drop-off%s. Fare stays ₱%s.',
             CASE WHEN v_reason IS NULL THEN '' ELSE ' (' || left(v_reason, 120) || ')' END,
             to_char(v_booking.total_fare, 'FM999999990.00')),
      v_booking.id,
      FALSE
    );
    RETURN v_booking;
  END IF;

  IF v_booking.status NOT IN ('accepted', 'in-transit') THEN
    RAISE EXCEPTION 'This ride is no longer in progress.';
  END IF;
  IF v_booking.payment_status = 'completed' OR EXISTS (
    SELECT 1 FROM public.ride_payment_submissions p
     WHERE p.booking_id = v_booking.id AND p.status IN ('pending', 'verified')
  ) THEN
    RAISE EXCEPTION 'A payment was already sent for this ride, so the fare can no longer change. Decline the request and agree on it with the passenger.';
  END IF;

  -- Price again from the current booking: the discount may have been removed
  -- (081) after the request was sent.
  SELECT * INTO v_fare FROM public.route_change_fare(v_booking, v_change.new_distance);
  v_old_fare := v_booking.total_fare;
  v_old_discount := COALESCE(v_booking.discount_amount, 0);

  PERFORM set_config('smartrike.route_change', 'on', true);
  UPDATE public.bookings
     SET dropoff_location = v_change.new_dropoff_location,
         distance = v_change.new_distance,
         estimated_duration = v_fare.estimated_duration,
         discount_amount = v_fare.discount_amount,
         total_fare = v_fare.total_fare
   WHERE id = v_booking.id
  RETURNING * INTO v_booking;
  PERFORM set_config('smartrike.route_change', 'off', true);

  UPDATE public.booking_route_changes
     SET status = 'accepted',
         -- The audit keeps the fare as it was right before the change.
         old_total_fare = v_old_fare,
         old_discount_amount = v_old_discount,
         new_total_fare = v_fare.total_fare,
         new_discount_amount = v_fare.discount_amount,
         new_estimated_duration = v_fare.estimated_duration,
         decided_at = NOW(),
         decided_by = v_me
   WHERE id = p_change_id;

  INSERT INTO public.notifications (user_id, type, title, body, booking_id, read)
  VALUES (
    v_booking.passenger_id,
    'booking_update',
    'Drop-off changed',
    format('Your driver accepted the new drop-off: %s. New fare ₱%s.',
           left(COALESCE(NULLIF(v_booking.dropoff_location->>'address', ''), 'pinned on the map'), 120),
           to_char(v_booking.total_fare, 'FM999999990.00')),
    v_booking.id,
    FALSE
  );

  RETURN v_booking;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_dropoff_change(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_dropoff_change(UUID, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_dropoff_change(UUID, BOOLEAN, TEXT) TO authenticated;

-- ── 4. Passenger: withdraw ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_dropoff_change(p_change_id UUID)
RETURNS public.booking_route_changes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      UUID := public.current_app_user_id();
  v_change  public.booking_route_changes;
  v_booking public.bookings;
BEGIN
  SELECT * INTO v_change FROM public.booking_route_changes WHERE id = p_change_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Drop-off change not found.';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_change.booking_id;
  IF NOT FOUND OR v_me IS NULL OR v_booking.passenger_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Drop-off change not found.';
  END IF;
  IF v_change.status <> 'pending' THEN
    RAISE EXCEPTION 'Your driver already answered this drop-off change.';
  END IF;

  UPDATE public.booking_route_changes
     SET status = 'cancelled', decided_at = NOW(), decided_by = v_me
   WHERE id = p_change_id
  RETURNING * INTO v_change;

  IF v_booking.driver_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, booking_id, read)
    VALUES (v_booking.driver_id, 'booking_update', 'Drop-off change withdrawn',
            'The passenger kept the original drop-off.', v_booking.id, FALSE);
  END IF;
  RETURN v_change;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_dropoff_change(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_dropoff_change(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_dropoff_change(UUID) TO authenticated;

-- ── 5. A pending request ends with the ride ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_route_changes_on_ride_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.booking_route_changes
       SET status = 'expired', decided_at = NOW()
     WHERE booking_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_route_changes_on_ride_end() FROM PUBLIC;

DROP TRIGGER IF EXISTS expire_route_changes_on_ride_end ON public.bookings;
CREATE TRIGGER expire_route_changes_on_ride_end
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.expire_route_changes_on_ride_end();

-- ── 5b. No online payment while a drop-off change waits ─────────────────────
-- Once a payment proof is sent the fare is frozen, so paying the old fare
-- while the driver still decides would leave the request unanswerable. The
-- passenger waits for the answer (or withdraws it) and then pays the right
-- fare. submit_ride_payment and request_dropoff_change both lock the booking
-- row first, so the two cannot interleave.
CREATE OR REPLACE FUNCTION public.block_ride_payment_during_route_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending')
     AND EXISTS (
       SELECT 1 FROM public.booking_route_changes c
        WHERE c.booking_id = NEW.booking_id AND c.status = 'pending'
     ) THEN
    RAISE EXCEPTION 'Your driver has not answered your drop-off change yet. Wait for the answer, or withdraw the request, so you pay the right fare.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.block_ride_payment_during_route_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS block_ride_payment_during_route_change ON public.ride_payment_submissions;
CREATE TRIGGER block_ride_payment_during_route_change
  BEFORE INSERT OR UPDATE OF status ON public.ride_payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.block_ride_payment_during_route_change();

-- ── 6. Financial field guard (081 + route fields) ───────────────────────────
CREATE OR REPLACE FUNCTION public.protect_booking_financial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_me UUID := public.current_app_user_id();
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  -- 081: set only inside revert_booking_discount for its own UPDATE.
  IF current_setting('smartrike.discount_revert', true) = 'on' THEN RETURN NEW; END IF;
  -- 087: set only inside respond_dropoff_change for its own UPDATE.
  IF current_setting('smartrike.route_change', true) = 'on' THEN RETURN NEW; END IF;

  IF NEW.passenger_id IS DISTINCT FROM OLD.passenger_id
     OR NEW.total_fare IS DISTINCT FROM OLD.total_fare
     OR NEW.base_fare IS DISTINCT FROM OLD.base_fare
     OR NEW.per_km_rate IS DISTINCT FROM OLD.per_km_rate
     OR NEW.peak_hour_multiplier IS DISTINCT FROM OLD.peak_hour_multiplier
     OR NEW.passenger_count IS DISTINCT FROM OLD.passenger_count
     OR NEW.passenger_type IS DISTINCT FROM OLD.passenger_type
     OR NEW.discount_pct IS DISTINCT FROM OLD.discount_pct
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.discount_revoked_at IS DISTINCT FROM OLD.discount_revoked_at
     OR NEW.discount_revoked_reason IS DISTINCT FROM OLD.discount_revoked_reason
     -- 087: the route only changes through request/respond_dropoff_change.
     OR NEW.pickup_location IS DISTINCT FROM OLD.pickup_location
     OR NEW.dropoff_location IS DISTINCT FROM OLD.dropoff_location
     OR NEW.distance IS DISTINCT FROM OLD.distance THEN
    RAISE EXCEPTION 'Ride ownership, route and fare fields cannot be changed.';
  END IF;

  IF NEW.driver_id IS DISTINCT FROM OLD.driver_id AND NOT (
    OLD.driver_id IS NULL AND OLD.status = 'pending'
    AND NEW.driver_id = v_me AND NEW.status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'The assigned driver cannot be replaced.';
  END IF;

  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method AND NOT (
    OLD.payment_method = 'online' AND NEW.payment_method = 'cash'
    AND OLD.passenger_id = v_me AND OLD.payment_status = 'pending'
    AND OLD.status NOT IN ('cancelled', 'completed')
    AND NOT EXISTS (
      SELECT 1 FROM public.ride_payment_submissions p
      WHERE p.booking_id = OLD.id AND p.status IN ('pending', 'verified')
    )
  ) THEN
    RAISE EXCEPTION 'This ride payment method cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

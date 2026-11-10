-- =============================================================================
-- 089 · Senior / PWD / student discount needs the driver's approval (D5 follow-up)
-- -----------------------------------------------------------------------------
--  Senior citizen, PWD and student passengers show their physical ID to the
--  driver at pickup. No ID photo is uploaded or stored any more. The discount
--  is NOT taken off at booking: the ride is priced at the regular fare until
--  the driver who accepted the ride approves the ID. No ID → no discount.
--
--  1. bookings.discount_status: NULL (regular fare), 'pending' (waiting for
--     the driver), 'approved', 'rejected'; discount_reviewed_at and
--     discount_reviewed_by (who decided). Existing discounted bookings are
--     backfilled as 'approved'.
--  2. enforce_booking_insert (080): senior / PWD / student → discount 0 +
--     'pending'. Nothing is taken off at booking any more.
--  3. review_booking_discount(booking, approve, reason): the assigned driver,
--     while accepted or in-transit and before any ride payment was sent.
--     Approve: 20% of one passenger's share comes off total_fare (same rule as
--     route_change_fare, 087). Reject: the regular fare stays and the reason is
--     kept in discount_revoked_reason. The passenger is notified either way.
--  4. No online payment proof and no "completed" while the review is pending,
--     so the passenger always pays the decided fare.
--  5. protect_booking_financial_fields (087) also locks the review columns
--     and lets review_booking_discount change total_fare.
--  6. ID photos (081) are retired: attach_discount_id can no longer be called,
--     and photos uploaded before 089 are visible only to that passenger and
--     admins (no longer to every driver who could see the open request).
--
-- Apply after 088. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount_status TEXT,
  ADD COLUMN IF NOT EXISTS discount_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_reviewed_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.bookings'::regclass
       AND conname = 'bookings_discount_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_discount_status_check
      CHECK (discount_status IS NULL OR discount_status IN ('pending', 'approved', 'rejected'));
  END IF;
END;
$$;

-- Bookings made before 089 already carry their discount.
UPDATE public.bookings
   SET discount_status = CASE WHEN discount_revoked_at IS NOT NULL THEN 'rejected' ELSE 'approved' END
 WHERE discount_status IS NULL
   AND COALESCE(passenger_type, 'regular') <> 'regular';

-- ── 2. Insert trigger (080 + pending review) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_booking_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cfg        RECORD;
  v_has_cfg    BOOLEAN;
  v_base       NUMERIC := 120;
  v_per_km     NUMERIC := 10;
  v_mult       NUMERIC := 1;
  v_lat1       DOUBLE PRECISION;
  v_lng1       DOUBLE PRECISION;
  v_lat2       DOUBLE PRECISION;
  v_lng2       DOUBLE PRECISION;
  v_straight   NUMERIC;
  v_km         INTEGER;
  v_route      NUMERIC;
  v_hour       NUMERIC;
  v_pct        NUMERIC := 0;
  v_discount   NUMERIC := 0;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.passenger_id = NEW.passenger_id
      AND b.status IN ('pending', 'accepted', 'in-transit')
  ) THEN
    RAISE EXCEPTION 'You already have an active ride. Finish or cancel it before booking another.';
  END IF;

  BEGIN
    v_lat1 := (NEW.pickup_location->>'latitude')::DOUBLE PRECISION;
    v_lng1 := (NEW.pickup_location->>'longitude')::DOUBLE PRECISION;
    v_lat2 := (NEW.dropoff_location->>'latitude')::DOUBLE PRECISION;
    v_lng2 := (NEW.dropoff_location->>'longitude')::DOUBLE PRECISION;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Pickup and drop-off need valid map locations.';
  END;
  IF v_lat1 IS NULL OR v_lng1 IS NULL OR v_lat2 IS NULL OR v_lng2 IS NULL
     OR abs(v_lat1) > 90 OR abs(v_lat2) > 90 OR abs(v_lng1) > 180 OR abs(v_lng2) > 180 THEN
    RAISE EXCEPTION 'Pickup and drop-off need valid map locations.';
  END IF;

  -- Straight-line distance is the floor; the app's road distance is accepted
  -- when it is plausible (roads are longer, but not 3x + 2 km longer).
  v_straight := 6371 * 2 * asin(sqrt(
    power(sin(radians(v_lat2 - v_lat1) / 2), 2)
    + cos(radians(v_lat1)) * cos(radians(v_lat2)) * power(sin(radians(v_lng2 - v_lng1) / 2), 2)
  ));
  IF NEW.distance IS NULL OR NEW.distance < v_straight * 0.95 OR NEW.distance > v_straight * 3 + 2 THEN
    NEW.distance := ROUND(v_straight, 2);
  END IF;

  SELECT base_fare, per_km_rate, peak_hour_multiplier, peak_hours_enabled
    INTO v_cfg
    FROM public.fare_matrix
   ORDER BY id
   LIMIT 1;
  v_has_cfg := FOUND;
  IF v_has_cfg THEN
    v_base := COALESCE(v_cfg.base_fare, 120);
    v_per_km := COALESCE(v_cfg.per_km_rate, 10);
    v_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Manila'))
            + EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Asia/Manila')) / 60.0;
    IF COALESCE(v_cfg.peak_hours_enabled, FALSE) AND v_hour >= 6.5 AND v_hour < 9 THEN
      v_mult := COALESCE(v_cfg.peak_hour_multiplier, 1);
    END IF;
  END IF;

  -- Same formula as FareCalculationService.calculateFareForPassengers.
  v_km := GREATEST(1, CEIL(COALESCE(NEW.distance, 0)))::INTEGER;
  v_route := ROUND((v_base + (v_km - 1) * v_per_km) * v_mult, 2);
  IF NEW.ride_type = 'priority' THEN
    v_route := v_route + GREATEST(12, v_route * 0.15);
  END IF;

  NEW.passenger_count := LEAST(5, GREATEST(1, COALESCE(NEW.passenger_count, 1)));
  NEW.base_fare := v_base;
  NEW.per_km_rate := v_per_km;
  NEW.peak_hour_multiplier := v_mult;
  -- 080: passenger discount, 20% of ONE passenger's share (senior RA 9994,
  -- PWD RA 10754, student RA 11314). Same rule as FareCalculationService.quoteFare.
  -- 089: senior, PWD and student wait for the accepting driver to approve the
  -- ID, so they book at the regular fare (pct 0) with discount_status =
  -- 'pending'; review_booking_discount applies the 20% on approval.
  NEW.passenger_type := COALESCE(NULLIF(NEW.passenger_type, ''), 'regular');
  v_pct := 0;
  v_discount := ROUND(ROUND(v_route, 2) * v_pct / 100, 2);
  NEW.discount_pct := v_pct;
  NEW.discount_amount := v_discount;
  NEW.discount_status := CASE
    WHEN NEW.passenger_type IN ('senior', 'pwd', 'student') THEN 'pending'
    ELSE NULL
  END;
  NEW.discount_reviewed_at := NULL;
  NEW.discount_reviewed_by := NULL;
  NEW.discount_revoked_at := NULL;
  NEW.discount_revoked_reason := NULL;
  NEW.total_fare := ROUND(v_route * NEW.passenger_count - v_discount, 2);
  NEW.estimated_duration := CEIL(NEW.distance / 30 * 60);

  NEW.status := 'pending';
  NEW.driver_id := NULL;
  NEW.payment_status := 'pending';
  NEW.accepted_at := NULL;
  NEW.started_at := NULL;
  NEW.completed_at := NULL;
  NEW.passenger_rating := NULL;
  NEW.driver_rating := NULL;
  RETURN NEW;
END;
$$;


-- ── 3. Driver approves or rejects the ID ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_booking_discount(p_booking_id UUID, p_approve BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      UUID := public.current_app_user_id();
  v_booking public.bookings;
  v_priced  public.bookings;
  v_fare    RECORD;
  v_reason  TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_label   TEXT;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_me IS NULL OR v_booking.driver_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;
  IF v_booking.status NOT IN ('accepted', 'in-transit') THEN
    RAISE EXCEPTION 'The ID can only be checked during the ride.';
  END IF;
  IF v_booking.discount_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'This ride has no discount ID waiting for your answer.';
  END IF;
  IF v_booking.payment_status = 'completed' OR EXISTS (
    SELECT 1 FROM public.ride_payment_submissions p
     WHERE p.booking_id = p_booking_id AND p.status IN ('pending', 'verified')
  ) THEN
    RAISE EXCEPTION 'A payment was already sent for this ride, so the fare can no longer change.';
  END IF;
  IF NOT COALESCE(p_approve, FALSE) AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Give the reason the ID was not accepted.';
  END IF;

  v_label := CASE v_booking.passenger_type
    WHEN 'senior' THEN 'Senior citizen' WHEN 'pwd' THEN 'PWD' WHEN 'student' THEN 'Student' ELSE 'Fare' END;

  PERFORM set_config('smartrike.discount_review', 'on', true);
  IF COALESCE(p_approve, FALSE) THEN
    -- Same fare rule as booking and drop-off changes, now with the 20%.
    v_priced := v_booking;
    v_priced.discount_pct := 20;
    SELECT * INTO v_fare FROM public.route_change_fare(v_priced, v_booking.distance);
    UPDATE public.bookings
       SET discount_pct = 20,
           discount_amount = v_fare.discount_amount,
           total_fare = v_fare.total_fare,
           discount_status = 'approved',
           discount_reviewed_at = NOW(),
           discount_reviewed_by = v_me
     WHERE id = p_booking_id
    RETURNING * INTO v_booking;
  ELSE
    UPDATE public.bookings
       SET discount_status = 'rejected',
           discount_reviewed_at = NOW(),
           discount_reviewed_by = v_me,
           discount_revoked_at = NOW(),
           discount_revoked_reason = left(v_reason, 300)
     WHERE id = p_booking_id
    RETURNING * INTO v_booking;
  END IF;
  PERFORM set_config('smartrike.discount_review', 'off', true);

  INSERT INTO public.notifications (user_id, type, title, body, booking_id, read)
  VALUES (
    v_booking.passenger_id,
    'booking_update',
    CASE WHEN v_booking.discount_status = 'approved'
         THEN v_label || ' discount approved'
         ELSE v_label || ' discount not approved' END,
    CASE WHEN v_booking.discount_status = 'approved'
         THEN format('Your driver approved your ID. ₱%s was taken off; you pay ₱%s.',
                     to_char(v_booking.discount_amount, 'FM999999990.00'),
                     to_char(v_booking.total_fare, 'FM999999990.00'))
         ELSE format('Your driver could not accept the ID (%s). The regular fare applies: ₱%s.',
                     left(v_reason, 120), to_char(v_booking.total_fare, 'FM999999990.00')) END,
    v_booking.id,
    FALSE
  );

  RETURN v_booking;
END;
$$;
REVOKE ALL ON FUNCTION public.review_booking_discount(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_booking_discount(UUID, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_booking_discount(UUID, BOOLEAN, TEXT) TO authenticated;

-- ── 4. Pay / finish only after the ID is decided ────────────────────────────
CREATE OR REPLACE FUNCTION public.block_ride_payment_during_discount_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending')
     AND EXISTS (
       SELECT 1 FROM public.bookings b
        WHERE b.id = NEW.booking_id AND b.discount_status = 'pending'
     ) THEN
    RAISE EXCEPTION 'Your driver has not checked your discount ID yet. Wait for the answer so you pay the right fare.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.block_ride_payment_during_discount_review() FROM PUBLIC;

DROP TRIGGER IF EXISTS block_ride_payment_during_discount_review ON public.ride_payment_submissions;
CREATE TRIGGER block_ride_payment_during_discount_review
  BEFORE INSERT OR UPDATE OF status ON public.ride_payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.block_ride_payment_during_discount_review();

CREATE OR REPLACE FUNCTION public.block_completion_during_discount_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND OLD.discount_status = 'pending' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Approve or reject the passenger''s discount ID before finishing the ride.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.block_completion_during_discount_review() FROM PUBLIC;

DROP TRIGGER IF EXISTS block_completion_during_discount_review ON public.bookings;
CREATE TRIGGER block_completion_during_discount_review
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.block_completion_during_discount_review();

-- ── 5. Financial field guard (087 + review columns) ─────────────────────────
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
  -- 089: set only inside review_booking_discount for its own UPDATE.
  IF current_setting('smartrike.discount_review', true) = 'on' THEN RETURN NEW; END IF;

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
     -- 089: the ID review only changes through review_booking_discount.
     OR NEW.discount_status IS DISTINCT FROM OLD.discount_status
     OR NEW.discount_reviewed_at IS DISTINCT FROM OLD.discount_reviewed_at
     OR NEW.discount_reviewed_by IS DISTINCT FROM OLD.discount_reviewed_by
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

-- ── 6. Retire ID photos (081) ───────────────────────────────────────────────
-- The driver checks the physical ID, so no new photos are taken in.
DO $$
BEGIN
  IF to_regprocedure('public.attach_discount_id(uuid, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.attach_discount_id(UUID, TEXT) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regclass('public.booking_discount_ids') IS NOT NULL THEN
    -- Older photos: only the passenger who uploaded it and admins.
    DROP POLICY IF EXISTS "View discount ID with its booking" ON public.booking_discount_ids;
    DROP POLICY IF EXISTS "Passenger or admin views discount ID" ON public.booking_discount_ids;
    CREATE POLICY "Passenger or admin views discount ID" ON public.booking_discount_ids
      FOR SELECT USING (
        public.is_admin() OR EXISTS (
          SELECT 1 FROM public.bookings b
           WHERE b.id = booking_discount_ids.booking_id
             AND b.passenger_id = public.current_app_user_id()
        )
      );
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

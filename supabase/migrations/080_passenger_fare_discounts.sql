-- =============================================================================
-- 080 · Passenger fare discounts (senior citizen, PWD, student)
-- -----------------------------------------------------------------------------
--  1. bookings.passenger_type (regular / senior / pwd / student),
--     discount_pct and discount_amount. total_fare stays what the passenger
--     pays, now net of the discount.
--  2. enforce_booking_insert (068) recomputes the discount server-side, so a
--     client cannot send its own amount: 20% off one passenger's share of the
--     fare (RA 9994 senior citizens, RA 10754 PWD, RA 11314 students). The
--     driver checks the ID at pickup. Everything else in the function is
--     unchanged from 068.
--
-- Keep in step with PASSENGER_DISCOUNT_PCT (src/config/constants.ts) and
-- FareCalculationService.quoteFare.
-- Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS passenger_type TEXT NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.bookings'::regclass
       AND conname = 'bookings_passenger_type_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_passenger_type_check
      CHECK (passenger_type IN ('regular', 'senior', 'pwd', 'student'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.bookings'::regclass
       AND conname = 'bookings_discount_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_discount_check
      CHECK (discount_pct BETWEEN 0 AND 100 AND discount_amount >= 0);
  END IF;
END;
$$;

-- ── 2. Server-side pricing (068 + discount) ─────────────────────────────────
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
  NEW.passenger_type := COALESCE(NULLIF(NEW.passenger_type, ''), 'regular');
  v_pct := CASE WHEN NEW.passenger_type IN ('senior', 'pwd', 'student') THEN 20 ELSE 0 END;
  v_discount := ROUND(ROUND(v_route, 2) * v_pct / 100, 2);
  NEW.discount_pct := v_pct;
  NEW.discount_amount := v_discount;
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

COMMIT;

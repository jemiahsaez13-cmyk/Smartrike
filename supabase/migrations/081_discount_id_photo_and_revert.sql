-- =============================================================================
-- 081 · Discount ID photo and "ID not valid" fare revert (D5)
-- -----------------------------------------------------------------------------
--  1. booking_discount_ids: one ID photo per discounted booking (required by
--     the app for Student, optional otherwise). Kept out of `bookings` so the
--     photo is not sent with every booking query and realtime update.
--     Anyone who can see the booking (passenger, assigned driver, drivers
--     viewing the open request, admins) can see its photo; RLS on `bookings`
--     decides.
--  2. attach_discount_id(booking, image): the passenger's only upload path,
--     while the booking is still pending.
--  3. bookings.discount_revoked_at / discount_revoked_reason and
--     revert_booking_discount(booking, reason): the assigned driver removes
--     the discount when the ID is missing or not valid. total_fare goes back to
--     the regular fare and the passenger is notified. Not allowed once a ride
--     payment was submitted or the ride is completed.
--  4. protect_booking_financial_fields (040) also locks the discount columns,
--     and lets revert_booking_discount change total_fare.
--
-- Apply after 080. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. ID photo table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_discount_ids (
  booking_id  UUID PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL CHECK (
    image_url ~ '^data:image/(jpeg|png|webp);base64,'
    AND length(image_url) <= 3600000
  ),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.booking_discount_ids ENABLE ROW LEVEL SECURITY;

-- The subquery runs under the caller's own RLS on bookings.
DROP POLICY IF EXISTS "View discount ID with its booking" ON public.booking_discount_ids;
CREATE POLICY "View discount ID with its booking" ON public.booking_discount_ids
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_discount_ids.booking_id)
  );
-- No INSERT/UPDATE/DELETE policies: writes go through attach_discount_id.

-- ── 2. Upload ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attach_discount_id(p_booking_id UUID, p_image TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      UUID := public.current_app_user_id();
  v_booking RECORD;
BEGIN
  SELECT id, passenger_id, status, passenger_type
    INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id;
  IF NOT FOUND OR v_me IS NULL OR v_booking.passenger_id <> v_me THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;
  IF v_booking.passenger_type = 'regular' THEN
    RAISE EXCEPTION 'This booking has no fare discount.';
  END IF;
  IF v_booking.status <> 'pending' THEN
    RAISE EXCEPTION 'The ID can only be added while the ride is waiting for a driver.';
  END IF;
  IF p_image IS NULL OR p_image !~ '^data:image/(jpeg|png|webp);base64,' OR length(p_image) > 3600000 THEN
    RAISE EXCEPTION 'Choose a JPEG, PNG, or WebP image under 2.5 MB.';
  END IF;

  INSERT INTO public.booking_discount_ids (booking_id, image_url, uploaded_at)
  VALUES (p_booking_id, p_image, NOW())
  ON CONFLICT (booking_id) DO UPDATE
    SET image_url = EXCLUDED.image_url, uploaded_at = EXCLUDED.uploaded_at;
END;
$$;
REVOKE ALL ON FUNCTION public.attach_discount_id(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_discount_id(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.attach_discount_id(UUID, TEXT) TO authenticated;

-- ── 3. Driver: ID not valid → regular fare ──────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount_revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_revoked_reason TEXT;

CREATE OR REPLACE FUNCTION public.revert_booking_discount(p_booking_id UUID, p_reason TEXT)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      UUID := public.current_app_user_id();
  v_booking public.bookings;
  v_reason  TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_me IS NULL OR v_booking.driver_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;
  IF v_booking.status NOT IN ('accepted', 'in-transit') THEN
    RAISE EXCEPTION 'The fare can only be changed during the ride.';
  END IF;
  IF COALESCE(v_booking.discount_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'This ride has no discount to remove.';
  END IF;
  IF v_booking.payment_status = 'completed' OR EXISTS (
    SELECT 1 FROM public.ride_payment_submissions p
     WHERE p.booking_id = p_booking_id AND p.status IN ('pending', 'verified')
  ) THEN
    RAISE EXCEPTION 'A payment was already sent for this ride, so the fare can no longer change.';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Give the reason for removing the discount.';
  END IF;

  PERFORM set_config('smartrike.discount_revert', 'on', true);
  UPDATE public.bookings
     SET total_fare = ROUND(total_fare + discount_amount, 2),
         discount_amount = 0,
         discount_pct = 0,
         discount_revoked_at = NOW(),
         discount_revoked_reason = left(v_reason, 300)
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;
  PERFORM set_config('smartrike.discount_revert', 'off', true);

  INSERT INTO public.notifications (user_id, type, title, body, booking_id, read)
  VALUES (
    v_booking.passenger_id,
    'booking_update',
    'Fare discount removed',
    format('Your driver could not accept the ID (%s). The regular fare applies: ₱%s.',
           left(v_reason, 120), to_char(v_booking.total_fare, 'FM999999990.00')),
    v_booking.id,
    FALSE
  );

  RETURN v_booking;
END;
$$;
REVOKE ALL ON FUNCTION public.revert_booking_discount(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revert_booking_discount(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.revert_booking_discount(UUID, TEXT) TO authenticated;

-- ── 4. Financial field guard (040 + discount columns) ───────────────────────
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
     OR NEW.discount_revoked_reason IS DISTINCT FROM OLD.discount_revoked_reason THEN
    RAISE EXCEPTION 'Ride ownership and fare fields cannot be changed.';
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

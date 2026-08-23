-- Follow-up integrity rules for online ride completion and user reports.

CREATE OR REPLACE FUNCTION public.handle_booking_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF COALESCE(NEW.payment_method, 'cash') = 'online' AND NEW.payment_status <> 'completed' THEN
      RAISE EXCEPTION 'Online payment must be verified before completing the ride.';
    END IF;
    IF NEW.driver_id IS NOT NULL THEN
      UPDATE public.users SET total_trips = COALESCE(total_trips, 0) + 1,
        completed_trips = COALESCE(completed_trips, 0) + 1,
        total_earnings = COALESCE(total_earnings, 0)
          + CASE WHEN COALESCE(NEW.payment_method, 'cash') <> 'online' THEN COALESCE(NEW.total_fare, 0) ELSE 0 END,
        current_status = 'online' WHERE id = NEW.driver_id;
    END IF;
    IF NEW.passenger_id IS NOT NULL THEN
      UPDATE public.users SET total_trips = COALESCE(total_trips, 0) + 1 WHERE id = NEW.passenger_id;
    END IF;
    IF COALESCE(NEW.payment_method, 'cash') <> 'online' THEN
      INSERT INTO public.transactions (booking_id, passenger_id, driver_id, amount, payment_method, status, completed_at)
        VALUES (NEW.id, NEW.passenger_id, NEW.driver_id, COALESCE(NEW.total_fare, 0),
          COALESCE(NEW.payment_method, 'cash'), 'completed', NOW())
        ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL DO NOTHING;
    END IF;
    IF COALESCE(NEW.payment_method, 'cash') = 'cash' THEN NEW.payment_status := 'completed'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.switch_ride_payment_to_cash(p_booking_id UUID)
RETURNS SETOF public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_booking public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF v_booking.id IS NULL OR v_booking.passenger_id IS DISTINCT FROM public.current_app_user_id() THEN
    RAISE EXCEPTION 'You cannot change payment for this ride.';
  END IF;
  IF v_booking.status IN ('cancelled', 'completed') OR v_booking.payment_status = 'completed' THEN
    RAISE EXCEPTION 'Payment can no longer be changed for this ride.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ride_payment_submissions WHERE booking_id = p_booking_id AND status IN ('pending', 'verified')) THEN
    RAISE EXCEPTION 'A payment proof is already pending or verified.';
  END IF;
  RETURN QUERY UPDATE public.bookings SET payment_method = 'cash' WHERE id = p_booking_id RETURNING *;
END;
$$;
GRANT EXECUTE ON FUNCTION public.switch_ride_payment_to_cash(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users file own reports" ON public.reports;
CREATE POLICY "Users file own reports" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (
    reporter_id = public.current_app_user_id()
    AND reporter_id <> reported_id
    AND booking_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (
          (reporter_role = 'passenger' AND b.passenger_id = reporter_id AND b.driver_id = reported_id)
          OR (reporter_role = 'driver' AND b.driver_id = reporter_id AND b.passenger_id = reported_id)
        )
    )
  );

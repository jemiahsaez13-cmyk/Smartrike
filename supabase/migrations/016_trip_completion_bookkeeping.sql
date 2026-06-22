-- =============================================================================
-- 016 · Trip completion + rating bookkeeping (server-side, authoritative)
-- -----------------------------------------------------------------------------
-- Keeps the books consistent no matter which client writes the booking, using
-- SECURITY DEFINER triggers (bypass RLS) on the bookings table:
--
--   • BEFORE UPDATE — when a booking flips to 'completed':
--       - driver:    total_trips +1, completed_trips +1, total_earnings += fare,
--                    current_status back to 'online'
--       - passenger: total_trips +1
--       - a matching 'completed' transaction row is recorded (once)
--       - the booking row is marked paid in the same write
--   • AFTER UPDATE — when a passenger rating (JSONB {stars,...}) is added/changed:
--       - the driver's rating is recomputed as the average of all their rated
--         trips (the AFTER timing ensures the new rating is included).
--
-- Idempotent: safe to run more than once.
-- =============================================================================

-- ── Completion bookkeeping (BEFORE so we can set payment_status in-row) ───────
CREATE OR REPLACE FUNCTION public.handle_booking_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF NEW.driver_id IS NOT NULL THEN
      UPDATE public.users
         SET total_trips     = COALESCE(total_trips, 0) + 1,
             completed_trips = COALESCE(completed_trips, 0) + 1,
             total_earnings  = COALESCE(total_earnings, 0) + COALESCE(NEW.total_fare, 0),
             current_status  = 'online'
       WHERE id = NEW.driver_id;
    END IF;

    IF NEW.passenger_id IS NOT NULL THEN
      UPDATE public.users
         SET total_trips = COALESCE(total_trips, 0) + 1
       WHERE id = NEW.passenger_id;
    END IF;

    -- Record the fare as a settled transaction (once per booking).
    INSERT INTO public.transactions
      (booking_id, passenger_id, driver_id, amount, payment_method, status, completed_at)
    SELECT NEW.id, NEW.passenger_id, NEW.driver_id, COALESCE(NEW.total_fare, 0),
           COALESCE(NEW.payment_method, 'cash'), 'completed', NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.booking_id = NEW.id);

    NEW.payment_status := 'paid';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_completion ON public.bookings;
CREATE TRIGGER on_booking_completion
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_booking_completion();

-- ── Driver rating recompute (AFTER so the new rating is counted) ─────────────
CREATE OR REPLACE FUNCTION public.handle_driver_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.passenger_rating IS NOT NULL
     AND NEW.passenger_rating IS DISTINCT FROM OLD.passenger_rating
     AND NEW.driver_id IS NOT NULL
     AND (NEW.passenger_rating->>'stars') ~ '^[0-9.]+$' THEN
    UPDATE public.users d
       SET rating = ROUND((
             SELECT AVG((b.passenger_rating->>'stars')::numeric)
               FROM public.bookings b
              WHERE b.driver_id = NEW.driver_id
                AND b.passenger_rating IS NOT NULL
                AND (b.passenger_rating->>'stars') ~ '^[0-9.]+$'
           ), 2)
     WHERE d.id = NEW.driver_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_driver_rating ON public.bookings;
CREATE TRIGGER on_driver_rating
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_driver_rating();

-- =============================================================================
-- 024_fix_booking_completion_payment_status.sql
--
-- BUG: the BEFORE-UPDATE trigger handle_booking_completion() set
--      NEW.payment_status := 'paid', but bookings has
--      CHECK (payment_status IN ('pending','completed')).
-- Result: EVERY trip completion failed with
--      23514 violates check constraint "bookings_payment_status_check"  (HTTP 400),
-- so drivers could never mark a trip complete (cash OR e-money).
--
-- Fix: use 'completed' — the value the app's TS type and the e-money settlement
-- RPC (021) already use.
--
-- SECOND BUG fixed here too: the trigger marked EVERY booking 'completed' on
-- completion, including GCash/Maya ones. That ran before BookingService.
-- completeTrip() calls pay_trip_with_emoney(), which then saw payment_status
-- already 'completed' and returned 'already_paid' WITHOUT debiting the wallet —
-- so e-money fares were never actually collected. We now auto-settle only CASH
-- on completion; e-money stays 'pending' until the RPC moves the funds (the RPC
-- sets it to 'completed' once the wallet debit + driver payout succeed).
--
-- Idempotent: CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_booking_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

    -- Cash is settled in person on completion. E-money (gcash/paymaya/maya)
    -- stays 'pending' so pay_trip_with_emoney() can debit the wallet; that RPC
    -- flips it to 'completed' only after the funds actually move.
    IF COALESCE(NEW.payment_method, 'cash') = 'cash' THEN
      NEW.payment_status := 'completed';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

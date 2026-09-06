-- A passenger can update their booking, but cannot update the driver's profile.
-- Release the driver in the same transaction as cancellation under trigger authority.
BEGIN;
CREATE OR REPLACE FUNCTION public.release_driver_after_ride_cancellation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('pending', 'accepted') AND NEW.status = 'cancelled'
     AND NEW.driver_id IS NOT NULL THEN
    UPDATE public.users u SET current_status =
      CASE WHEN u.status = 'active' AND u.verification_status = 'verified' THEN 'online' ELSE 'offline' END
    WHERE u.id = NEW.driver_id AND u.current_status = 'on-trip'
      AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.driver_id = u.id
        AND b.id <> NEW.id AND b.status IN ('accepted', 'in-transit'));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.release_driver_after_ride_cancellation() FROM PUBLIC;
DROP TRIGGER IF EXISTS release_driver_after_ride_cancellation ON public.bookings;
CREATE TRIGGER release_driver_after_ride_cancellation AFTER UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.release_driver_after_ride_cancellation();
COMMIT;

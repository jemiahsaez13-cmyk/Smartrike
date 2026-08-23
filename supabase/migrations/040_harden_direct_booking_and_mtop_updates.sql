-- Prevent crafted participant updates from mutating ride financial ownership,
-- and block approve+decline MTOP payloads in a single request.

CREATE OR REPLACE FUNCTION public.protect_booking_financial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_me UUID := public.current_app_user_id();
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;

  IF NEW.passenger_id IS DISTINCT FROM OLD.passenger_id
     OR NEW.total_fare IS DISTINCT FROM OLD.total_fare
     OR NEW.base_fare IS DISTINCT FROM OLD.base_fare
     OR NEW.per_km_rate IS DISTINCT FROM OLD.per_km_rate
     OR NEW.peak_hour_multiplier IS DISTINCT FROM OLD.peak_hour_multiplier
     OR NEW.passenger_count IS DISTINCT FROM OLD.passenger_count THEN
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

DROP TRIGGER IF EXISTS protect_booking_financial_fields_trigger ON public.bookings;
CREATE TRIGGER protect_booking_financial_fields_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.protect_booking_financial_fields();

CREATE OR REPLACE FUNCTION public.prevent_approved_mtop_decline()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'rejected' AND (
    OLD.documents_verified_at IS NOT NULL
    OR NEW.documents_verified_at IS NOT NULL
    OR public.mtop_documents_are_approved(OLD.documents)
    OR public.mtop_documents_are_approved(NEW.documents)
  ) THEN
    RAISE EXCEPTION 'Approved MTOP files cannot be declined.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_approved_mtop_decline_trigger ON public.franchise_applications;
CREATE TRIGGER prevent_approved_mtop_decline_trigger
  BEFORE UPDATE ON public.franchise_applications
  FOR EACH ROW EXECUTE FUNCTION public.prevent_approved_mtop_decline();

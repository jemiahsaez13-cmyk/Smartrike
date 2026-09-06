-- Repair deployments whose submit_ride_payment function writes display-only
-- passenger_name/driver_name fields absent from ride_payment_submissions.
-- This restores the canonical RPC without deleting payment records or adding
-- redundant name columns. Requires the payment schema from migration 038.
BEGIN;

-- PostgreSQL cannot rename input parameters with CREATE OR REPLACE.
-- Drop only this exact overload, without CASCADE. A dependency blocks the
-- transaction instead of deleting dependent objects; records are untouched.
DROP FUNCTION IF EXISTS public.submit_ride_payment(UUID, UUID, TEXT, TEXT);

CREATE FUNCTION public.submit_ride_payment(
  p_booking_id UUID, p_method_id UUID, p_reference TEXT, p_proof_url TEXT
)
RETURNS SETOF public.ride_payment_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_method public.driver_payment_methods%ROWTYPE;
  v_existing public.ride_payment_submissions%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF v_booking.id IS NULL OR v_booking.passenger_id IS DISTINCT FROM public.current_app_user_id() THEN
    RAISE EXCEPTION 'You cannot submit payment for this ride.';
  END IF;
  IF v_booking.driver_id IS NULL OR v_booking.payment_method <> 'online' OR v_booking.status IN ('pending', 'cancelled') THEN
    RAISE EXCEPTION 'This ride is not eligible for online payment.';
  END IF;
  IF v_booking.payment_status = 'completed' THEN RAISE EXCEPTION 'This ride is already paid.'; END IF;
  SELECT * INTO v_method FROM public.driver_payment_methods
    WHERE id = p_method_id AND driver_id = v_booking.driver_id AND is_enabled;
  IF v_method.id IS NULL THEN RAISE EXCEPTION 'The selected driver payment method is unavailable.'; END IF;
  IF btrim(COALESCE(p_reference, '')) !~ '^[A-Za-z0-9][A-Za-z0-9 _-]{5,63}$' THEN
    RAISE EXCEPTION 'Enter a valid payment reference (6 to 64 characters).';
  END IF;
  IF COALESCE(p_proof_url, '') !~ '^data:image/(jpeg|jpg|png|webp);base64,' OR octet_length(p_proof_url) > 3500000 THEN
    RAISE EXCEPTION 'Upload a valid payment screenshot under 2.5 MB.';
  END IF;
  SELECT * INTO v_existing FROM public.ride_payment_submissions WHERE booking_id = p_booking_id FOR UPDATE;
  IF v_existing.id IS NOT NULL AND v_existing.status IN ('pending', 'verified') THEN
    RAISE EXCEPTION 'A payment has already been submitted for this ride.';
  END IF;

  IF v_existing.id IS NULL THEN
    RETURN QUERY INSERT INTO public.ride_payment_submissions (
      booking_id, passenger_id, driver_id, driver_payment_method_id,
      payment_details_snapshot, amount, payment_reference, proof_url
    ) VALUES (
      v_booking.id, v_booking.passenger_id, v_booking.driver_id, v_method.id,
      jsonb_build_object('method_type', v_method.method_type, 'display_name', v_method.display_name,
        'account_name', v_method.account_name, 'account_number', v_method.account_number,
        'instructions', v_method.instructions),
      v_booking.total_fare, btrim(p_reference), p_proof_url
    ) RETURNING *;
  ELSE
    RETURN QUERY UPDATE public.ride_payment_submissions
      SET driver_payment_method_id = v_method.id,
          payment_details_snapshot = jsonb_build_object('method_type', v_method.method_type,
            'display_name', v_method.display_name, 'account_name', v_method.account_name,
            'account_number', v_method.account_number, 'instructions', v_method.instructions),
          amount = v_booking.total_fare, payment_reference = btrim(p_reference), proof_url = p_proof_url,
          status = 'pending', rejection_reason = NULL, submitted_at = NOW(), reviewed_at = NULL,
          reviewed_by = NULL, reviewed_by_role = NULL, updated_at = NOW()
      WHERE id = v_existing.id RETURNING *;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_ride_payment(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_ride_payment(UUID, UUID, TEXT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Restore the verification RPC expected by RidePaymentService.review.
-- Requires payment tables/helpers from migration 038. Safe to rerun.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_booking_unique
  ON public.transactions(booking_id) WHERE booking_id IS NOT NULL;

-- PostgreSQL cannot rename input parameters with CREATE OR REPLACE.
-- Drop only this exact overload, without CASCADE. A dependency blocks the
-- transaction instead of deleting dependent objects; records are untouched.
DROP FUNCTION IF EXISTS public.review_ride_payment(UUID, TEXT, TEXT);

CREATE FUNCTION public.review_ride_payment(
  p_payment_id UUID, p_decision TEXT, p_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.ride_payment_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.ride_payment_submissions%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_me UUID := public.current_app_user_id();
  v_role TEXT;
BEGIN
  -- Match submission/cancellation lock order: booking first, then proof.
  SELECT b.* INTO v_booking FROM public.bookings b
    WHERE b.id = (SELECT p.booking_id FROM public.ride_payment_submissions p WHERE p.id = p_payment_id)
    FOR UPDATE;
  SELECT * INTO v_payment FROM public.ride_payment_submissions WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment submission not found.'; END IF;
  IF public.is_admin() THEN v_role := 'admin';
  ELSIF v_payment.driver_id = v_me THEN v_role := 'driver';
  ELSE RAISE EXCEPTION 'You are not authorized to review this payment.';
  END IF;
  IF v_booking.id IS NULL OR v_booking.status = 'cancelled' OR v_booking.payment_method <> 'online' THEN
    RAISE EXCEPTION 'This ride is not eligible for online payment review.';
  END IF;
  IF v_booking.payment_status = 'completed' THEN RAISE EXCEPTION 'This ride is already paid.'; END IF;
  IF v_payment.status <> 'pending' THEN RAISE EXCEPTION 'This payment was already reviewed.'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('verified', 'rejected') THEN RAISE EXCEPTION 'Invalid payment decision.'; END IF;
  IF p_decision = 'rejected' AND COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Enter a reason for rejecting this payment.';
  END IF;

  RETURN QUERY UPDATE public.ride_payment_submissions
    SET status = p_decision, rejection_reason = CASE WHEN p_decision = 'rejected' THEN btrim(p_reason) ELSE NULL END,
        reviewed_at = NOW(), reviewed_by = v_me, reviewed_by_role = v_role, updated_at = NOW()
    WHERE id = p_payment_id RETURNING *;

  IF p_decision = 'verified' THEN
    UPDATE public.bookings SET payment_status = 'completed' WHERE id = v_payment.booking_id;
    UPDATE public.users
      SET total_earnings = COALESCE(total_earnings, 0) + v_payment.amount
      WHERE id = v_payment.driver_id;
    INSERT INTO public.transactions (booking_id, passenger_id, driver_id, amount, payment_method, status, completed_at, receipt_url, notes)
      VALUES (v_payment.booking_id, v_payment.passenger_id, v_payment.driver_id, v_payment.amount,
        'online', 'completed', NOW(), v_payment.proof_url, 'Reference ' || v_payment.payment_reference)
      ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL DO UPDATE SET status = 'completed', completed_at = NOW(),
        receipt_url = EXCLUDED.receipt_url, notes = EXCLUDED.notes;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_ride_payment(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_ride_payment(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_ride_payment(UUID, TEXT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- The argument names below must match the app's named RPC parameters.
SELECT p.proname, pg_get_function_arguments(p.oid) AS arguments,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'review_ride_payment';

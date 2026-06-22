-- =============================================================================
-- 021 · E-money trip settlement (atomic charge + driver payout)
-- -----------------------------------------------------------------------------
-- Settles a completed trip whose fare is paid via e-money: debits the
-- passenger's wallet and credits the driver's wallet in a single transaction,
-- recording a `trip_payment` row for the passenger and a `driver_payout` row
-- for the driver.
--
-- SECURITY DEFINER: the driver finalizes the trip, but RLS would stop them from
-- writing to the passenger's wallet. Running as the definer lets the function
-- move funds for both parties atomically while the policies still protect normal
-- client access.
--
-- Idempotent: a booking already marked paid (payment_status = 'completed') is a
-- no-op, so retries / double taps never double-charge.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pay_trip_with_emoney(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking   public.bookings%ROWTYPE;
  v_amount    numeric;
  v_pax_acct  public.emoney_accounts%ROWTYPE;
  v_drv_acct  public.emoney_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  -- Already settled → no-op (idempotent).
  IF v_booking.payment_status = 'completed' THEN
    RETURN jsonb_build_object('status', 'already_paid');
  END IF;

  v_amount := COALESCE(v_booking.total_fare, 0);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid fare amount for booking %', p_booking_id;
  END IF;

  -- Passenger's wallet (default first, else oldest).
  SELECT * INTO v_pax_acct
  FROM public.emoney_accounts
  WHERE user_id = v_booking.passenger_id
  ORDER BY is_default DESC, created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passenger has no linked e-money account';
  END IF;
  IF v_pax_acct.balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient e-money balance';
  END IF;

  -- Debit passenger + record the trip payment.
  UPDATE public.emoney_accounts
  SET balance = balance - v_amount
  WHERE id = v_pax_acct.id;

  INSERT INTO public.emoney_transactions
    (user_id, account_id, type, amount, reference_id, description, status, provider, booking_id)
  VALUES
    (v_booking.passenger_id, v_pax_acct.id, 'trip_payment', v_amount,
     'TRIP-' || p_booking_id, 'Trip fare payment', 'completed', v_pax_acct.provider, p_booking_id);

  -- Credit the driver if they have a wallet to receive the payout.
  IF v_booking.driver_id IS NOT NULL THEN
    SELECT * INTO v_drv_acct
    FROM public.emoney_accounts
    WHERE user_id = v_booking.driver_id
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.emoney_accounts
      SET balance = balance + v_amount
      WHERE id = v_drv_acct.id;

      INSERT INTO public.emoney_transactions
        (user_id, account_id, type, amount, reference_id, description, status, provider, booking_id)
      VALUES
        (v_booking.driver_id, v_drv_acct.id, 'driver_payout', v_amount,
         'PAYOUT-' || p_booking_id, 'Trip fare payout', 'completed', v_drv_acct.provider, p_booking_id);
    END IF;
  END IF;

  -- Mark the booking settled.
  UPDATE public.bookings
  SET payment_status = 'completed'
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'status', 'paid',
    'amount', v_amount,
    'passenger_balance', v_pax_acct.balance - v_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_trip_with_emoney(uuid) TO authenticated;

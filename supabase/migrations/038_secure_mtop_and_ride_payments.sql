-- Secure MTOP approval/payment workflow and driver-owned ride payment details.

ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_review_status TEXT NOT NULL DEFAULT 'awaiting_submission',
  ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_rejection_reason TEXT;

ALTER TABLE public.franchise_applications
  DROP CONSTRAINT IF EXISTS franchise_payment_review_status_check;
ALTER TABLE public.franchise_applications
  ADD CONSTRAINT franchise_payment_review_status_check
  CHECK (payment_review_status IN ('awaiting_submission', 'pending_review', 'verified', 'rejected'));

CREATE OR REPLACE FUNCTION public.mtop_documents_are_approved(p_documents JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(p_documents) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'Barangay Clearance',
        'Community Tax Certificate (Cedula)',
        'OR/CR of Tricycle Unit',
        'Proof of Ownership',
        'TODA Membership Certificate'
      ]) AS required(name)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_documents) AS document
        WHERE document->>'name' = required.name
          AND COALESCE((document->>'uploaded')::BOOLEAN, FALSE)
          AND document->>'review_status' = 'approved'
          AND COALESCE(document->>'file_url', '') <> ''
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.enforce_mtop_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_admin BOOLEAN := public.is_admin();
  v_owner UUID := public.current_app_user_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'submitted' OR NEW.payment_status <> 'pending' THEN
      RAISE EXCEPTION 'New MTOP applications must start as submitted and unpaid.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.documents_verified_at IS NOT NULL THEN
    IF NEW.status = 'rejected' THEN
      RAISE EXCEPTION 'Verified MTOP files cannot be declined.';
    END IF;
    IF NEW.documents IS DISTINCT FROM OLD.documents
       OR NEW.documents_verified_at IS DISTINCT FROM OLD.documents_verified_at
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
      RAISE EXCEPTION 'Verified MTOP files are locked.';
    END IF;
  END IF;

  IF NEW.status = 'rejected'
     AND (OLD.documents_verified_at IS NOT NULL OR public.mtop_documents_are_approved(OLD.documents)) THEN
    RAISE EXCEPTION 'Approved MTOP files cannot be declined.';
  END IF;

  IF OLD.documents_verified_at IS NULL AND NEW.documents_verified_at IS NOT NULL THEN
    IF NOT public.mtop_documents_are_approved(NEW.documents) THEN
      RAISE EXCEPTION 'Every required MTOP file must be uploaded and approved.';
    END IF;
    IF NEW.status <> 'payment' THEN
      RAISE EXCEPTION 'File approval must move the MTOP application to payment.';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'submitted' AND NEW.status IN ('document_verification', 'rejected')) OR
    (OLD.status = 'document_verification' AND NEW.status IN ('payment', 'rejected')) OR
    (OLD.status = 'inspection' AND NEW.status = 'payment') OR
    (OLD.status = 'payment' AND NEW.status = 'approved') OR
    (OLD.status = 'approved' AND NEW.status = 'issued')
  ) THEN
    RAISE EXCEPTION 'Invalid MTOP status transition: % to %.', OLD.status, NEW.status;
  END IF;

  IF NEW.status IN ('payment', 'approved', 'issued') AND NEW.documents_verified_at IS NULL THEN
    RAISE EXCEPTION 'MTOP files must be verified before payment or approval.';
  END IF;

  IF NEW.status IN ('approved', 'issued') AND (
    NEW.payment_status <> 'paid'
    OR NEW.payment_review_status <> 'verified'
    OR NEW.payment_verified_at IS NULL
    OR NEW.payment_verified_by IS NULL
    OR COALESCE(btrim(NEW.payment_reference), '') = ''
    OR COALESCE(NEW.payment_proof_url, '') = ''
  ) THEN
    RAISE EXCEPTION 'Verified payment proof and reference are required before MTOP approval.';
  END IF;

  IF NOT v_admin THEN
    IF OLD.driver_id IS DISTINCT FROM v_owner THEN
      RAISE EXCEPTION 'You cannot update another driver''s MTOP application.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.documents IS DISTINCT FROM OLD.documents
       OR NEW.documents_verified_at IS DISTINCT FROM OLD.documents_verified_at
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payment_verified_at IS DISTINCT FROM OLD.payment_verified_at
       OR NEW.payment_verified_by IS DISTINCT FROM OLD.payment_verified_by
       OR NEW.fees IS DISTINCT FROM OLD.fees
       OR NEW.mtop_number IS DISTINCT FROM OLD.mtop_number THEN
      RAISE EXCEPTION 'Only an administrator can change MTOP review fields.';
    END IF;
    IF OLD.status <> 'payment' THEN
      RAISE EXCEPTION 'Payment proof can only be submitted during the payment phase.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_mtop_workflow_trigger ON public.franchise_applications;
CREATE TRIGGER enforce_mtop_workflow_trigger
  BEFORE INSERT OR UPDATE ON public.franchise_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mtop_workflow();

-- Drivers submit payment through the validated RPC below; direct row updates
-- would otherwise let them mutate admin-only review fields under the old policy.
DROP POLICY IF EXISTS "Drivers update own franchise" ON public.franchise_applications;

CREATE OR REPLACE FUNCTION public.submit_mtop_payment(
  p_application_id UUID,
  p_method TEXT,
  p_reference TEXT,
  p_proof_url TEXT
)
RETURNS SETOF public.franchise_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.franchise_applications%ROWTYPE;
BEGIN
  SELECT * INTO v_app FROM public.franchise_applications WHERE id = p_application_id FOR UPDATE;
  IF v_app.id IS NULL OR v_app.driver_id IS DISTINCT FROM public.current_app_user_id() THEN
    RAISE EXCEPTION 'MTOP application not found.';
  END IF;
  IF v_app.status <> 'payment' OR v_app.documents_verified_at IS NULL THEN
    RAISE EXCEPTION 'This application is not ready for payment.';
  END IF;
  IF v_app.payment_review_status IN ('pending_review', 'verified') THEN
    RAISE EXCEPTION 'A payment is already pending review or verified.';
  END IF;
  IF p_method <> 'in_person' THEN
    RAISE EXCEPTION 'Choose an available payment method.';
  END IF;
  IF btrim(COALESCE(p_reference, '')) !~ '^[A-Za-z0-9][A-Za-z0-9 _-]{5,63}$' THEN
    RAISE EXCEPTION 'Enter a valid payment reference (6 to 64 characters).';
  END IF;
  IF COALESCE(p_proof_url, '') !~ '^data:image/(jpeg|jpg|png|webp);base64,'
     OR octet_length(p_proof_url) > 3500000 THEN
    RAISE EXCEPTION 'Upload a valid payment screenshot under 2.5 MB.';
  END IF;

  RETURN QUERY
  UPDATE public.franchise_applications
     SET payment_method = p_method,
         payment_reference = btrim(p_reference),
         payment_proof_url = p_proof_url,
         payment_review_status = 'pending_review',
         payment_submitted_at = NOW(),
         payment_rejection_reason = NULL,
         updated_at = NOW()
   WHERE id = p_application_id
   RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_mtop_payment(
  p_application_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.franchise_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator permission required.'; END IF;
  IF p_decision NOT IN ('verified', 'rejected') THEN RAISE EXCEPTION 'Invalid payment decision.'; END IF;
  IF p_decision = 'rejected' AND COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Enter a reason for rejecting the payment proof.';
  END IF;

  IF p_decision = 'verified' THEN
    RETURN QUERY
    UPDATE public.franchise_applications
       SET status = 'approved', payment_status = 'paid', payment_review_status = 'verified',
           payment_verified_at = NOW(), payment_verified_by = public.current_app_user_id(),
           payment_rejection_reason = NULL, updated_at = NOW()
     WHERE id = p_application_id AND status = 'payment'
       AND payment_review_status = 'pending_review'
       AND payment_proof_url IS NOT NULL AND btrim(COALESCE(payment_reference, '')) <> ''
     RETURNING *;
  ELSE
    RETURN QUERY
    UPDATE public.franchise_applications
       SET payment_review_status = 'rejected', payment_rejection_reason = btrim(p_reason), updated_at = NOW()
     WHERE id = p_application_id AND status = 'payment' AND payment_review_status = 'pending_review'
     RETURNING *;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment is not pending review.'; END IF;
END;
$$;

-- Driver-owned payment methods. Passengers never SELECT this table directly.
CREATE TABLE IF NOT EXISTS public.driver_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('gcash', 'bank', 'other')),
  display_name TEXT NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 60),
  account_name TEXT NOT NULL CHECK (char_length(btrim(account_name)) BETWEEN 2 AND 100),
  account_number TEXT NOT NULL CHECK (char_length(btrim(account_number)) BETWEEN 4 AND 80),
  instructions TEXT,
  qr_code_url TEXT NOT NULL CHECK (qr_code_url ~ '^data:image/(jpeg|jpg|png|webp);base64,' AND octet_length(qr_code_url) <= 3500000),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_driver_payment_methods_driver ON public.driver_payment_methods(driver_id, is_enabled);
ALTER TABLE public.driver_payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Drivers manage own payment methods" ON public.driver_payment_methods;
CREATE POLICY "Drivers manage own payment methods" ON public.driver_payment_methods
  FOR ALL TO authenticated
  USING (driver_id = public.current_app_user_id())
  WITH CHECK (
    driver_id = public.current_app_user_id()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = driver_id AND user_type = 'driver')
  );

CREATE TABLE IF NOT EXISTS public.ride_payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  driver_payment_method_id UUID NOT NULL REFERENCES public.driver_payment_methods(id) ON DELETE RESTRICT,
  payment_details_snapshot JSONB NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_reference TEXT NOT NULL CHECK (payment_reference ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{5,63}$'),
  proof_url TEXT NOT NULL CHECK (proof_url ~ '^data:image/(jpeg|jpg|png|webp);base64,' AND octet_length(proof_url) <= 3500000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_by_role TEXT CHECK (reviewed_by_role IN ('driver', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ride_payment_reference_per_driver
  ON public.ride_payment_submissions(driver_id, lower(payment_reference))
  WHERE status <> 'rejected';
CREATE INDEX IF NOT EXISTS idx_ride_payments_driver_status ON public.ride_payment_submissions(driver_id, status, submitted_at DESC);
ALTER TABLE public.ride_payment_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ride participants view payment submissions" ON public.ride_payment_submissions;
CREATE POLICY "Ride participants view payment submissions" ON public.ride_payment_submissions
  FOR SELECT TO authenticated USING (
    passenger_id = public.current_app_user_id()
    OR driver_id = public.current_app_user_id()
    OR public.is_admin()
  );

CREATE OR REPLACE FUNCTION public.get_ride_driver_payment_methods(p_booking_id UUID)
RETURNS TABLE (
  id UUID, method_type TEXT, display_name TEXT, account_name TEXT,
  account_number TEXT, instructions TEXT, qr_code_url TEXT, is_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE v_booking public.bookings%ROWTYPE; v_me UUID := public.current_app_user_id();
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE bookings.id = p_booking_id;
  IF v_booking.id IS NULL OR v_booking.driver_id IS NULL OR v_booking.status IN ('pending', 'cancelled') THEN
    RAISE EXCEPTION 'Assigned ride not found.';
  END IF;
  IF v_me IS NULL OR NOT (v_booking.passenger_id = v_me OR v_booking.driver_id = v_me OR public.is_admin()) THEN
    RAISE EXCEPTION 'You are not authorized to view this ride''s payment details.';
  END IF;
  RETURN QUERY SELECT m.id, m.method_type, m.display_name, m.account_name,
    m.account_number, m.instructions, m.qr_code_url, m.is_enabled
  FROM public.driver_payment_methods m
  WHERE m.driver_id = v_booking.driver_id AND m.is_enabled
  ORDER BY m.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_ride_payment(
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

CREATE OR REPLACE FUNCTION public.review_ride_payment(
  p_payment_id UUID, p_decision TEXT, p_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.ride_payment_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.ride_payment_submissions%ROWTYPE;
  v_me UUID := public.current_app_user_id();
  v_role TEXT;
BEGIN
  SELECT * INTO v_payment FROM public.ride_payment_submissions WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment submission not found.'; END IF;
  IF public.is_admin() THEN v_role := 'admin';
  ELSIF v_payment.driver_id = v_me THEN v_role := 'driver';
  ELSE RAISE EXCEPTION 'You are not authorized to review this payment.';
  END IF;
  IF v_payment.status <> 'pending' THEN RAISE EXCEPTION 'This payment was already reviewed.'; END IF;
  IF p_decision NOT IN ('verified', 'rejected') THEN RAISE EXCEPTION 'Invalid payment decision.'; END IF;
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

-- A transaction is unique per ride; makes verification idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_booking_unique ON public.transactions(booking_id) WHERE booking_id IS NOT NULL;

-- Cash is settled at completion. Online fares remain pending until proof is verified.
CREATE OR REPLACE FUNCTION public.handle_booking_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF NEW.driver_id IS NOT NULL THEN
      UPDATE public.users SET total_trips = COALESCE(total_trips, 0) + 1,
        completed_trips = COALESCE(completed_trips, 0) + 1,
        total_earnings = COALESCE(total_earnings, 0) + CASE WHEN COALESCE(NEW.payment_method, 'cash') = 'cash' THEN COALESCE(NEW.total_fare, 0) ELSE 0 END,
        current_status = 'online' WHERE id = NEW.driver_id;
    END IF;
    IF NEW.passenger_id IS NOT NULL THEN
      UPDATE public.users SET total_trips = COALESCE(total_trips, 0) + 1 WHERE id = NEW.passenger_id;
    END IF;
    IF COALESCE(NEW.payment_method, 'cash') = 'cash' THEN
      INSERT INTO public.transactions (booking_id, passenger_id, driver_id, amount, payment_method, status, completed_at)
        VALUES (NEW.id, NEW.passenger_id, NEW.driver_id, COALESCE(NEW.total_fare, 0), 'cash', 'completed', NOW())
        ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL DO NOTHING;
      NEW.payment_status := 'completed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_booking_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND COALESCE(NEW.payment_method, OLD.payment_method) = 'online' THEN
    IF OLD.payment_status = 'completed' THEN
      RAISE EXCEPTION 'A verified ride payment cannot be reverted.';
    END IF;
    IF NEW.payment_status <> 'completed' OR NOT EXISTS (
      SELECT 1 FROM public.ride_payment_submissions p
      WHERE p.booking_id = OLD.id AND p.status = 'verified'
    ) THEN
      RAISE EXCEPTION 'Online payment status requires a verified payment submission.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_booking_payment_status_trigger ON public.bookings;
CREATE TRIGGER protect_booking_payment_status_trigger
  BEFORE UPDATE OF payment_status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.protect_booking_payment_status();

CREATE OR REPLACE FUNCTION public.reject_pending_payment_on_booking_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.ride_payment_submissions SET status = 'rejected', rejection_reason = 'Booking cancelled',
      reviewed_at = NOW(), updated_at = NOW() WHERE booking_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reject_payment_on_booking_cancel ON public.bookings;
CREATE TRIGGER reject_payment_on_booking_cancel AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.reject_pending_payment_on_booking_cancel();

ALTER TABLE public.popular_places DROP CONSTRAINT IF EXISTS popular_places_coordinate_range;
ALTER TABLE public.popular_places ADD CONSTRAINT popular_places_coordinate_range
  CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180) NOT VALID;

DROP POLICY IF EXISTS "Participants insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Participants update transactions" ON public.transactions;

GRANT EXECUTE ON FUNCTION public.get_ride_driver_payment_methods(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ride_payment(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_ride_payment(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_mtop_payment(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_mtop_payment(UUID, TEXT, TEXT) TO authenticated;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_payment_submissions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

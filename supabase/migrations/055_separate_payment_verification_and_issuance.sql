-- Payment verification approves the application but does not issue the MTOP.
-- Issuance remains a separate administrator action in the application screen.
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
       SET status                   = 'approved',
           payment_status           = 'paid',
           payment_review_status    = 'verified',
           payment_verified_at      = NOW(),
           payment_verified_by      = public.current_app_user_id(),
           payment_rejection_reason = NULL,
           updated_at               = NOW()
     WHERE id = p_application_id
       AND status = 'payment'
       AND payment_review_status = 'pending_review'
       AND payment_proof_url IS NOT NULL
       AND btrim(COALESCE(payment_reference, '')) <> ''
     RETURNING *;
  ELSE
    RETURN QUERY
    UPDATE public.franchise_applications
       SET payment_review_status    = 'rejected',
           payment_rejection_reason = btrim(p_reason),
           updated_at               = NOW()
     WHERE id = p_application_id
       AND status = 'payment'
       AND payment_review_status = 'pending_review'
     RETURNING *;
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment is not pending review.'; END IF;
END;
$$;

-- =============================================================================
-- 059 · Admin RPC for reviewing Change of Unit requests + robust COU trigger
--
-- Migration 058 patched enforce_mtop_workflow at runtime using string
-- replacement which is fragile. This migration:
--   1. Replaces enforce_mtop_workflow with the COU bypass guard baked in.
--   2. Adds a SECURITY DEFINER admin RPC (review_change_of_unit_request) so
--      the admin approval/rejection never relies on a direct .update() hitting
--      the trigger.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- ── 1. Rebuild enforce_mtop_workflow with the COU bypass guard ───────────────
CREATE OR REPLACE FUNCTION public.enforce_mtop_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_admin BOOLEAN := public.is_admin();
  v_owner UUID    := public.current_app_user_id();
BEGIN
  -- INSERT: must start as submitted + unpaid.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'submitted' OR NEW.payment_status <> 'pending' THEN
      RAISE EXCEPTION 'New MTOP applications must start as submitted and unpaid.';
    END IF;
    RETURN NEW;
  END IF;

  -- ── Change of Unit: driver submit via submit_change_of_unit_request RPC ──
  -- The SECURITY DEFINER RPC sets this local flag before the UPDATE so the
  -- trigger can allow it through without relaxing any other guard.
  IF current_setting('app.change_of_unit_rpc', TRUE) = 'on'
     AND OLD.driver_id = v_owner
     AND OLD.status = 'issued'
     AND NEW.status = OLD.status
     AND NEW.cou_status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- ── Change of Unit: admin review via review_change_of_unit_request RPC ──
  IF current_setting('app.review_cou_rpc', TRUE) = 'on'
     AND v_admin
     AND OLD.status = 'issued'
     AND NEW.status = OLD.status
     AND OLD.cou_status = 'pending'
     AND NEW.cou_status IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Verified-document lock.
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
    (OLD.status = 'submitted'           AND NEW.status IN ('document_verification', 'rejected')) OR
    (OLD.status = 'document_verification' AND NEW.status IN ('payment', 'rejected')) OR
    (OLD.status = 'inspection'          AND NEW.status = 'payment') OR
    (OLD.status = 'payment'             AND NEW.status = 'approved') OR
    (OLD.status = 'approved'            AND NEW.status = 'issued')
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

-- ── 2. Admin RPC: review_change_of_unit_request ──────────────────────────────
-- Sets app.review_cou_rpc so the trigger above lets the COU-only UPDATE through.
CREATE OR REPLACE FUNCTION public.review_change_of_unit_request(
  p_application_id  UUID,
  p_decision        TEXT,
  p_reviewed_by     UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.franchise_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.franchise_applications%ROWTYPE;
  v_patch RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator permission required.';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected.';
  END IF;
  IF p_decision = 'rejected' AND COALESCE(btrim(p_rejection_reason), '') = '' THEN
    RAISE EXCEPTION 'A rejection reason is required.';
  END IF;

  SELECT * INTO v_app FROM public.franchise_applications WHERE id = p_application_id FOR UPDATE;
  IF v_app.id IS NULL THEN
    RAISE EXCEPTION 'Franchise application not found.';
  END IF;
  IF v_app.cou_status <> 'pending' THEN
    RAISE EXCEPTION 'No pending Change of Unit request found.';
  END IF;

  -- Allow the trigger to let this COU-only update through.
  PERFORM set_config('app.review_cou_rpc', 'on', TRUE);

  IF p_decision = 'approved' THEN
    RETURN QUERY
    UPDATE public.franchise_applications
       SET cou_status          = 'approved',
           cou_reviewed_at     = NOW(),
           cou_reviewed_by     = p_reviewed_by,
           cou_rejection_reason = NULL,
           -- Apply the new unit details to the main franchise record.
           body_number         = v_app.cou_new_body,
           plate_number        = CASE
                                   WHEN v_app.cou_unit_type IN ('motor', 'both')
                                   THEN v_app.cou_new_plate
                                   ELSE plate_number
                                 END,
           vehicle_make        = CASE
                                   WHEN v_app.cou_unit_type IN ('motor', 'both')
                                   THEN v_app.cou_vehicle_make
                                   ELSE vehicle_make
                                 END,
           vehicle_model       = CASE
                                   WHEN v_app.cou_unit_type IN ('motor', 'both')
                                   THEN v_app.cou_vehicle_model
                                   ELSE vehicle_model
                                 END,
           updated_at          = NOW()
     WHERE id = p_application_id
    RETURNING *;
  ELSE
    RETURN QUERY
    UPDATE public.franchise_applications
       SET cou_status           = 'rejected',
           cou_reviewed_at      = NOW(),
           cou_reviewed_by      = p_reviewed_by,
           cou_rejection_reason = btrim(p_rejection_reason),
           updated_at           = NOW()
     WHERE id = p_application_id
    RETURNING *;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not update the Change of Unit request.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_change_of_unit_request(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_change_of_unit_request(UUID, TEXT, UUID, TEXT) TO authenticated;

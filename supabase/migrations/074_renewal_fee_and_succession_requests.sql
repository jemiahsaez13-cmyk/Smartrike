-- =============================================================================
-- 074 · ₱1,500 renewal fee + driver-requested franchise succession
-- -----------------------------------------------------------------------------
--  1. MTOP renewals cost ₱1,500, the same as a new application. Renewals not
--     yet paid or under payment review are moved to the new fee.
--  2. The current MTOP holder can request a succession from the app, naming
--     the successor by the email of their Smart Trike driver account. Admins
--     are notified and see who requested it in the Franchise Registry, where
--     they record the transfer (approve) or reject it with a reason.
--
-- Requires migration 073. Idempotent: safe to run more than once.
-- =============================================================================

-- ── 1. Renewal fee ──────────────────────────────────────────────────────────
-- 073 version of the workflow trigger; only the renewal fee changes.
CREATE OR REPLACE FUNCTION public.enforce_mtop_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_admin   BOOLEAN := public.is_admin();
  v_owner   UUID    := public.current_app_user_id();
  v_today   DATE    := public.manila_today();
  v_prev    public.franchise_applications%ROWTYPE;
  v_covered INTEGER;
BEGIN
  -- 073: lifecycle updates from apply_mtop_term_on_issue() and
  -- run_mtop_renewal_cycle(). Those SECURITY DEFINER functions set this
  -- transaction-local flag; only the lifecycle columns may differ.
  IF TG_OP = 'UPDATE'
     AND current_setting('app.mtop_lifecycle', TRUE) = 'on'
     AND (to_jsonb(NEW) - ARRAY['franchise_status', 'issued_at', 'expiry_date', 'updated_at'])
       = (to_jsonb(OLD) - ARRAY['franchise_status', 'issued_at', 'expiry_date', 'updated_at']) THEN
    RETURN NEW;
  END IF;

  -- INSERT: must start as submitted + unpaid.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'submitted' OR NEW.payment_status <> 'pending' THEN
      RAISE EXCEPTION 'New MTOP applications must start as submitted and unpaid.';
    END IF;
    -- 068: the fee is set by the LGU schedule, never by the applicant's app.
    IF NOT v_admin THEN
      -- 074: renewals cost the same as new applications.
      NEW.fees := 1500;
      -- 072: drivers never choose the body number. A renewal carries over the
      -- one from the driver's latest issued MTOP; a new application gets one
      -- from the administrator at issuance.
      IF NEW.type = 'renewal' THEN
        -- 073: renewals are filed January 1 – March 31 only (Feb–Mar is the
        -- grace period), once per year, for a franchise that still exists.
        IF EXTRACT(MONTH FROM v_today) > 3 THEN
          RAISE EXCEPTION 'MTOP renewal is only accepted from January 1 to March 31.';
        END IF;
        SELECT * INTO v_prev FROM public.franchise_applications f
         WHERE f.driver_id = NEW.driver_id
           AND f.status = 'issued'
           AND COALESCE(f.franchise_status, 'active') NOT IN ('renewed', 'transferred')
         ORDER BY f.issued_at DESC NULLS LAST, f.created_at DESC
         LIMIT 1;
        IF v_prev.id IS NULL THEN
          RAISE EXCEPTION 'You have no issued MTOP to renew. Submit a new franchise application instead.';
        END IF;
        IF v_prev.franchise_status = 'terminated' THEN
          RAISE EXCEPTION 'Your MTOP was terminated after 3 years without renewal. Submit a new franchise application instead.';
        END IF;
        v_covered := COALESCE(v_prev.renewal_year, EXTRACT(YEAR FROM v_prev.issued_at)::INTEGER);
        IF v_covered >= EXTRACT(YEAR FROM v_today)::INTEGER THEN
          RAISE EXCEPTION 'Your MTOP is already renewed for %.', EXTRACT(YEAR FROM v_today)::INTEGER;
        END IF;

        SELECT f.body_number INTO NEW.body_number
          FROM public.franchise_applications f
         WHERE f.driver_id = NEW.driver_id
           AND f.status = 'issued'
           AND f.body_number IS NOT NULL
         ORDER BY f.issued_at DESC NULLS LAST, f.updated_at DESC
         LIMIT 1;
      ELSE
        NEW.body_number := NULL;
      END IF;
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

  -- ── 068: rejected-document re-upload via resubmit_mtop_document RPC ──
  -- The RPC validates which document changes; this only lets that one
  -- documents-only update through while the application is still in review.
  IF current_setting('app.mtop_doc_resubmit_rpc', TRUE) = 'on'
     AND OLD.driver_id = v_owner
     AND OLD.documents_verified_at IS NULL
     AND NEW.documents_verified_at IS NULL
     AND OLD.status IN ('submitted', 'document_verification')
     AND NEW.status = OLD.status THEN
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

  -- 072: the permit names the tricycle by its body number.
  IF NEW.status = 'issued' AND OLD.status IS DISTINCT FROM 'issued'
     AND COALESCE(btrim(NEW.body_number), '') = '' THEN
    RAISE EXCEPTION 'Assign the tricycle body number before issuing the MTOP.';
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
       OR NEW.mtop_number IS DISTINCT FROM OLD.mtop_number
       -- 072: the body number is assigned by the administrator.
       OR NEW.body_number IS DISTINCT FROM OLD.body_number
       -- 068: a driver may only mark proof as submitted, never as verified.
       OR (NEW.payment_review_status IS DISTINCT FROM OLD.payment_review_status
           AND NEW.payment_review_status NOT IN ('pending_review', 'awaiting_submission')) THEN
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

-- Open renewals whose payment is not yet submitted or verified. The workflow
-- trigger blocks fee edits by anyone but an admin, so it is paused for this
-- one data fix inside the migration transaction.
ALTER TABLE public.franchise_applications DISABLE TRIGGER enforce_mtop_workflow_trigger;
UPDATE public.franchise_applications
   SET fees = 1500
 WHERE type = 'renewal'
   AND fees <> 1500
   AND status NOT IN ('approved', 'issued', 'rejected')
   AND payment_status = 'pending'
   AND COALESCE(payment_review_status, 'awaiting_submission') IN ('awaiting_submission', 'rejected');
ALTER TABLE public.franchise_applications ENABLE TRIGGER enforce_mtop_workflow_trigger;

-- ── 2. Succession requests ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.franchise_succession_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id      UUID NOT NULL REFERENCES public.franchise_applications(id) ON DELETE CASCADE,
  requested_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_by_name TEXT NOT NULL,
  successor_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  successor_name    TEXT NOT NULL,
  successor_email   TEXT NOT NULL,
  relationship      TEXT NOT NULL
    CHECK (relationship IN ('spouse', 'child', 'parent', 'sibling', 'other_relative')),
  reason            TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason  TEXT,
  reviewed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS franchise_succession_one_pending
  ON public.franchise_succession_requests (franchise_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS franchise_succession_requested_by
  ON public.franchise_succession_requests (requested_by, created_at DESC);

-- Read-only to clients: the requester sees their own, admins see all. Every
-- write goes through the SECURITY DEFINER functions below.
ALTER TABLE public.franchise_succession_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS franchise_succession_select ON public.franchise_succession_requests;
CREATE POLICY franchise_succession_select ON public.franchise_succession_requests
  FOR SELECT TO authenticated
  USING (public.is_admin() OR requested_by = public.current_app_user_id());

CREATE OR REPLACE FUNCTION public.request_franchise_succession(
  p_franchise_id    UUID,
  p_successor_email TEXT,
  p_relationship    TEXT,
  p_reason          TEXT
)
RETURNS public.franchise_succession_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me        UUID := public.current_app_user_id();
  v_me_name   TEXT;
  v_franchise public.franchise_applications%ROWTYPE;
  v_successor public.users%ROWTYPE;
  v_request   public.franchise_succession_requests%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a succession.';
  END IF;

  SELECT * INTO v_franchise FROM public.franchise_applications
   WHERE id = p_franchise_id
   FOR UPDATE;
  IF NOT FOUND OR v_franchise.driver_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'You can only request a succession for your own MTOP.';
  END IF;
  IF v_franchise.status <> 'issued'
     OR COALESCE(v_franchise.franchise_status, 'active') IN ('renewed', 'transferred', 'terminated') THEN
    RAISE EXCEPTION 'Only a current, issued MTOP can be passed to a successor.';
  END IF;
  IF p_relationship IS NULL OR p_relationship NOT IN ('spouse', 'child', 'parent', 'sibling', 'other_relative') THEN
    RAISE EXCEPTION 'Select the successor''s relationship to you.';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Give the reason for the succession.';
  END IF;

  SELECT * INTO v_successor FROM public.users
   WHERE lower(email) = lower(btrim(COALESCE(p_successor_email, '')));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No Smart Trike account uses that email. The successor must sign up as a driver first.';
  END IF;
  IF v_successor.id = v_me THEN
    RAISE EXCEPTION 'The successor must be a different person.';
  END IF;
  IF v_successor.user_type <> 'driver' OR v_successor.status <> 'active' THEN
    RAISE EXCEPTION 'The successor must have an active driver account.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.franchise_applications f
     WHERE f.driver_id = v_successor.id AND f.status <> 'rejected'
  ) THEN
    RAISE EXCEPTION 'The successor already has an MTOP or an MTOP application in progress.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.franchise_succession_requests r
     WHERE r.franchise_id = p_franchise_id AND r.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A succession request for this MTOP is already waiting for review.';
  END IF;

  SELECT name INTO v_me_name FROM public.users WHERE id = v_me;

  INSERT INTO public.franchise_succession_requests (
    franchise_id, requested_by, requested_by_name,
    successor_id, successor_name, successor_email, relationship, reason
  ) VALUES (
    p_franchise_id, v_me, COALESCE(v_me_name, 'Driver'),
    v_successor.id, v_successor.name, lower(v_successor.email), p_relationship, btrim(p_reason)
  )
  RETURNING * INTO v_request;

  INSERT INTO public.notifications (user_id, type, title, body, read)
  SELECT u.id, 'franchise_status', 'Succession request',
         COALESCE(v_me_name, 'A driver') || ' requested to pass ' || COALESCE(v_franchise.mtop_number, 'their MTOP')
           || ' to ' || v_successor.name || '. Review it in the Franchise Registry.',
         FALSE
    FROM public.users u
   WHERE u.user_type = 'admin' AND u.status = 'active';

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.request_franchise_succession(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_franchise_succession(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_franchise_succession(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Approve only after the admin has recorded the succession transfer (the
-- MTOP now belongs to the successor); reject with a reason.
CREATE OR REPLACE FUNCTION public.review_franchise_succession(
  p_request_id UUID,
  p_decision   TEXT,
  p_reason     TEXT DEFAULT NULL
)
RETURNS public.franchise_succession_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request   public.franchise_succession_requests%ROWTYPE;
  v_franchise public.franchise_applications%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can review succession requests.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Unknown decision %.', p_decision;
  END IF;

  SELECT * INTO v_request FROM public.franchise_succession_requests
   WHERE id = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Succession request not found.';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This succession request was already reviewed.';
  END IF;

  SELECT * INTO v_franchise FROM public.franchise_applications WHERE id = v_request.franchise_id;

  IF p_decision = 'approved' THEN
    IF v_franchise.driver_id IS DISTINCT FROM v_request.successor_id THEN
      RAISE EXCEPTION 'Record the succession transfer to % first.', v_request.successor_name;
    END IF;
  ELSIF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Enter the reason for rejecting the request.';
  END IF;

  UPDATE public.franchise_succession_requests
     SET status = p_decision,
         rejection_reason = CASE WHEN p_decision = 'rejected' THEN btrim(p_reason) ELSE NULL END,
         reviewed_by = public.current_app_user_id(),
         reviewed_at = now()
   WHERE id = p_request_id
  RETURNING * INTO v_request;

  IF p_decision = 'approved' THEN
    INSERT INTO public.notifications (user_id, type, title, body, read) VALUES
      (v_request.requested_by, 'franchise_status', 'Succession approved',
       COALESCE(v_franchise.mtop_number, 'Your MTOP') || ' has been passed to ' || v_request.successor_name || '.', FALSE),
      (v_request.successor_id, 'franchise_status', 'You are now the MTOP holder',
       COALESCE(v_franchise.mtop_number, 'An MTOP') || ' was passed to you by ' || v_request.requested_by_name
         || '. You can see it in your Franchise tab.', FALSE);
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, read) VALUES
      (v_request.requested_by, 'franchise_status', 'Succession request rejected',
       'Your request to pass ' || COALESCE(v_franchise.mtop_number, 'your MTOP') || ' to ' || v_request.successor_name
         || ' was rejected: ' || btrim(p_reason), FALSE);
  END IF;

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.review_franchise_succession(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_franchise_succession(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_franchise_succession(UUID, TEXT, TEXT) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.franchise_succession_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

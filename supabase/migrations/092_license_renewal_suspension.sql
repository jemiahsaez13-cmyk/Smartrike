-- =============================================================================
-- 092 · Successor driver's license · MTOP renewal any time · timed suspension
-- -----------------------------------------------------------------------------
-- 1. Succession needs the successor's driver's license:
--      • franchise_succession_requests.successor_license_number (required,
--        LTO format A01-23-456789);
--      • a required "successor_drivers_license" photo among the documents,
--        reviewed one by one like the others (085).
--    request_franchise_succession() takes p_successor_license; the 8-argument
--    version is dropped so an old app build cannot skip the license.
--
-- 2. MTOP renewal is accepted any time (replaces the 073 yearly rule):
--      • No January 1 – March 31 window and no yearly renewal. An MTOP is
--        valid until its expiry date.
--      • An approved renewal adds 3 years to the current expiry date
--        (expiry 2027 → 2030). If that is still in the past (the MTOP was
--        expired for more than 3 years), the new term runs 3 years from the
--        approval date.
--      • One renewal in review at a time.
--      • run_mtop_renewal_cycle(): 'pending_renewal' within 60 days of expiry,
--        'expired' after the expiry date (cannot go online), 'terminated'
--        3 years after the expiry date without renewal. MTOPs suspended
--        under the old yearly rule go back to their date-based status.
--
-- 3. Account suspension has a duration and a reason:
--      • users.suspended_at / suspended_until / suspension_reason /
--        suspended_by, written only by admin_suspend_user(id, days, reason).
--      • Direct API writes cannot suspend an account or change these columns;
--        reactivating an account clears them.
--      • lift_expired_suspensions() reactivates accounts whose suspension
--        ended (pg_cron, every 10 minutes); lift_my_expired_suspension() lets
--        a user whose suspension ended sign in right away.
--      • The sign-in screen shows the suspended user the period and reason.
--
-- Apply after 091. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Succession: successor's driver's license
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.franchise_succession_requests
  ADD COLUMN IF NOT EXISTS successor_license_number TEXT;

COMMENT ON COLUMN public.franchise_succession_requests.successor_license_number IS
  'Successor''s LTO driver''s license number, A01-23-456789 (092). NULL on requests made before 092.';

CREATE OR REPLACE FUNCTION public.succession_document_label(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_key
    WHEN 'proof_of_relationship'    THEN 'Proof of relationship (birth or marriage certificate)'
    WHEN 'successor_valid_id'       THEN 'Successor''s valid ID'
    WHEN 'successor_drivers_license' THEN 'Successor''s driver''s license'
    WHEN 'supporting'               THEN 'Other supporting document'
  END;
$$;

-- "A01-23-456789", "A0123456789" or with spaces → "A01-23-456789"; NULL when
-- it is not an LTO license number.
CREATE OR REPLACE FUNCTION public.normalize_driver_license(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v ~ '^[A-Z][0-9]{10}$'
      THEN substr(v, 1, 3) || '-' || substr(v, 4, 2) || '-' || substr(v, 6, 6)
  END
  FROM (SELECT regexp_replace(upper(COALESCE(p_value, '')), '[\s-]', '', 'g') AS v) s;
$$;

DROP FUNCTION IF EXISTS public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.request_franchise_succession(
  p_franchise_id      UUID,
  p_has_account       BOOLEAN,
  p_successor_name    TEXT,
  p_successor_email   TEXT,
  p_successor_phone   TEXT,
  p_relationship      TEXT,
  p_reason            TEXT,
  p_documents         JSONB,
  p_successor_license TEXT
)
RETURNS public.franchise_succession_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me        UUID := public.current_app_user_id();
  v_me_name   TEXT;
  v_name      TEXT := btrim(COALESCE(p_successor_name, ''));
  v_email     TEXT := lower(btrim(COALESCE(p_successor_email, '')));
  v_phone     TEXT := NULLIF(btrim(COALESCE(p_successor_phone, '')), '');
  v_license   TEXT := public.normalize_driver_license(p_successor_license);
  v_franchise public.franchise_applications%ROWTYPE;
  v_successor public.users%ROWTYPE;
  v_request   public.franchise_succession_requests%ROWTYPE;
  v_doc       JSONB;
  v_key       TEXT;
  v_keys      TEXT[] := ARRAY[]::TEXT[];
  v_docs      JSONB := '[]'::jsonb;
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
  IF p_has_account IS NULL THEN
    RAISE EXCEPTION 'Answer whether your successor has a Smart Trike account.';
  END IF;
  IF char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'Enter your successor''s full name.';
  END IF;
  -- 092: the successor will drive the unit, so their license is required.
  IF v_license IS NULL THEN
    RAISE EXCEPTION 'Enter your successor''s driver''s license number (1 letter and 10 digits, like A01-23-456789).';
  END IF;
  IF p_relationship IS NULL OR p_relationship NOT IN ('spouse', 'child', 'parent', 'sibling', 'other_relative') THEN
    RAISE EXCEPTION 'Select the successor''s relationship to you.';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Give the reason for the succession.';
  END IF;

  -- 085: supporting documents.
  IF p_documents IS NULL OR jsonb_typeof(p_documents) <> 'array' THEN
    RAISE EXCEPTION 'Attach the supporting documents.';
  END IF;
  FOR v_doc IN SELECT value FROM jsonb_array_elements(p_documents) LOOP
    v_key := v_doc->>'key';
    IF public.succession_document_label(v_key) IS NULL THEN
      RAISE EXCEPTION 'Unknown document %.', COALESCE(v_key, '(none)');
    END IF;
    IF v_key = ANY (v_keys) THEN
      RAISE EXCEPTION 'Attach each document only once.';
    END IF;
    IF NOT public.succession_document_url_ok(v_doc->>'file_url') THEN
      RAISE EXCEPTION '% must be a JPEG, PNG, or WebP image under 2.5 MB.', public.succession_document_label(v_key);
    END IF;
    v_keys := v_keys || v_key;
    v_docs := v_docs || jsonb_build_array(jsonb_build_object(
      'key', v_key,
      'label', public.succession_document_label(v_key),
      'file_url', v_doc->>'file_url',
      'file_name', NULLIF(left(btrim(COALESCE(v_doc->>'file_name', '')), 255), ''),
      'uploaded_at', now(),
      'review_status', 'pending',
      'review_remarks', NULL
    ));
  END LOOP;
  IF NOT ('proof_of_relationship' = ANY (v_keys)) THEN
    RAISE EXCEPTION 'Attach the proof of relationship (birth or marriage certificate).';
  END IF;
  IF NOT ('successor_valid_id' = ANY (v_keys)) THEN
    RAISE EXCEPTION 'Attach your successor''s valid ID.';
  END IF;
  IF NOT ('successor_drivers_license' = ANY (v_keys)) THEN
    RAISE EXCEPTION 'Attach a photo of your successor''s driver''s license.';
  END IF;

  IF p_has_account THEN
    IF v_email = '' THEN
      RAISE EXCEPTION 'Enter the email your successor uses in the Smart Trike app.';
    END IF;
    SELECT * INTO v_successor FROM public.users WHERE lower(email) = v_email;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No Smart Trike account uses that email. Check the email, or answer No if your successor has no account yet.';
    END IF;
    IF v_successor.id = v_me THEN
      RAISE EXCEPTION 'The successor must be a different person.';
    END IF;
    IF v_successor.user_type <> 'driver' OR v_successor.status <> 'active' THEN
      RAISE EXCEPTION 'That account is not an active driver account. Your successor must sign up as a driver.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.franchise_applications f
       WHERE f.driver_id = v_successor.id AND f.status <> 'rejected'
    ) THEN
      RAISE EXCEPTION 'The successor already has an MTOP or an MTOP application in progress.';
    END IF;
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
    successor_has_account, successor_id, successor_name, successor_email, successor_phone,
    successor_license_number, relationship, reason, documents
  ) VALUES (
    p_franchise_id, v_me, COALESCE(v_me_name, 'Driver'),
    p_has_account,
    CASE WHEN p_has_account THEN v_successor.id END,
    v_name,
    NULLIF(v_email, ''),
    v_phone,
    v_license,
    p_relationship,
    btrim(p_reason),
    v_docs
  )
  RETURNING * INTO v_request;

  -- Admins are alerted by alert_admins_succession_trigger (083).
  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. MTOP renewal any time: +3 years on the current expiry
-- ═════════════════════════════════════════════════════════════════════════════

-- Expiry after an approved renewal. Must match renewedExpiryDate() in
-- src/models/entities/Franchise.ts.
CREATE OR REPLACE FUNCTION public.mtop_renewed_expiry(p_current DATE, p_today DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_current IS NULL OR (p_current + INTERVAL '3 years')::date < p_today
      THEN (p_today + INTERVAL '3 years')::date
    ELSE (p_current + INTERVAL '3 years')::date
  END;
$$;

-- ── 2a. Workflow guard (086 version; only the renewal block changes) ────────
CREATE OR REPLACE FUNCTION public.enforce_mtop_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_admin   BOOLEAN := public.is_admin();
  v_owner   UUID    := public.current_app_user_id();
  v_prev    public.franchise_applications%ROWTYPE;
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

  -- 082: release_body_number() stamps the release columns only.
  IF TG_OP = 'UPDATE'
     AND current_setting('app.body_release_rpc', TRUE) = 'on'
     AND v_admin
     AND (to_jsonb(NEW) - ARRAY['body_number_released_at', 'body_number_released_by', 'body_number_release_reason', 'updated_at'])
       = (to_jsonb(OLD) - ARRAY['body_number_released_at', 'body_number_released_by', 'body_number_release_reason', 'updated_at']) THEN
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
        -- 092: renewals are accepted any time, one in review at a time, for
        -- a franchise that still exists.
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
          RAISE EXCEPTION 'Your MTOP was terminated because it was not renewed within 3 years after it expired. Submit a new franchise application instead.';
        END IF;
        IF EXISTS (
          SELECT 1 FROM public.franchise_applications p
           WHERE p.driver_id = NEW.driver_id
             AND p.type = 'renewal'
             AND p.status NOT IN ('issued', 'rejected')
        ) THEN
          RAISE EXCEPTION 'Your MTOP renewal is already being reviewed.';
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
      -- 082: the route is assigned by the administrator with the body number;
      -- a renewal keeps the route of the unit it renews.
      IF NEW.type = 'renewal' THEN
        SELECT f.route_id INTO NEW.route_id
          FROM public.franchise_applications f
         WHERE f.driver_id = NEW.driver_id
           AND f.status = 'issued'
           AND f.body_number IS NOT NULL
         ORDER BY f.issued_at DESC NULLS LAST, f.updated_at DESC
         LIMIT 1;
      ELSE
        NEW.route_id := NULL;
      END IF;
      NEW.body_number_released_at := NULL;
      NEW.body_number_released_by := NULL;
      NEW.body_number_release_reason := NULL;
      -- 086: billing and payment are written by the office only.
      NEW.selected_payment_methods       := NULL;
      NEW.chosen_payment_method_snapshot := NULL;
      NEW.billing_sent_at       := NULL;
      NEW.billing_statement_no  := NULL;
      NEW.billing_due_date      := NULL;
      NEW.payment_method        := NULL;
      NEW.payment_reference     := NULL;
      NEW.payment_proof_url     := NULL;
      NEW.payment_submitted_at  := NULL;
      NEW.appointment_date      := NULL;
      NEW.payment_amount        := NULL;
      NEW.payment_paid_on       := NULL;
      NEW.payment_recorded_by   := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- 086: the recorded-payment columns are written by record_mtop_payment() only.
  IF (NEW.payment_amount IS DISTINCT FROM OLD.payment_amount
      OR NEW.payment_paid_on IS DISTINCT FROM OLD.payment_paid_on
      OR NEW.payment_recorded_by IS DISTINCT FROM OLD.payment_recorded_by)
     -- COALESCE: an unset setting is NULL, and NOT (… AND NULL) would skip the guard.
     AND NOT (v_admin AND COALESCE(current_setting('app.record_mtop_payment', TRUE), '') = 'on') THEN
    RAISE EXCEPTION 'Use Record payment to record an MTOP payment.';
  END IF;

  -- ── Change of Unit: driver submit via submit_change_of_unit_request RPC ──
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

  -- 086: a payment recorded by the office needs no screenshot; a legacy
  -- driver-submitted payment still needs its verified proof.
  IF NEW.status IN ('approved', 'issued') AND (
    NEW.payment_status <> 'paid'
    OR NEW.payment_review_status <> 'verified'
    OR NEW.payment_verified_at IS NULL
    OR NEW.payment_verified_by IS NULL
    OR COALESCE(btrim(NEW.payment_reference), '') = ''
    OR (COALESCE(NEW.payment_proof_url, '') = '' AND NEW.payment_recorded_by IS NULL)
  ) THEN
    RAISE EXCEPTION 'A recorded payment with its OR or reference number is required before MTOP approval.';
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
       -- 082: route and body-number release are administrator fields too.
       OR NEW.route_id IS DISTINCT FROM OLD.route_id
       OR NEW.body_number_released_at IS DISTINCT FROM OLD.body_number_released_at
       OR NEW.body_number_released_by IS DISTINCT FROM OLD.body_number_released_by
       OR NEW.body_number_release_reason IS DISTINCT FROM OLD.body_number_release_reason THEN
      RAISE EXCEPTION 'Only an administrator can change MTOP review fields.';
    END IF;
    -- 086: billing and payment belong to the office; the driver only views them.
    IF NEW.payment_review_status IS DISTINCT FROM OLD.payment_review_status
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
       OR NEW.payment_proof_url IS DISTINCT FROM OLD.payment_proof_url
       OR NEW.payment_submitted_at IS DISTINCT FROM OLD.payment_submitted_at
       OR NEW.payment_rejection_reason IS DISTINCT FROM OLD.payment_rejection_reason
       OR NEW.appointment_date IS DISTINCT FROM OLD.appointment_date
       OR NEW.selected_payment_methods IS DISTINCT FROM OLD.selected_payment_methods
       OR NEW.chosen_payment_method_snapshot IS DISTINCT FROM OLD.chosen_payment_method_snapshot THEN
      RAISE EXCEPTION 'MTOP payments are recorded by the FEDTODAB office.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_mtop_workflow_trigger ON public.franchise_applications;
CREATE TRIGGER enforce_mtop_workflow_trigger
  BEFORE INSERT OR UPDATE ON public.franchise_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mtop_workflow();

-- ── 2b. Term dates on issuance ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_mtop_term_on_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := public.manila_today();
  v_prev  public.franchise_applications%ROWTYPE;
BEGIN
  IF NEW.status IS DISTINCT FROM 'issued' OR OLD.status = 'issued' THEN
    RETURN NEW;
  END IF;

  NEW.franchise_status := 'active';
  NEW.issued_at := v_today;

  IF NEW.type = 'renewal' THEN
    SELECT * INTO v_prev FROM public.franchise_applications f
     WHERE f.driver_id = NEW.driver_id
       AND f.id <> NEW.id
       AND f.status = 'issued'
       AND COALESCE(f.franchise_status, 'active') NOT IN ('renewed', 'transferred')
     ORDER BY f.issued_at DESC NULLS LAST, f.created_at DESC
     LIMIT 1;

    NEW.renewal_year := EXTRACT(YEAR FROM v_today)::INTEGER;
    NEW.last_renewed_at := v_today;
  END IF;

  IF v_prev.id IS NOT NULL THEN
    -- Same franchise: keep its MTOP number and original holder; 092: the
    -- renewal adds 3 years to the expiry it replaces.
    NEW.mtop_number := COALESCE(v_prev.mtop_number, NEW.mtop_number);
    NEW.original_holder_name := COALESCE(v_prev.original_holder_name, NEW.original_holder_name);
    NEW.expiry_date := public.mtop_renewed_expiry(
      COALESCE(v_prev.expiry_date, (v_prev.issued_at + INTERVAL '3 years')::date),
      v_today
    );

    PERFORM set_config('app.mtop_lifecycle', 'on', TRUE);
    UPDATE public.franchise_applications SET franchise_status = 'renewed' WHERE id = v_prev.id;
    PERFORM set_config('app.mtop_lifecycle', 'off', TRUE);
  ELSE
    NEW.expiry_date := (v_today + INTERVAL '3 years')::DATE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_mtop_term_on_issue_trigger ON public.franchise_applications;
CREATE TRIGGER apply_mtop_term_on_issue_trigger
  BEFORE UPDATE OF status ON public.franchise_applications
  FOR EACH ROW EXECUTE FUNCTION public.apply_mtop_term_on_issue();

REVOKE ALL ON FUNCTION public.apply_mtop_term_on_issue() FROM PUBLIC;

-- ── 2c. Daily cycle: status from the expiry date only ───────────────────────
CREATE OR REPLACE FUNCTION public.run_mtop_renewal_cycle()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          RECORD;
  v_today    DATE := public.manila_today();
  v_expiry   DATE;
  v_status   TEXT;
  v_label    TEXT;
BEGIN
  PERFORM set_config('app.mtop_lifecycle', 'on', TRUE);

  FOR r IN
    SELECT f.*
      FROM public.franchise_applications f
     WHERE f.status = 'issued'
       AND COALESCE(f.franchise_status, 'active') NOT IN ('renewed', 'transferred', 'terminated')
  LOOP
    v_label  := COALESCE(r.mtop_number, 'Your MTOP');
    v_expiry := COALESCE(r.expiry_date, (r.issued_at + INTERVAL '3 years')::date);

    v_status := CASE
      WHEN v_expiry IS NULL THEN 'active'
      WHEN (v_expiry + INTERVAL '3 years')::date < v_today THEN 'terminated'
      WHEN v_expiry < v_today THEN 'expired'
      WHEN v_expiry - v_today <= 60 THEN 'pending_renewal'
      ELSE 'active'
    END;

    IF v_status IS DISTINCT FROM COALESCE(r.franchise_status, 'active') THEN
      UPDATE public.franchise_applications SET franchise_status = v_status WHERE id = r.id;

      IF v_status IN ('expired', 'terminated') THEN
        UPDATE public.users SET current_status = 'offline'
         WHERE id = r.driver_id AND current_status = 'online';
      END IF;

      IF v_status = 'expired' THEN
        PERFORM public.send_mtop_notice(r.id, r.driver_id, EXTRACT(YEAR FROM v_expiry)::INTEGER, 'expired',
          'MTOP expired',
          v_label || ' expired on ' || to_char(v_expiry, 'Mon DD, YYYY') || '. You cannot go online until it is renewed. Renew any time in the Franchise tab; it is terminated if not renewed by '
            || to_char((v_expiry + INTERVAL '3 years')::date, 'Mon DD, YYYY') || '.');
      ELSIF v_status = 'terminated' THEN
        PERFORM public.send_mtop_notice(r.id, r.driver_id, EXTRACT(YEAR FROM v_today)::INTEGER, 'terminated',
          'MTOP terminated',
          v_label || ' was terminated because it was not renewed within 3 years after it expired. Submit a new franchise application to operate again.');
      END IF;
    END IF;

    -- Expiry warning 60 days before the expiry date.
    IF v_expiry IS NOT NULL AND v_expiry >= v_today AND v_expiry - v_today <= 60 THEN
      PERFORM public.send_mtop_notice(r.id, r.driver_id, EXTRACT(YEAR FROM v_expiry)::INTEGER, 'expiring',
        'MTOP expiring soon',
        v_label || ' expires on ' || to_char(v_expiry, 'Mon DD, YYYY') || '. Renew any time in the Franchise tab; an approved renewal adds 3 years to this date.');
    END IF;
  END LOOP;

  PERFORM set_config('app.mtop_lifecycle', 'off', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.run_mtop_renewal_cycle() FROM PUBLIC;

-- Re-grade every MTOP now (lifts the old yearly-rule suspensions).
SELECT public.run_mtop_renewal_cycle();

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Account suspension with a duration and a reason
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS suspended_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_until   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_by      UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.suspended_until IS
  'End of the current suspension (092). NULL on suspensions made before 092: those last until an admin reactivates the account.';
COMMENT ON COLUMN public.users.suspension_reason IS
  'Reason the admin gave for the current suspension (092); shown to the user at sign-in.';

-- SECURITY INVOKER on purpose (like 077/091): trusted SECURITY DEFINER
-- functions run as the owner and pass.
CREATE OR REPLACE FUNCTION public.guard_account_suspension()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Leaving the suspension (reactivation, deactivation) clears its record.
  IF OLD.status = 'suspended' AND NEW.status IS DISTINCT FROM 'suspended' THEN
    NEW.suspended_at      := NULL;
    NEW.suspended_until   := NULL;
    NEW.suspension_reason := NULL;
    NEW.suspended_by      := NULL;
    RETURN NEW;
  END IF;

  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'suspended' AND OLD.status IS DISTINCT FROM 'suspended' THEN
    RAISE EXCEPTION 'Use Suspend Account and give the duration and reason.'
      USING ERRCODE = '42501';
  END IF;
  IF ROW(NEW.suspended_at, NEW.suspended_until, NEW.suspension_reason, NEW.suspended_by)
     IS DISTINCT FROM ROW(OLD.suspended_at, OLD.suspended_until, OLD.suspension_reason, OLD.suspended_by) THEN
    RAISE EXCEPTION 'Suspension details are set by the Suspend Account action.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_account_suspension_trigger ON public.users;
CREATE TRIGGER guard_account_suspension_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_account_suspension();

CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id UUID, p_days INTEGER, p_reason TEXT)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.users;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can suspend accounts.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = public.current_app_user_id() THEN
    RAISE EXCEPTION 'You cannot suspend your own account.';
  END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'The suspension must last from 1 to 365 days.';
  END IF;
  IF length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Give the reason for the suspension.';
  END IF;

  UPDATE public.users
     SET status            = 'suspended',
         suspended_at      = NOW(),
         suspended_until   = NOW() + make_interval(days => p_days),
         suspension_reason = left(btrim(p_reason), 500),
         suspended_by      = public.current_app_user_id(),
         current_status    = 'offline'
   WHERE id = p_user_id
     AND status NOT IN ('suspended', 'deactivated')
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an account that is not suspended or deactivated can be suspended.';
  END IF;

  -- An open ride request must not keep showing to drivers.
  UPDATE public.bookings
     SET status = 'cancelled',
         cancelled_by = 'admin',
         cancellation_reason = 'Account suspended'
   WHERE passenger_id = p_user_id
     AND status = 'pending';

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_suspend_user(UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_suspend_user(UUID, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(UUID, INTEGER, TEXT) TO authenticated;

-- Reactivates every account whose suspension has ended.
CREATE OR REPLACE FUNCTION public.lift_expired_suspensions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.users
     SET status = 'active'
   WHERE status = 'suspended'
     AND suspended_until IS NOT NULL
     AND suspended_until <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.lift_expired_suspensions() FROM PUBLIC;

-- Signing in after the suspension ended should not wait for the next job run.
CREATE OR REPLACE FUNCTION public.lift_my_expired_suspension()
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me  UUID := public.current_app_user_id();
  v_row public.users;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;
  UPDATE public.users
     SET status = 'active'
   WHERE id = v_me
     AND status = 'suspended'
     AND suspended_until IS NOT NULL
     AND suspended_until <= NOW();
  SELECT * INTO v_row FROM public.users WHERE id = v_me;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.lift_my_expired_suspension() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lift_my_expired_suspension() FROM anon;
GRANT EXECUTE ON FUNCTION public.lift_my_expired_suspension() TO authenticated;

COMMIT;

-- pg_cron (outside the transaction, like 073).
DO $$
BEGIN
  PERFORM cron.unschedule('lift-expired-suspensions');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet
END $$;

SELECT cron.schedule(
  'lift-expired-suspensions',
  '*/10 * * * *',
  $$SELECT public.lift_expired_suspensions()$$
);

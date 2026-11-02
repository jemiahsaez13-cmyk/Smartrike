-- =============================================================================
-- 082 · Body numbers per TODA route, inactive body numbers (B5, B7, C2)
-- -----------------------------------------------------------------------------
--  1. franchise_applications.route_id → toda_routes: the administrator picks
--     the unit's TODA route together with the body number at MTOP issuance.
--     A renewal keeps the route of the unit it renews.
--  2. A terminated (or transferred) unit keeps blocking its body number until
--     an administrator authorizes reassignment with release_body_number(id,
--     reason). That stamps body_number_released_at / _by / _reason on every
--     record of that number in the TODA, and the uniqueness index (072) now
--     ignores released records, so the number can be issued again.
--     Refused while an active or open MTOP still holds the number.
--  3. enforce_mtop_workflow (074) + 082 changes: drivers can never set the
--     route or the release fields; the release RPC may change only those.
--
-- Apply after 081. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.toda_routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS body_number_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS body_number_released_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS body_number_release_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_franchise_route ON public.franchise_applications(route_id);

-- ── 2. Uniqueness: released numbers can be issued again ─────────────────────
DROP INDEX IF EXISTS public.idx_franchise_body_number;
CREATE UNIQUE INDEX IF NOT EXISTS idx_franchise_body_number
  ON public.franchise_applications (toda, body_number)
  WHERE body_number IS NOT NULL AND type <> 'renewal' AND body_number_released_at IS NULL;

-- ── 3. Workflow guard (074 + 082) ───────────────────────────────────────────
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
       -- 082: route and body-number release are administrator fields too.
       OR NEW.route_id IS DISTINCT FROM OLD.route_id
       OR NEW.body_number_released_at IS DISTINCT FROM OLD.body_number_released_at
       OR NEW.body_number_released_by IS DISTINCT FROM OLD.body_number_released_by
       OR NEW.body_number_release_reason IS DISTINCT FROM OLD.body_number_release_reason
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

-- ── 4. Authorized reassignment of an inactive body number ───────────────────
CREATE OR REPLACE FUNCTION public.release_body_number(p_franchise_id UUID, p_reason TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec    public.franchise_applications%ROWTYPE;
  v_reason TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_count  INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can release a body number.';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Give the reason for releasing this body number.';
  END IF;

  SELECT * INTO v_rec FROM public.franchise_applications WHERE id = p_franchise_id;
  IF NOT FOUND OR COALESCE(btrim(v_rec.body_number), '') = '' THEN
    RAISE EXCEPTION 'This MTOP record has no body number.';
  END IF;
  IF v_rec.body_number_released_at IS NOT NULL THEN
    RAISE EXCEPTION 'Body number % is already released.', v_rec.body_number;
  END IF;

  -- Still held: an open application or renewal, or an issued unit that is
  -- not terminated, transferred or superseded by a renewal.
  IF EXISTS (
    SELECT 1 FROM public.franchise_applications f
     WHERE f.toda IS NOT DISTINCT FROM v_rec.toda
       AND upper(btrim(f.body_number)) = upper(btrim(v_rec.body_number))
       AND f.body_number_released_at IS NULL
       AND f.status <> 'rejected'
       AND NOT (f.status = 'issued' AND f.franchise_status IN ('terminated', 'transferred', 'renewed'))
  ) THEN
    RAISE EXCEPTION 'Body number % is still held by an active or open MTOP. Terminate it first.', v_rec.body_number;
  END IF;

  PERFORM set_config('app.body_release_rpc', 'on', true);
  UPDATE public.franchise_applications
     SET body_number_released_at = NOW(),
         body_number_released_by = public.current_app_user_id(),
         body_number_release_reason = left(v_reason, 300)
   WHERE toda IS NOT DISTINCT FROM v_rec.toda
     AND upper(btrim(body_number)) = upper(btrim(v_rec.body_number))
     AND body_number_released_at IS NULL
     AND status <> 'rejected';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('app.body_release_rpc', 'off', true);
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.release_body_number(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_body_number(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.release_body_number(UUID, TEXT) TO authenticated;

COMMIT;

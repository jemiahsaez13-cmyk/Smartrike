-- =============================================================================
-- 086 · Admin-managed MTOP billing & payment (B2 + C1)
-- -----------------------------------------------------------------------------
-- The driver no longer pays inside the app (no screenshot, reference or
-- appointment). The FEDTODAB office bills and records the payment:
--
--   • Billing statement: when the admin sends the billing, the server stamps a
--     statement number (BS-<year>-<00001>) and a due date (30 days later,
--     Asia/Manila). Re-sending keeps both. Older billed rows are backfilled.
--   • record_mtop_payment(id, amount, paid_on, method, reference) — admin
--     only. Full fee required (no partial payments), date not in the future,
--     method cash / gcash / bank / check, OR or reference no. unique across
--     recorded MTOP payments. Marks the fee paid and moves the application to
--     Approved, like a verified proof did.
--   • enforce_mtop_workflow (082 version) + 086 changes:
--       - drivers can no longer write any payment or billing field;
--       - approval accepts a recorded payment (no screenshot needed);
--       - payment_amount / payment_paid_on / payment_recorded_by can only be
--         written by record_mtop_payment().
--   • submit_mtop_payment (038) now refuses: payment is recorded by the office.
--   • The driver is notified when a billing statement is sent and when the
--     payment is recorded (or a legacy proof is verified).
--
-- Legacy rows whose proof was already submitted can still be verified or
-- rejected with review_mtop_payment (055).
--
-- Apply after 085. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 0. Prerequisites ────────────────────────────────────────────────────────
-- 086 replaces the 082 workflow guard and the 085 billing stamp, so both must
-- already be applied (applying 085 after 086 would undo the statement number).
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'franchise_applications'
                    AND column_name = 'route_id') THEN
    v_missing := array_append(v_missing, '082_body_number_routes_and_release.sql');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'franchise_applications'
                    AND column_name = 'billing_sent_at') THEN
    v_missing := array_append(v_missing, '085_succession_documents_and_billing_date.sql');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Apply % first, then run 086 again.', array_to_string(v_missing, ' and ');
  END IF;
END;
$$;

-- ── 1. Columns ──────────────────────────────────────────────────────────────
-- 043 / 044 columns (043 is not in the 044–058 catch-up, so some databases
-- never got it; 085 and 086 both read selected_payment_methods).
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS selected_payment_methods       JSONB,
  ADD COLUMN IF NOT EXISTS appointment_date               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chosen_payment_method_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS billing_statement_no TEXT,
  ADD COLUMN IF NOT EXISTS billing_due_date     DATE,
  ADD COLUMN IF NOT EXISTS payment_amount       NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_paid_on      DATE,
  ADD COLUMN IF NOT EXISTS payment_recorded_by  UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_franchise_billing_statement_no
  ON public.franchise_applications (billing_statement_no)
  WHERE billing_statement_no IS NOT NULL;

ALTER TABLE public.franchise_applications
  DROP CONSTRAINT IF EXISTS franchise_payment_amount_check;
ALTER TABLE public.franchise_applications
  ADD CONSTRAINT franchise_payment_amount_check
  CHECK (payment_amount IS NULL OR (payment_amount > 0 AND payment_amount <= 1000000));

CREATE SEQUENCE IF NOT EXISTS public.mtop_billing_statement_seq;
GRANT USAGE ON SEQUENCE public.mtop_billing_statement_seq TO authenticated;

-- BS-2026-00001
CREATE OR REPLACE FUNCTION public.next_mtop_statement_no(p_on DATE DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
SET search_path = public
AS $$
  SELECT 'BS-' || EXTRACT(YEAR FROM COALESCE(p_on, public.manila_today()))::INTEGER
         || '-' || lpad(nextval('public.mtop_billing_statement_seq')::TEXT, 5, '0');
$$;

-- ── 2. Billing stamp (085) + statement number and due date ──────────────────
-- Server-only columns: set when the admin sends the billing, otherwise kept.
CREATE OR REPLACE FUNCTION public.stamp_mtop_billing_sent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.selected_payment_methods IS NOT NULL
     AND NEW.selected_payment_methods IS DISTINCT FROM OLD.selected_payment_methods THEN
    NEW.billing_sent_at      := now();
    NEW.billing_statement_no := COALESCE(OLD.billing_statement_no, public.next_mtop_statement_no());
    NEW.billing_due_date     := COALESCE(OLD.billing_due_date, public.manila_today() + 30);
  ELSE
    NEW.billing_sent_at      := OLD.billing_sent_at;
    NEW.billing_statement_no := OLD.billing_statement_no;
    NEW.billing_due_date     := OLD.billing_due_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_mtop_billing_sent_trigger ON public.franchise_applications;
CREATE TRIGGER stamp_mtop_billing_sent_trigger
  BEFORE UPDATE ON public.franchise_applications
  FOR EACH ROW EXECUTE FUNCTION public.stamp_mtop_billing_sent();

-- ── 3. Workflow guard (082 version + 086 changes) ───────────────────────────
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

-- ── 4. Driver payment submission is retired ─────────────────────────────────
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
BEGIN
  RAISE EXCEPTION 'MTOP payments are recorded by the FEDTODAB office. Pay at the office and keep your official receipt.';
END;
$$;

-- ── 5. Admin records the payment ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_mtop_payment(
  p_application_id UUID,
  p_amount NUMERIC,
  p_paid_on DATE,
  p_method TEXT,
  p_reference TEXT
)
RETURNS SETOF public.franchise_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.franchise_applications%ROWTYPE;
  v_ref TEXT := upper(btrim(COALESCE(p_reference, '')));
  v_me  UUID := public.current_app_user_id();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator permission required.'; END IF;

  SELECT * INTO v_app FROM public.franchise_applications WHERE id = p_application_id FOR UPDATE;
  IF v_app.id IS NULL THEN RAISE EXCEPTION 'MTOP application not found.'; END IF;
  IF v_app.status <> 'payment' OR v_app.payment_status = 'paid' THEN
    RAISE EXCEPTION 'This MTOP application is not waiting for payment.';
  END IF;
  IF v_app.billing_sent_at IS NULL AND v_app.selected_payment_methods IS NULL THEN
    RAISE EXCEPTION 'Send the billing statement before recording the payment.';
  END IF;
  IF p_amount IS NULL OR p_amount < v_app.fees THEN
    RAISE EXCEPTION 'Record the full fee of PHP % (partial payments are not accepted).',
      to_char(v_app.fees, 'FM999,999,990.00');
  END IF;
  IF p_amount > 1000000 THEN RAISE EXCEPTION 'Enter a valid amount.'; END IF;
  IF p_paid_on IS NULL OR p_paid_on > public.manila_today() THEN
    RAISE EXCEPTION 'The payment date cannot be in the future.';
  END IF;
  IF p_paid_on < (v_app.created_at AT TIME ZONE 'Asia/Manila')::DATE THEN
    RAISE EXCEPTION 'The payment date cannot be before the application was filed.';
  END IF;
  IF COALESCE(p_method, '') NOT IN ('cash', 'gcash', 'bank', 'check') THEN
    RAISE EXCEPTION 'Choose how the payment was made.';
  END IF;
  IF v_ref !~ '^[A-Z0-9][A-Z0-9 /_-]{2,63}$' THEN
    RAISE EXCEPTION 'Enter the OR or reference number (3 to 64 letters or digits).';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.franchise_applications f
     WHERE f.id <> v_app.id
       AND f.payment_recorded_by IS NOT NULL
       AND upper(btrim(f.payment_reference)) = v_ref
  ) THEN
    RAISE EXCEPTION 'OR / reference no. % is already recorded on another MTOP payment.', v_ref;
  END IF;

  PERFORM set_config('app.record_mtop_payment', 'on', TRUE);
  RETURN QUERY
  UPDATE public.franchise_applications
     SET status                   = 'approved',
         payment_status           = 'paid',
         payment_review_status    = 'verified',
         payment_verified_at      = NOW(),
         payment_verified_by      = v_me,
         payment_rejection_reason = NULL,
         payment_method           = p_method,
         payment_reference        = v_ref,
         payment_amount           = round(p_amount, 2),
         payment_paid_on          = p_paid_on,
         payment_recorded_by      = v_me,
         updated_at               = NOW()
   WHERE id = v_app.id
  RETURNING *;
  PERFORM set_config('app.record_mtop_payment', 'off', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.record_mtop_payment(UUID, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_mtop_payment(UUID, NUMERIC, DATE, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_mtop_payment(UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated;

-- ── 6. Driver notices: billing sent, payment recorded ───────────────────────
CREATE OR REPLACE FUNCTION public.notify_driver_mtop_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NEW.billing_sent_at IS NOT NULL
       AND NEW.billing_sent_at IS DISTINCT FROM OLD.billing_sent_at
       AND NEW.payment_status <> 'paid' THEN
      INSERT INTO public.notifications (user_id, type, title, body, read) VALUES (
        NEW.driver_id, 'franchise_status', 'MTOP billing statement',
        format('Statement %s: PHP %s due by %s. Pay at the FEDTODAB office and keep your official receipt; the office records your payment.',
               COALESCE(NEW.billing_statement_no, '—'),
               to_char(NEW.fees, 'FM999,999,990.00'),
               COALESCE(to_char(NEW.billing_due_date, 'Mon DD, YYYY'), 'the date on the statement')),
        FALSE);
    END IF;

    IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
      INSERT INTO public.notifications (user_id, type, title, body, read) VALUES (
        NEW.driver_id, 'franchise_status', 'MTOP payment recorded',
        format('PHP %s paid on %s%s. Your application is approved; the office will issue your MTOP.',
               to_char(COALESCE(NEW.payment_amount, NEW.fees), 'FM999,999,990.00'),
               to_char(COALESCE(NEW.payment_paid_on, (NEW.payment_verified_at AT TIME ZONE 'Asia/Manila')::DATE), 'Mon DD, YYYY'),
               CASE WHEN NULLIF(btrim(NEW.payment_reference), '') IS NOT NULL
                    THEN ', OR / ref. ' || NEW.payment_reference ELSE '' END),
        FALSE);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- A notice must never block the billing or the payment.
    NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_driver_mtop_billing() FROM PUBLIC;

DROP TRIGGER IF EXISTS notify_driver_mtop_billing_trigger ON public.franchise_applications;
CREATE TRIGGER notify_driver_mtop_billing_trigger
  AFTER UPDATE ON public.franchise_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_driver_mtop_billing();

-- ── 7. Backfill statement numbers for billings sent before 086 ──────────────
-- The workflow and stamp triggers are paused for this one data fix (same as 074).
ALTER TABLE public.franchise_applications DISABLE TRIGGER enforce_mtop_workflow_trigger;
ALTER TABLE public.franchise_applications DISABLE TRIGGER stamp_mtop_billing_sent_trigger;
ALTER TABLE public.franchise_applications DISABLE TRIGGER notify_driver_mtop_billing_trigger;
DO $$
DECLARE
  r RECORD;
  v_on DATE;
BEGIN
  FOR r IN
    SELECT id, COALESCE(billing_sent_at, updated_at) AS billed
      FROM public.franchise_applications
     WHERE billing_statement_no IS NULL
       AND (billing_sent_at IS NOT NULL OR selected_payment_methods IS NOT NULL)
     ORDER BY COALESCE(billing_sent_at, updated_at), created_at
  LOOP
    v_on := (r.billed AT TIME ZONE 'Asia/Manila')::DATE;
    UPDATE public.franchise_applications
       SET billing_statement_no = public.next_mtop_statement_no(v_on),
           billing_due_date     = COALESCE(billing_due_date, v_on + 30)
     WHERE id = r.id;
  END LOOP;
END;
$$;
ALTER TABLE public.franchise_applications ENABLE TRIGGER notify_driver_mtop_billing_trigger;
ALTER TABLE public.franchise_applications ENABLE TRIGGER stamp_mtop_billing_sent_trigger;
ALTER TABLE public.franchise_applications ENABLE TRIGGER enforce_mtop_workflow_trigger;

COMMIT;

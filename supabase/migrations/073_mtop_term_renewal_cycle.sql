-- =============================================================================
-- 073 · MTOP 3-year term, annual renewal window, suspension and termination
-- -----------------------------------------------------------------------------
-- Rules (all dates in Asia/Manila):
--   • An MTOP term runs 3 years from the date it is issued. Annual renewals
--     do not move the expiry; a renewal filed after the term has expired
--     starts a new 3-year term.
--   • Every year the franchise must be renewed between January 1 and
--     March 31. January is the regular period, February–March the grace
--     period. Renewals are not accepted outside that window.
--   • Missing one year's renewal (still unrenewed after March 31) suspends
--     the MTOP; three missed years terminate it. Suspended, expired and
--     terminated MTOPs cannot go online.
--   • Renewal notices follow the calendar, not the issue date: every MTOP
--     gets one on January 1 (period opens, deadline March 31), February 1
--     (grace period) and March 31 (deadline day). Drivers are also notified
--     60 days before expiry and when the MTOP is suspended, expires or is
--     terminated.
--   • A renewal keeps the MTOP number; the record it replaces is marked
--     'renewed' so the registry shows one current record per franchise.
--
-- run_mtop_renewal_cycle() applies the rules daily via pg_cron.
-- Requires migration 072. Idempotent: safe to run more than once.
-- =============================================================================

-- ── 1. Record statuses: + suspended, + renewed ─────────────────────────────
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.franchise_applications'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%franchise_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.franchise_applications DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.franchise_applications
  ADD CONSTRAINT franchise_applications_franchise_status_check
  CHECK (franchise_status IN (
    'active', 'pending_renewal', 'suspended', 'expired',
    'terminated', 'transferred', 'renewed'
  ));

-- ── 2. Helpers ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manila_today()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$ SELECT (now() AT TIME ZONE 'Asia/Manila')::date $$;

-- Renewal years that have passed their March 31 deadline unrenewed.
CREATE OR REPLACE FUNCTION public.mtop_missed_renewal_years(p_covered_year INTEGER, p_today DATE)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(
    0,
    EXTRACT(YEAR FROM p_today)::INTEGER - p_covered_year
      - CASE WHEN EXTRACT(MONTH FROM p_today) <= 3 THEN 1 ELSE 0 END
  )
$$;

-- ── 3. Workflow trigger (072 version + 073 renewal window + lifecycle) ──────
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
      NEW.fees := CASE WHEN NEW.type = 'renewal' THEN 1000 ELSE 1500 END;
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

-- ── 4. Term dates on issuance ───────────────────────────────────────────────
-- Fires before enforce_mtop_workflow_trigger (triggers run in name order), so
-- the dates are fixed server-side whatever the admin client sent.
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

  IF NEW.type = 'renewal' THEN
    SELECT * INTO v_prev FROM public.franchise_applications f
     WHERE f.driver_id = NEW.driver_id
       AND f.id <> NEW.id
       AND f.status = 'issued'
       AND COALESCE(f.franchise_status, 'active') NOT IN ('renewed', 'transferred')
     ORDER BY f.issued_at DESC NULLS LAST, f.created_at DESC
     LIMIT 1;

    NEW.renewal_year := EXTRACT(YEAR FROM (NEW.created_at AT TIME ZONE 'Asia/Manila'))::INTEGER;
    NEW.last_renewed_at := v_today;
  END IF;

  IF v_prev.id IS NOT NULL THEN
    -- Same franchise: keep its MTOP number and original holder.
    NEW.mtop_number := COALESCE(v_prev.mtop_number, NEW.mtop_number);
    NEW.original_holder_name := COALESCE(v_prev.original_holder_name, NEW.original_holder_name);
    IF v_prev.issued_at IS NOT NULL AND v_prev.expiry_date IS NOT NULL AND v_prev.expiry_date >= v_today THEN
      -- Annual renewal inside the running 3-year term.
      NEW.issued_at := v_prev.issued_at;
      NEW.expiry_date := v_prev.expiry_date;
    ELSE
      -- Term already expired: the renewal starts a new 3-year term.
      NEW.issued_at := v_today;
      NEW.expiry_date := (v_today + INTERVAL '3 years')::DATE;
    END IF;

    PERFORM set_config('app.mtop_lifecycle', 'on', TRUE);
    UPDATE public.franchise_applications SET franchise_status = 'renewed' WHERE id = v_prev.id;
    PERFORM set_config('app.mtop_lifecycle', 'off', TRUE);
  ELSE
    NEW.issued_at := v_today;
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

-- ── 5. Renewal notices (one per franchise, year and kind) ───────────────────
CREATE TABLE IF NOT EXISTS public.franchise_renewal_notices (
  franchise_id UUID NOT NULL REFERENCES public.franchise_applications(id) ON DELETE CASCADE,
  notice_year  INTEGER NOT NULL,
  kind         TEXT NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (franchise_id, notice_year, kind)
);
-- Written only by the SECURITY DEFINER functions below; no client access.
ALTER TABLE public.franchise_renewal_notices ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.send_mtop_notice(
  p_franchise_id UUID,
  p_driver_id    UUID,
  p_year         INTEGER,
  p_kind         TEXT,
  p_title        TEXT,
  p_body         TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  INSERT INTO public.franchise_renewal_notices (franchise_id, notice_year, kind)
  VALUES (p_franchise_id, p_year, p_kind)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, body, read)
    VALUES (p_driver_id, 'franchise_status', p_title, p_body, FALSE);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.send_mtop_notice(UUID, UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;

-- ── 6. Daily renewal cycle ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_mtop_renewal_cycle()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          RECORD;
  v_today    DATE    := public.manila_today();
  v_year     INTEGER := EXTRACT(YEAR FROM public.manila_today())::INTEGER;
  v_month    INTEGER := EXTRACT(MONTH FROM public.manila_today())::INTEGER;
  v_day      INTEGER := EXTRACT(DAY FROM public.manila_today())::INTEGER;
  v_covered  INTEGER;
  v_filed    INTEGER;
  v_missed   INTEGER;
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
    v_label := COALESCE(r.mtop_number, 'Your MTOP');
    v_covered := COALESCE(
      r.renewal_year,
      EXTRACT(YEAR FROM r.issued_at)::INTEGER,
      EXTRACT(YEAR FROM (r.created_at AT TIME ZONE 'Asia/Manila'))::INTEGER
    );

    -- A renewal filed on time counts while the administrator reviews it.
    SELECT MAX(EXTRACT(YEAR FROM (p.created_at AT TIME ZONE 'Asia/Manila'))::INTEGER) INTO v_filed
      FROM public.franchise_applications p
     WHERE p.driver_id = r.driver_id
       AND p.type = 'renewal'
       AND p.status NOT IN ('issued', 'rejected')
       AND EXTRACT(MONTH FROM (p.created_at AT TIME ZONE 'Asia/Manila')) <= 3;
    v_covered := GREATEST(v_covered, COALESCE(v_filed, v_covered));

    v_missed := public.mtop_missed_renewal_years(v_covered, v_today);
    v_status := CASE
      WHEN v_missed >= 3 THEN 'terminated'
      WHEN r.expiry_date IS NOT NULL AND r.expiry_date < v_today THEN 'expired'
      WHEN v_missed >= 1 THEN 'suspended'
      WHEN v_month <= 3 AND v_covered < v_year THEN 'pending_renewal'
      ELSE 'active'
    END;

    IF v_status IS DISTINCT FROM COALESCE(r.franchise_status, 'active') THEN
      UPDATE public.franchise_applications SET franchise_status = v_status WHERE id = r.id;

      IF v_status IN ('suspended', 'expired', 'terminated') THEN
        UPDATE public.users SET current_status = 'offline'
         WHERE id = r.driver_id AND current_status = 'online';
      END IF;

      IF v_status = 'suspended' THEN
        PERFORM public.send_mtop_notice(r.id, r.driver_id, v_year, 'suspended',
          'MTOP suspended',
          v_label || ' is suspended because it was not renewed by March 31. You cannot go online until it is renewed during the next renewal period (January 1 – March 31). After 3 years without renewal the MTOP is terminated.');
      ELSIF v_status = 'expired' THEN
        PERFORM public.send_mtop_notice(r.id, r.driver_id, v_year, 'expired',
          'MTOP expired',
          v_label || ' reached the end of its 3-year term on ' || to_char(r.expiry_date, 'Mon DD, YYYY') || '. You cannot go online until it is renewed for a new term (January 1 – March 31).');
      ELSIF v_status = 'terminated' THEN
        PERFORM public.send_mtop_notice(r.id, r.driver_id, v_year, 'terminated',
          'MTOP terminated',
          v_label || ' was terminated after 3 years without renewal. Submit a new franchise application to operate again.');
      END IF;
    END IF;

    -- Yearly renewal reminders on fixed calendar dates — the same for every
    -- MTOP no matter when it was issued: the period opens January 1 and the
    -- deadline is always March 31. (The job runs at 00:05 Manila, so the
    -- January notice goes out on January 1; a missed run catches up later in
    -- January.)
    IF v_status <> 'terminated' AND v_covered < v_year AND v_month <= 3 THEN
      IF v_month = 1 THEN
        PERFORM public.send_mtop_notice(r.id, r.driver_id, v_year, 'window_open',
          'MTOP renewal is now open',
          'Renew ' || v_label || ' for ' || v_year || ' in the Franchise tab. Renewal period: January 1 – March 31, ' || v_year
            || '. Deadline: March 31, ' || v_year || '. February to March is the grace period; unrenewed MTOPs are suspended starting April 1.');
      ELSE
        PERFORM public.send_mtop_notice(r.id, r.driver_id, v_year, 'grace',
          'MTOP renewal grace period',
          v_label || ' is not yet renewed for ' || v_year || '. Deadline: March 31, ' || v_year || '. Unrenewed MTOPs are suspended starting April 1.');
      END IF;
      IF v_month = 3 AND v_day = 31 THEN
        PERFORM public.send_mtop_notice(r.id, r.driver_id, v_year, 'deadline_day',
          'Today is the MTOP renewal deadline',
          'Today, March 31, ' || v_year || ', is the last day to renew ' || v_label || '. It will be suspended starting April 1 if not renewed.');
      END IF;
    END IF;

    -- Expiry warning 60 days before the end of the 3-year term.
    IF r.expiry_date IS NOT NULL AND r.expiry_date >= v_today AND r.expiry_date - v_today <= 60 THEN
      PERFORM public.send_mtop_notice(r.id, r.driver_id, EXTRACT(YEAR FROM r.expiry_date)::INTEGER, 'expiring',
        'MTOP expiring soon',
        v_label || ' expires on ' || to_char(r.expiry_date, 'Mon DD, YYYY') || ', at the end of its 3-year term.');
    END IF;
  END LOOP;

  PERFORM set_config('app.mtop_lifecycle', 'off', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.run_mtop_renewal_cycle() FROM PUBLIC;

-- ── 7. Block going online with a suspended / expired / terminated MTOP ──────
CREATE OR REPLACE FUNCTION public.enforce_verified_driver_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_franchise RECORD;
BEGIN
  IF NEW.user_type = 'driver'
     AND COALESCE(NEW.verification_status, 'pending') <> 'verified'
     AND COALESCE(NEW.current_status, 'offline') <> 'offline' THEN
    IF TG_OP = 'UPDATE'
       AND NEW.verification_status IS DISTINCT FROM OLD.verification_status
       AND (auth.uid() IS NULL OR public.is_admin()) THEN
      NEW.current_status := 'offline';
    ELSE
      RAISE EXCEPTION 'Driver verification is required before going online or operating trips.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 073: checked only when going online, so a trip in progress can finish.
  IF TG_OP = 'UPDATE'
     AND NEW.user_type = 'driver'
     AND NEW.current_status = 'online'
     AND COALESCE(OLD.current_status, 'offline') = 'offline' THEN
    SELECT f.franchise_status, f.expiry_date INTO v_franchise
      FROM public.franchise_applications f
     WHERE f.driver_id = NEW.id
       AND f.status = 'issued'
       AND COALESCE(f.franchise_status, 'active') NOT IN ('renewed', 'transferred')
     ORDER BY f.issued_at DESC NULLS LAST, f.created_at DESC
     LIMIT 1;
    IF FOUND THEN
      IF v_franchise.franchise_status = 'terminated' THEN
        RAISE EXCEPTION 'Your MTOP was terminated. Submit a new franchise application to operate again.'
          USING ERRCODE = '42501';
      ELSIF v_franchise.franchise_status = 'expired'
         OR (v_franchise.expiry_date IS NOT NULL AND v_franchise.expiry_date < public.manila_today()) THEN
        RAISE EXCEPTION 'Your MTOP has expired. Renew it (January 1 – March 31) before going online.'
          USING ERRCODE = '42501';
      ELSIF v_franchise.franchise_status = 'suspended' THEN
        RAISE EXCEPTION 'Your MTOP is suspended for a missed renewal. Renew it (January 1 – March 31) before going online.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_verified_driver_operation() FROM PUBLIC;

-- ── 8. Passenger view: current record only ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_driver_public_franchise(p_driver_id UUID)
RETURNS TABLE (
  driver_id UUID,
  mtop_number VARCHAR,
  body_number VARCHAR,
  plate_number VARCHAR,
  franchise_status VARCHAR,
  current_holder_name VARCHAR,
  expiry_date DATE,
  last_renewed_at DATE,
  renewal_year INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR public.current_app_user_id() = p_driver_id
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.driver_id = p_driver_id
        AND b.passenger_id = public.current_app_user_id()
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    fa.driver_id,
    fa.mtop_number::VARCHAR,
    fa.body_number::VARCHAR,
    fa.plate_number::VARCHAR,
    (CASE
      WHEN COALESCE(fa.franchise_status, 'active') IN ('active', 'pending_renewal')
           AND fa.expiry_date IS NOT NULL AND fa.expiry_date < public.manila_today() THEN 'expired'
      ELSE COALESCE(fa.franchise_status, 'active')
    END)::VARCHAR,
    COALESCE(fa.current_holder_name, fa.driver_name)::VARCHAR,
    fa.expiry_date,
    fa.last_renewed_at,
    fa.renewal_year
  FROM public.franchise_applications fa
  WHERE fa.driver_id = p_driver_id
    AND (fa.status = 'issued' OR fa.mtop_number IS NOT NULL)
    AND COALESCE(fa.franchise_status, 'active') <> 'renewed'
  ORDER BY fa.issued_at DESC NULLS LAST, fa.created_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_driver_public_franchise(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_driver_public_franchise(UUID) TO authenticated;

-- ── 9. Backfill existing issued records ─────────────────────────────────────
DO $$
BEGIN
  PERFORM set_config('app.mtop_lifecycle', 'on', TRUE);

  UPDATE public.franchise_applications
     SET issued_at = (updated_at AT TIME ZONE 'Asia/Manila')::DATE
   WHERE status = 'issued' AND issued_at IS NULL;

  UPDATE public.franchise_applications
     SET expiry_date = (issued_at + INTERVAL '3 years')::DATE
   WHERE status = 'issued' AND expiry_date IS NULL AND issued_at IS NOT NULL;

  -- Older records superseded by a later issued renewal of the same driver.
  UPDATE public.franchise_applications old
     SET franchise_status = 'renewed'
   WHERE old.status = 'issued'
     AND COALESCE(old.franchise_status, 'active') NOT IN ('renewed', 'transferred', 'terminated')
     AND EXISTS (
       SELECT 1 FROM public.franchise_applications newer
        WHERE newer.driver_id = old.driver_id
          AND newer.id <> old.id
          AND newer.type = 'renewal'
          AND newer.status = 'issued'
          AND (newer.issued_at, newer.created_at) > (old.issued_at, old.created_at)
     );

  PERFORM set_config('app.mtop_lifecycle', 'off', TRUE);
END $$;

-- ── 10. Run daily at 00:05 Asia/Manila (16:05 UTC), and once now ────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('mtop-renewal-cycle');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet
END $$;

SELECT cron.schedule(
  'mtop-renewal-cycle',
  '5 16 * * *',
  $$SELECT public.run_mtop_renewal_cycle()$$
);

SELECT public.run_mtop_renewal_cycle();

-- =============================================================================
-- CATCH-UP: Migrations 044 → 058 (consolidated)
--
-- INSTRUCTIONS:
--   Step 1: Paste THIS file into Supabase SQL Editor → Run.
--   Step 2: Paste 059_review_change_of_unit_rpc.sql → Run.
--
-- Each block is idempotent — safe to re-run if some were already applied.
-- =============================================================================

-- ── 044: chosen_payment_method_snapshot ──────────────────────────────────────
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS chosen_payment_method_snapshot JSONB;

-- ── 045: toda_associations and toda_routes ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.toda_associations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  area          VARCHAR(180),
  contact_name  VARCHAR(120),
  contact_phone VARCHAR(30),
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT toda_associations_name_unique UNIQUE (name)
);
CREATE INDEX IF NOT EXISTS idx_toda_associations_active ON public.toda_associations(is_active);
ALTER TABLE public.toda_associations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage toda associations" ON public.toda_associations;
CREATE POLICY "Admins manage toda associations" ON public.toda_associations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Authenticated users read toda associations" ON public.toda_associations;
CREATE POLICY "Authenticated users read toda associations" ON public.toda_associations
  FOR SELECT TO authenticated USING (TRUE);

CREATE TABLE IF NOT EXISTS public.toda_routes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toda_id         UUID NOT NULL REFERENCES public.toda_associations(id) ON DELETE CASCADE,
  from_barangay   VARCHAR(120) NOT NULL,
  to_barangay     VARCHAR(120) NOT NULL,
  fare            NUMERIC(8, 2) NOT NULL CHECK (fare >= 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT toda_routes_unique_pair UNIQUE (toda_id, from_barangay, to_barangay)
);
CREATE INDEX IF NOT EXISTS idx_toda_routes_toda ON public.toda_routes(toda_id);
CREATE INDEX IF NOT EXISTS idx_toda_routes_from ON public.toda_routes(from_barangay);
ALTER TABLE public.toda_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage toda routes" ON public.toda_routes;
CREATE POLICY "Admins manage toda routes" ON public.toda_routes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Authenticated users read toda routes" ON public.toda_routes;
CREATE POLICY "Authenticated users read toda routes" ON public.toda_routes
  FOR SELECT TO authenticated USING (TRUE);

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.toda_associations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.toda_routes; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ── 046: widen toda_associations.area + area_barangays ───────────────────────
ALTER TABLE public.toda_associations ALTER COLUMN area TYPE TEXT;
ALTER TABLE public.toda_associations ADD COLUMN IF NOT EXISTS area_barangays JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── 047: toda_routes discount columns ────────────────────────────────────────
ALTER TABLE public.toda_routes
  ADD COLUMN IF NOT EXISTS senior_discount  NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (senior_discount  BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS pwd_discount     NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (pwd_discount     BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS student_discount NUMERIC(5,2) NOT NULL DEFAULT 0  CHECK (student_discount BETWEEN 0 AND 100);

-- ── 048: franchise_events change_of_unit columns ─────────────────────────────
ALTER TABLE public.franchise_events
  ADD COLUMN IF NOT EXISTS new_plate_number  VARCHAR(30) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS new_body_number   VARCHAR(30) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS or_number         VARCHAR(60) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cr_number         VARCHAR(60) DEFAULT NULL;

-- ── 049: franchise_applications COU request columns ──────────────────────────
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS cou_status            VARCHAR(20) DEFAULT NULL
    CHECK (cou_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS cou_new_plate         VARCHAR(30) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_new_body          VARCHAR(30) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_or_number         VARCHAR(60) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_cr_number         VARCHAR(60) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_requested_at      TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_reviewed_at       TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_reviewed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cou_rejection_reason  TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_franchise_cou_status
  ON public.franchise_applications(cou_status)
  WHERE cou_status IS NOT NULL;

-- ── 050: payment verification issues MTOP directly ───────────────────────────
CREATE OR REPLACE FUNCTION public.review_mtop_payment(
  p_application_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.franchise_applications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_mtop_number TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator permission required.'; END IF;
  IF p_decision NOT IN ('verified', 'rejected') THEN RAISE EXCEPTION 'Invalid payment decision.'; END IF;
  IF p_decision = 'rejected' AND COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Enter a reason for rejecting the payment proof.';
  END IF;
  IF p_decision = 'verified' THEN
    v_mtop_number := 'MTOP-' || EXTRACT(YEAR FROM NOW())::TEXT || '-'
                     || LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0');
    UPDATE public.franchise_applications
       SET status = 'approved', payment_status = 'paid', payment_review_status = 'verified',
           payment_verified_at = NOW(), payment_verified_by = public.current_app_user_id(),
           payment_rejection_reason = NULL, mtop_number = v_mtop_number,
           original_holder_name = COALESCE(original_holder_name, driver_name),
           current_holder_name = driver_name, updated_at = NOW()
     WHERE id = p_application_id AND status = 'payment'
       AND payment_review_status = 'pending_review'
       AND payment_proof_url IS NOT NULL AND btrim(COALESCE(payment_reference, '')) <> '';
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment is not pending review.'; END IF;
    RETURN QUERY
    UPDATE public.franchise_applications
       SET status = 'issued', franchise_status = 'active', issued_at = CURRENT_DATE, updated_at = NOW()
     WHERE id = p_application_id AND status = 'approved'
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

-- ── 051: COU image columns ────────────────────────────────────────────────────
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS cou_or_image    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_cr_image    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_unit_image  TEXT DEFAULT NULL;

-- ── 052: require Driver's License in mtop_documents_are_approved ──────────────
CREATE OR REPLACE FUNCTION public.mtop_documents_are_approved(p_documents JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(p_documents) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'Driver''s License',
        'Barangay Clearance',
        'Community Tax Certificate (Cedula)',
        'OR/CR of Tricycle Unit',
        'Proof of Ownership',
        'TODA Membership Certificate'
      ]) AS required(name)
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_documents) AS document
        WHERE document->>'name' = required.name
          AND COALESCE((document->>'uploaded')::BOOLEAN, FALSE)
          AND document->>'review_status' = 'approved'
          AND COALESCE(document->>'file_url', '') <> ''
      )
    );
$$;

-- ── 053: license_number snapshot column ──────────────────────────────────────
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS license_number VARCHAR(50);

-- ── 054: fix review_mtop_payment for DATE issued_at (already correct in 050) ─
-- No additional DDL needed — 050 already uses CURRENT_DATE.

-- ── 055: payment verification approves only; issuance is separate ─────────────
CREATE OR REPLACE FUNCTION public.review_mtop_payment(
  p_application_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.franchise_applications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

-- ── 056: cou_unit_type, cou_vehicle_make/model, vehicle_make/model ────────────
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS cou_unit_type   VARCHAR(20)
    CHECK (cou_unit_type IN ('sidecar', 'motor', 'both')),
  ADD COLUMN IF NOT EXISTS cou_vehicle_make  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cou_vehicle_model VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vehicle_make      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vehicle_model     VARCHAR(100);

-- ── 057: allow 'both' in cou_unit_type (constraint already covers it above) ───
ALTER TABLE public.franchise_applications
  DROP CONSTRAINT IF EXISTS franchise_applications_cou_unit_type_check;
ALTER TABLE public.franchise_applications
  ADD CONSTRAINT franchise_applications_cou_unit_type_check
  CHECK (cou_unit_type IN ('sidecar', 'motor', 'both'));

-- ── 058: submit_change_of_unit_request SECURITY DEFINER RPC ──────────────────
CREATE OR REPLACE FUNCTION public.submit_change_of_unit_request(
  p_application_id UUID,
  p_unit_type TEXT,
  p_new_plate TEXT,
  p_new_body TEXT,
  p_or_number TEXT DEFAULT NULL,
  p_cr_number TEXT DEFAULT NULL,
  p_vehicle_make TEXT DEFAULT NULL,
  p_vehicle_model TEXT DEFAULT NULL,
  p_or_image TEXT DEFAULT NULL,
  p_cr_image TEXT DEFAULT NULL,
  p_unit_image TEXT DEFAULT NULL
)
RETURNS SETOF public.franchise_applications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_owner UUID := public.current_app_user_id();
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_unit_type NOT IN ('sidecar', 'motor', 'both') THEN RAISE EXCEPTION 'Select Sidecar, Motor, or Both.'; END IF;
  IF COALESCE(btrim(p_new_body), '') = '' THEN RAISE EXCEPTION 'New body/sidecar number is required.'; END IF;
  IF p_unit_type <> 'sidecar' AND (
    COALESCE(btrim(p_new_plate), '') = '' OR COALESCE(btrim(p_or_number), '') = ''
    OR COALESCE(btrim(p_cr_number), '') = '' OR COALESCE(btrim(p_vehicle_make), '') = ''
    OR COALESCE(btrim(p_vehicle_model), '') = ''
  ) THEN
    RAISE EXCEPTION 'Complete the plate, OR/CR, manufacturer, and model for the replacement motor.';
  END IF;

  PERFORM set_config('app.change_of_unit_rpc', 'on', TRUE);

  RETURN QUERY
  UPDATE public.franchise_applications
     SET cou_status       = 'pending',
         cou_unit_type    = p_unit_type,
         cou_vehicle_make = CASE WHEN p_unit_type = 'sidecar' THEN NULL ELSE btrim(p_vehicle_make) END,
         cou_vehicle_model= CASE WHEN p_unit_type = 'sidecar' THEN NULL ELSE btrim(p_vehicle_model) END,
         cou_new_plate    = upper(btrim(p_new_plate)),
         cou_new_body     = upper(btrim(p_new_body)),
         cou_or_number    = CASE WHEN p_unit_type = 'sidecar' THEN NULL ELSE btrim(p_or_number) END,
         cou_cr_number    = CASE WHEN p_unit_type = 'sidecar' THEN NULL ELSE btrim(p_cr_number) END,
         cou_or_image     = p_or_image,
         cou_cr_image     = p_cr_image,
         cou_unit_image   = p_unit_image,
         cou_requested_at = NOW(),
         cou_reviewed_at  = NULL,
         cou_reviewed_by  = NULL,
         cou_rejection_reason = NULL,
         updated_at       = NOW()
   WHERE id = p_application_id
     AND driver_id = v_owner
     AND status = 'issued'
     AND COALESCE(cou_status, '') <> 'pending'
  RETURNING *;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issued MTOP not found or a Change of Unit request is already pending.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_change_of_unit_request(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_change_of_unit_request(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

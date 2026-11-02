-- =============================================================================
-- 085 · Succession supporting documents + MTOP billing date
-- -----------------------------------------------------------------------------
-- B13 · A succession request now carries supporting documents, reviewed one
--       by one like MTOP documents:
--         required  proof_of_relationship  birth / marriage certificate
--         required  successor_valid_id     successor's government ID
--         optional  supporting             affidavit, waiver, death certificate…
--       • request_franchise_succession() takes p_documents (JSONB array of
--         { key, file_url, file_name }) and stores them as "pending".
--       • review_succession_document()  admin approves / rejects one document;
--         the holder is notified of a rejection.
--       • reupload_succession_document() holder replaces a rejected document
--         on a pending request; admins are alerted.
--       • A request cannot be approved while a document is not approved.
--         Requests made before 085 have no documents and are unaffected.
-- B3  · franchise_applications.billing_sent_at is stamped whenever the admin
--       sends (or re-sends) the billing, so payments can be monitored by date.
--       Older rows stay NULL; the app falls back to updated_at for them.
--
-- Apply after 084. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Documents column ─────────────────────────────────────────────────────
ALTER TABLE public.franchise_succession_requests
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Label shown to the holder and the admin for each document key.
CREATE OR REPLACE FUNCTION public.succession_document_label(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_key
    WHEN 'proof_of_relationship' THEN 'Proof of relationship (birth or marriage certificate)'
    WHEN 'successor_valid_id'    THEN 'Successor''s valid ID'
    WHEN 'supporting'            THEN 'Other supporting document'
  END;
$$;

-- Checks one uploaded file: an image data URI (≤ 2.5 MB) or an https URL.
CREATE OR REPLACE FUNCTION public.succession_document_url_ok(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_url IS NOT NULL
     AND (
       (p_url ~ '^data:image/(jpeg|png|webp);base64,' AND char_length(p_url) <= 3400000)
       OR (p_url ~ '^https://' AND char_length(p_url) <= 2048)
     );
$$;

-- ── 2. Request (holder) ─────────────────────────────────────────────────────
-- Same as 075 plus p_documents. The 7-argument version is dropped so an old
-- app build cannot file a request without documents.
DROP FUNCTION IF EXISTS public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.request_franchise_succession(
  p_franchise_id    UUID,
  p_has_account     BOOLEAN,
  p_successor_name  TEXT,
  p_successor_email TEXT,
  p_successor_phone TEXT,
  p_relationship    TEXT,
  p_reason          TEXT,
  p_documents       JSONB
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
    relationship, reason, documents
  ) VALUES (
    p_franchise_id, v_me, COALESCE(v_me_name, 'Driver'),
    p_has_account,
    CASE WHEN p_has_account THEN v_successor.id END,
    v_name,
    NULLIF(v_email, ''),
    v_phone,
    p_relationship,
    btrim(p_reason),
    v_docs
  )
  RETURNING * INTO v_request;

  -- Admins are alerted by alert_admins_succession_trigger (083).
  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ── 3. Per-document review (admin) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_succession_document(
  p_request_id UUID,
  p_key        TEXT,
  p_decision   TEXT,
  p_remarks    TEXT DEFAULT NULL
)
RETURNS public.franchise_succession_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.franchise_succession_requests%ROWTYPE;
  v_remarks TEXT := NULLIF(btrim(COALESCE(p_remarks, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can review succession documents.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Unknown decision %.', p_decision;
  END IF;
  IF p_decision = 'rejected' AND char_length(COALESCE(v_remarks, '')) < 3 THEN
    RAISE EXCEPTION 'Enter the reason for rejecting the document.';
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
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_request.documents) d WHERE d->>'key' = p_key) THEN
    RAISE EXCEPTION 'Document not found on this request.';
  END IF;

  UPDATE public.franchise_succession_requests
     SET documents = (
       SELECT COALESCE(jsonb_agg(
                CASE WHEN d->>'key' = p_key
                     THEN d || jsonb_build_object(
                            'review_status', p_decision,
                            'review_remarks', CASE WHEN p_decision = 'rejected' THEN v_remarks END)
                     ELSE d END
                ORDER BY ord), '[]'::jsonb)
         FROM jsonb_array_elements(v_request.documents) WITH ORDINALITY AS t(d, ord)
     )
   WHERE id = p_request_id
  RETURNING * INTO v_request;

  IF p_decision = 'rejected' THEN
    INSERT INTO public.notifications (user_id, type, title, body, read) VALUES
      (v_request.requested_by, 'franchise_status', 'Succession document rejected',
       COALESCE(public.succession_document_label(p_key), 'A document') || ' was rejected: ' || v_remarks
         || '. Upload a corrected copy in your Franchise tab.', FALSE);
  END IF;

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.review_succession_document(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_succession_document(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_succession_document(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ── 4. Re-upload a rejected document (holder) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.reupload_succession_document(
  p_request_id UUID,
  p_key        TEXT,
  p_file_url   TEXT,
  p_file_name  TEXT DEFAULT NULL
)
RETURNS public.franchise_succession_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.franchise_succession_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.franchise_succession_requests
   WHERE id = p_request_id
   FOR UPDATE;
  IF NOT FOUND OR v_request.requested_by IS DISTINCT FROM public.current_app_user_id() THEN
    RAISE EXCEPTION 'Succession request not found.';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This succession request was already reviewed.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_request.documents) d
     WHERE d->>'key' = p_key AND d->>'review_status' = 'rejected'
  ) THEN
    RAISE EXCEPTION 'Only a rejected document can be replaced.';
  END IF;
  IF NOT public.succession_document_url_ok(p_file_url) THEN
    RAISE EXCEPTION 'Choose a JPEG, PNG, or WebP image under 2.5 MB.';
  END IF;

  UPDATE public.franchise_succession_requests
     SET documents = (
       SELECT COALESCE(jsonb_agg(
                CASE WHEN d->>'key' = p_key
                     THEN d || jsonb_build_object(
                            'file_url', p_file_url,
                            'file_name', NULLIF(left(btrim(COALESCE(p_file_name, '')), 255), ''),
                            'uploaded_at', now(),
                            'review_status', 'pending',
                            'review_remarks', NULL)
                     ELSE d END
                ORDER BY ord), '[]'::jsonb)
         FROM jsonb_array_elements(v_request.documents) WITH ORDINALITY AS t(d, ord)
     )
   WHERE id = p_request_id
  RETURNING * INTO v_request;

  PERFORM public.notify_admins_event(
    'admin_succession',
    'Corrected succession document',
    format('%s re-uploaded "%s" for their succession request. Review it in the Franchise Registry.',
           v_request.requested_by_name, public.succession_document_label(p_key))
  );

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.reupload_succession_document(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reupload_succession_document(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reupload_succession_document(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ── 5. No approval while a document is not approved ─────────────────────────
CREATE OR REPLACE FUNCTION public.guard_succession_documents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved'
     AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(NEW.documents) d
        WHERE COALESCE(d->>'review_status', 'pending') <> 'approved'
     ) THEN
    RAISE EXCEPTION 'Approve every succession document before approving the request.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_succession_documents_trigger ON public.franchise_succession_requests;
CREATE TRIGGER guard_succession_documents_trigger
  BEFORE UPDATE ON public.franchise_succession_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_succession_documents();

-- ── 6. B3 · Billing date ────────────────────────────────────────────────────
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS billing_sent_at TIMESTAMPTZ;

-- Stamped by the server only: set when the admin saves the billing's payment
-- methods, otherwise kept as it was.
CREATE OR REPLACE FUNCTION public.stamp_mtop_billing_sent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.selected_payment_methods IS NOT NULL
     AND NEW.selected_payment_methods IS DISTINCT FROM OLD.selected_payment_methods THEN
    NEW.billing_sent_at := now();
  ELSE
    NEW.billing_sent_at := OLD.billing_sent_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_mtop_billing_sent_trigger ON public.franchise_applications;
CREATE TRIGGER stamp_mtop_billing_sent_trigger
  BEFORE UPDATE ON public.franchise_applications
  FOR EACH ROW EXECUTE FUNCTION public.stamp_mtop_billing_sent();

COMMIT;

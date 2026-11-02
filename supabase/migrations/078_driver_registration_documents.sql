-- =============================================================================
-- 078 · Driver registration documents and admin approval
-- -----------------------------------------------------------------------------
--  1. driver_documents: one photo per required document (driver's license,
--     plate, Official Receipt, Certificate of Registration), each reviewed by
--     an administrator (pending / approved / rejected with remarks).
--  2. users.driver_documents_status summarises the set (missing / pending /
--     approved / rejected) so the app can gate and filter without loading the
--     photos. It is maintained by triggers, never by the driver.
--  3. submit_driver_documents(): the driver's only way to upload. It saves the
--     residential address too, and replaces only documents that are missing or
--     rejected; approved documents stay locked.
--  4. An administrator can verify a driver from the app only after all four
--     documents are approved. MTOP approval (069) still verifies drivers, since
--     the MTOP review covers the license and OR/CR.
--  5. Sign-up keeps the driver's residential address (handle_new_user).
--  6. Drivers are notified when a document is rejected or their application is
--     approved/rejected.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── 1. Documents table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'drivers_license', 'plate', 'official_receipt', 'certificate_of_registration'
  )),
  file_url TEXT NOT NULL,
  file_name TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  review_remarks TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (driver_id, doc_type)
);

ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage driver documents" ON public.driver_documents;
CREATE POLICY "Admins manage driver documents" ON public.driver_documents
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Drivers view own documents" ON public.driver_documents;
CREATE POLICY "Drivers view own documents" ON public.driver_documents
  FOR SELECT TO authenticated USING (driver_id = public.current_app_user_id());

-- ── 2. Summary column ───────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS driver_documents_status TEXT
    CHECK (driver_documents_status IN ('missing', 'pending', 'approved', 'rejected'));

CREATE OR REPLACE FUNCTION public.driver_documents_summary(p_driver_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN bool_or(review_status = 'rejected') THEN 'rejected'
    WHEN count(*) < 4 THEN 'missing'
    WHEN bool_and(review_status = 'approved') THEN 'approved'
    ELSE 'pending'
  END
  FROM public.driver_documents
  WHERE driver_id = p_driver_id;
$$;

CREATE OR REPLACE FUNCTION public.refresh_driver_documents_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver UUID := COALESCE(NEW.driver_id, OLD.driver_id);
BEGIN
  UPDATE public.users
     SET driver_documents_status = public.driver_documents_summary(v_driver)
   WHERE id = v_driver;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS refresh_driver_documents_status_trigger ON public.driver_documents;
CREATE TRIGGER refresh_driver_documents_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION public.refresh_driver_documents_status();

-- Stamp who reviewed a document and when; tell the driver about a rejection.
CREATE OR REPLACE FUNCTION public.stamp_driver_document_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.review_status IS DISTINCT FROM OLD.review_status AND NEW.review_status <> 'pending' THEN
    NEW.reviewed_at := NOW();
    NEW.reviewed_by := public.current_app_user_id();
    IF NEW.review_status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, type, title, body, read)
      VALUES (
        NEW.driver_id,
        'system_alert',
        'Document rejected',
        format('Your %s photo was rejected: %s. Upload a clear photo from the Driver Application screen.',
          CASE NEW.doc_type
            WHEN 'drivers_license' THEN 'driver''s license'
            WHEN 'plate' THEN 'plate number'
            WHEN 'official_receipt' THEN 'Official Receipt (OR)'
            ELSE 'Certificate of Registration (CR)'
          END,
          COALESCE(NULLIF(btrim(NEW.review_remarks), ''), 'no reason given')),
        FALSE
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_driver_document_review_trigger ON public.driver_documents;
CREATE TRIGGER stamp_driver_document_review_trigger
  BEFORE UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION public.stamp_driver_document_review();

-- Unverified drivers start out needing documents; verified drivers are left as is.
UPDATE public.users u
   SET driver_documents_status = public.driver_documents_summary(u.id)
 WHERE u.user_type = 'driver'
   AND u.driver_documents_status IS NULL
   AND u.verification_status IS DISTINCT FROM 'verified';

-- ── 3. Driver upload ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_driver_documents(p_home_address TEXT, p_documents JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me     UUID := public.current_app_user_id();
  v_doc    JSONB;
  v_type   TEXT;
  v_url    TEXT;
  v_status TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_me AND user_type = 'driver') THEN
    RAISE EXCEPTION 'Only driver accounts can submit driver documents.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(p_home_address, ''))) < 10 THEN
    RAISE EXCEPTION 'Enter your complete residential address.';
  END IF;
  IF jsonb_typeof(p_documents) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'No documents were sent.';
  END IF;

  FOR v_doc IN SELECT * FROM jsonb_array_elements(p_documents) LOOP
    v_type := v_doc->>'doc_type';
    v_url  := v_doc->>'file_url';
    IF v_type NOT IN ('drivers_license', 'plate', 'official_receipt', 'certificate_of_registration') THEN
      RAISE EXCEPTION 'Unknown document type: %', v_type;
    END IF;
    IF v_url IS NULL OR v_url !~ '^data:image/(jpeg|png|webp);base64,' OR length(v_url) > 3600000 THEN
      RAISE EXCEPTION 'Each document must be a JPEG, PNG or WebP photo under 2.5 MB.';
    END IF;

    SELECT review_status INTO v_status
      FROM public.driver_documents WHERE driver_id = v_me AND doc_type = v_type;
    IF v_status = 'approved' THEN
      CONTINUE; -- approved documents are locked
    END IF;

    INSERT INTO public.driver_documents (driver_id, doc_type, file_url, file_name)
    VALUES (v_me, v_type, v_url, left(NULLIF(btrim(v_doc->>'file_name'), ''), 200))
    ON CONFLICT (driver_id, doc_type) DO UPDATE
       SET file_url = EXCLUDED.file_url,
           file_name = EXCLUDED.file_name,
           review_status = 'pending',
           review_remarks = NULL,
           reviewed_at = NULL,
           reviewed_by = NULL,
           uploaded_at = NOW();
  END LOOP;

  UPDATE public.users SET home_address = left(btrim(p_home_address), 500) WHERE id = v_me;

  RETURN public.driver_documents_summary(v_me);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_driver_documents(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_driver_documents(TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_driver_documents(TEXT, JSONB) TO authenticated;

-- ── 4. Verification requires approved documents ─────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_driver_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- The driver must never edit the summary; trusted functions run as owner.
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin()
     AND NEW.driver_documents_status IS DISTINCT FROM OLD.driver_documents_status THEN
    RAISE EXCEPTION 'Document status is set by the administrator review.' USING ERRCODE = '42501';
  END IF;

  IF current_user IN ('authenticated', 'anon')
     AND NEW.user_type = 'driver'
     AND NEW.verification_status = 'verified'
     AND OLD.verification_status IS DISTINCT FROM 'verified'
     AND public.driver_documents_summary(NEW.id) <> 'approved' THEN
    RAISE EXCEPTION 'Approve the driver''s license, plate, OR and CR photos before verifying this driver.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_driver_verification_trigger ON public.users;
CREATE TRIGGER guard_driver_verification_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_driver_verification();

-- ── 6. Tell the driver the application result ───────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_driver_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_type = 'driver'
     AND NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status IN ('verified', 'rejected') THEN
    INSERT INTO public.notifications (user_id, type, title, body, read)
    VALUES (
      NEW.id,
      'system_alert',
      CASE WHEN NEW.verification_status = 'verified' THEN 'Driver application approved' ELSE 'Driver application rejected' END,
      CASE WHEN NEW.verification_status = 'verified'
        THEN 'Your documents were approved. You can now go online and accept bookings.'
        ELSE 'Your driver application was not approved. Contact the FEDTODAB office for details.'
      END,
      FALSE
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_driver_verification_trigger ON public.users;
CREATE TRIGGER notify_driver_verification_trigger
  AFTER UPDATE OF verification_status ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_driver_verification();

-- ── 5. Sign-up keeps the residential address (068 version + 078 fields) ─────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta            JSONB := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  requested_type  TEXT  := lower(COALESCE(meta->>'user_type', ''));
  v_invite_name   TEXT;
  v_invite_phone  TEXT;
  v_invited       BOOLEAN;
  safe_user_type  TEXT;
BEGIN
  -- Roles are never taken from sign-up metadata (the client controls it). An
  -- administrator is only created for an email an existing admin invited.
  SELECT name, phone INTO v_invite_name, v_invite_phone
    FROM public.admin_invites
   WHERE email = lower(new.email);
  v_invited := FOUND;

  safe_user_type := CASE
    WHEN v_invited THEN 'admin'
    WHEN requested_type = 'driver' THEN 'driver'
    ELSE 'passenger'
  END;

  -- Values are clipped to the column sizes so an over-long field can never
  -- abort the sign-up with Supabase's opaque "Database error saving new user".
  INSERT INTO public.users (
    auth_id, email, name, phone, user_type, status, rating, total_trips,
    license_number, toda_membership, vehicle_details, verification_status,
    home_address, driver_documents_status
  ) VALUES (
    new.id,
    lower(new.email),
    LEFT(COALESCE(NULLIF(trim(COALESCE(v_invite_name, meta->>'name')), ''), split_part(new.email, '@', 1)), 255),
    CASE WHEN v_invited THEN LEFT(NULLIF(trim(v_invite_phone), ''), 20) ELSE NULL END,
    safe_user_type,
    'active',
    5.0,
    0,
    CASE WHEN safe_user_type = 'driver' THEN LEFT(NULLIF(trim(meta->>'license_number'), ''), 50) ELSE NULL END,
    NULL, -- TODA membership is assigned by an administrator
    CASE WHEN safe_user_type = 'driver' AND jsonb_typeof(meta->'vehicle_details') = 'object'
         THEN meta->'vehicle_details' ELSE NULL END,
    CASE WHEN safe_user_type = 'driver' THEN 'pending' ELSE NULL END,
    CASE WHEN safe_user_type = 'driver' THEN LEFT(NULLIF(trim(meta->>'home_address'), ''), 500) ELSE NULL END,
    CASE WHEN safe_user_type = 'driver' THEN 'missing' ELSE NULL END
  )
  ON CONFLICT (auth_id) DO NOTHING;

  IF v_invited THEN
    DELETE FROM public.admin_invites WHERE email = lower(new.email);
  END IF;

  RETURN new;
END;
$$;

COMMIT;

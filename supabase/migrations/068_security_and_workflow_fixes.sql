-- =============================================================================
-- 068 · Security and workflow fixes from the full-app audit
--
--  1. Users cannot edit their own status, rating, trip totals, earnings or TODA
--     (this let suspended users reactivate themselves), cannot change a verified
--     license/plate, and only active verified drivers can go online.
--  2. Bookings: the server recomputes the fare on insert (the app's number was
--     trusted), allows one active ride per passenger, and enforces the ride
--     status flow (e.g. a passenger can no longer mark a ride "completed", and a
--     driver can no longer "pick up" a ride the passenger cancelled).
--  3. The assigned driver gets a notification when the passenger cancels.
--  4. Notifications can only be sent to someone you share a ride with (plus
--     new-request alerts to drivers); admins keep full access. Previously any
--     signed-in user could send any user a fake notice.
--  5. Announcements get their own `broadcast_ref` column (they were writing text
--     into the UUID `booking_id` column, so every broadcast failed).
--  6. Admin invites: roles come from the admin-only `admin_invites` table, never
--     from sign-up metadata. Sign-up also clips values to the column limits so
--     an over-long field can no longer fail with "Database error saving new user".
--  7. admin_delete_user(): deletes the Supabase Auth login as well as the
--     profile, so a deleted person can register again with the same email.
--  8. MTOP: the fee is set server-side, a driver cannot mark their own payment as
--     verified, and resubmit_mtop_document() lets drivers replace a document the
--     admin rejected while the application is still in review.
--
-- Idempotent — safe to re-run. Apply in the Supabase SQL editor.
-- =============================================================================

BEGIN;

-- ── 1. users: fields a user may not change about themselves ─────────────────
-- SECURITY INVOKER on purpose: `current_user` is 'authenticated' only for
-- direct API writes. Trusted SECURITY DEFINER functions/triggers (trip
-- completion, rating recompute, admin RPCs) run as the owner and pass through.
CREATE OR REPLACE FUNCTION public.protect_user_self_managed_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.total_trips IS DISTINCT FROM OLD.total_trips
     OR NEW.completed_trips IS DISTINCT FROM OLD.completed_trips
     OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings
     OR NEW.toda_membership IS DISTINCT FROM OLD.toda_membership THEN
    RAISE EXCEPTION 'Account status, ratings, trip totals, earnings and TODA membership can only be changed by an administrator.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.verification_status = 'verified' AND (
       NEW.license_number IS DISTINCT FROM OLD.license_number
       OR (NEW.vehicle_details->>'plate_number') IS DISTINCT FROM (OLD.vehicle_details->>'plate_number')
     ) THEN
    RAISE EXCEPTION 'Your license and plate were verified by the administrator. Contact the FEDTODAB office to change them.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.current_status IS DISTINCT FROM OLD.current_status
     AND NEW.current_status IN ('online', 'on-trip')
     AND (OLD.user_type <> 'driver'
          OR OLD.status <> 'active'
          OR OLD.verification_status IS DISTINCT FROM 'verified') THEN
    RAISE EXCEPTION 'Only active, verified drivers can go online.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_self_managed_fields_trigger ON public.users;
CREATE TRIGGER protect_user_self_managed_fields_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_self_managed_fields();

-- ── 2a. bookings: server-side fare, one active ride, clean initial state ────
CREATE OR REPLACE FUNCTION public.enforce_booking_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cfg        RECORD;
  v_has_cfg    BOOLEAN;
  v_base       NUMERIC := 120;
  v_per_km     NUMERIC := 10;
  v_mult       NUMERIC := 1;
  v_lat1       DOUBLE PRECISION;
  v_lng1       DOUBLE PRECISION;
  v_lat2       DOUBLE PRECISION;
  v_lng2       DOUBLE PRECISION;
  v_straight   NUMERIC;
  v_km         INTEGER;
  v_route      NUMERIC;
  v_hour       NUMERIC;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.passenger_id = NEW.passenger_id
      AND b.status IN ('pending', 'accepted', 'in-transit')
  ) THEN
    RAISE EXCEPTION 'You already have an active ride. Finish or cancel it before booking another.';
  END IF;

  BEGIN
    v_lat1 := (NEW.pickup_location->>'latitude')::DOUBLE PRECISION;
    v_lng1 := (NEW.pickup_location->>'longitude')::DOUBLE PRECISION;
    v_lat2 := (NEW.dropoff_location->>'latitude')::DOUBLE PRECISION;
    v_lng2 := (NEW.dropoff_location->>'longitude')::DOUBLE PRECISION;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Pickup and drop-off need valid map locations.';
  END;
  IF v_lat1 IS NULL OR v_lng1 IS NULL OR v_lat2 IS NULL OR v_lng2 IS NULL
     OR abs(v_lat1) > 90 OR abs(v_lat2) > 90 OR abs(v_lng1) > 180 OR abs(v_lng2) > 180 THEN
    RAISE EXCEPTION 'Pickup and drop-off need valid map locations.';
  END IF;

  -- Straight-line distance is the floor; the app's road distance is accepted
  -- when it is plausible (roads are longer, but not 3x + 2 km longer).
  v_straight := 6371 * 2 * asin(sqrt(
    power(sin(radians(v_lat2 - v_lat1) / 2), 2)
    + cos(radians(v_lat1)) * cos(radians(v_lat2)) * power(sin(radians(v_lng2 - v_lng1) / 2), 2)
  ));
  IF NEW.distance IS NULL OR NEW.distance < v_straight * 0.95 OR NEW.distance > v_straight * 3 + 2 THEN
    NEW.distance := ROUND(v_straight, 2);
  END IF;

  SELECT base_fare, per_km_rate, peak_hour_multiplier, peak_hours_enabled
    INTO v_cfg
    FROM public.fare_matrix
   ORDER BY id
   LIMIT 1;
  v_has_cfg := FOUND;
  IF v_has_cfg THEN
    v_base := COALESCE(v_cfg.base_fare, 120);
    v_per_km := COALESCE(v_cfg.per_km_rate, 10);
    v_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Manila'))
            + EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Asia/Manila')) / 60.0;
    IF COALESCE(v_cfg.peak_hours_enabled, FALSE) AND v_hour >= 6.5 AND v_hour < 9 THEN
      v_mult := COALESCE(v_cfg.peak_hour_multiplier, 1);
    END IF;
  END IF;

  -- Same formula as FareCalculationService.calculateFareForPassengers.
  v_km := GREATEST(1, CEIL(COALESCE(NEW.distance, 0)))::INTEGER;
  v_route := ROUND((v_base + (v_km - 1) * v_per_km) * v_mult, 2);
  IF NEW.ride_type = 'priority' THEN
    v_route := v_route + GREATEST(12, v_route * 0.15);
  END IF;

  NEW.passenger_count := LEAST(5, GREATEST(1, COALESCE(NEW.passenger_count, 1)));
  NEW.base_fare := v_base;
  NEW.per_km_rate := v_per_km;
  NEW.peak_hour_multiplier := v_mult;
  NEW.total_fare := ROUND(v_route * NEW.passenger_count, 2);
  NEW.estimated_duration := CEIL(NEW.distance / 30 * 60);

  NEW.status := 'pending';
  NEW.driver_id := NULL;
  NEW.payment_status := 'pending';
  NEW.accepted_at := NULL;
  NEW.started_at := NULL;
  NEW.completed_at := NULL;
  NEW.passenger_rating := NULL;
  NEW.driver_rating := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_insert_trigger ON public.bookings;
CREATE TRIGGER enforce_booking_insert_trigger
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_insert();

-- ── 2b. bookings: allowed status changes per role ───────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_booking_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_me UUID;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  v_me := public.current_app_user_id();

  IF OLD.status = 'pending' AND NEW.status = 'accepted' AND NEW.driver_id = v_me THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('pending', 'accepted') AND NEW.status = 'cancelled' AND OLD.passenger_id = v_me THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'accepted' AND NEW.status = 'in-transit' AND OLD.driver_id = v_me THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'in-transit' AND NEW.status = 'completed' AND OLD.driver_id = v_me THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    MESSAGE = CASE
      WHEN OLD.status = 'cancelled' THEN 'This ride was cancelled by the passenger.'
      WHEN OLD.status = 'completed' THEN 'This ride is already completed.'
      ELSE format('This ride cannot change from %s to %s.', OLD.status, NEW.status)
    END,
    ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_status_transition_trigger ON public.bookings;
CREATE TRIGGER enforce_booking_status_transition_trigger
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_status_transition();

-- ── 3. Tell the assigned driver when the passenger cancels ──────────────────
CREATE OR REPLACE FUNCTION public.notify_driver_on_ride_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.driver_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, booking_id, read)
    VALUES (
      NEW.driver_id,
      'booking_update',
      'Ride cancelled',
      format('The passenger cancelled the ride from %s. You are available for new requests.',
             COALESCE(NULLIF(NEW.pickup_location->>'address', ''), 'the pickup point')),
      NEW.id,
      FALSE
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_driver_on_ride_cancel() FROM PUBLIC;

DROP TRIGGER IF EXISTS notify_driver_on_ride_cancel ON public.bookings;
CREATE TRIGGER notify_driver_on_ride_cancel
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_driver_on_ride_cancel();

-- ── 4. Who may create a notification for whom ───────────────────────────────
CREATE OR REPLACE FUNCTION public.can_send_notification(p_target UUID, p_booking UUID, p_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_admin()
      OR p_target = public.current_app_user_id()
      OR public.shares_booking_with(p_target)
      OR (
        p_type = 'booking_request'
        AND EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = p_booking
            AND b.passenger_id = public.current_app_user_id()
            AND b.status = 'pending'
        )
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = p_target AND u.user_type = 'driver'
        )
      );
$$;
REVOKE ALL ON FUNCTION public.can_send_notification(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_send_notification(UUID, UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Participants insert notifications" ON public.notifications;
CREATE POLICY "Participants insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.can_send_notification(user_id, booking_id, type));

-- ── 5. Announcement metadata column ─────────────────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS broadcast_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast_ref
  ON public.notifications (created_at DESC)
  WHERE broadcast_ref IS NOT NULL;

-- ── 6. Admin invites + hardened sign-up trigger ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_invites (
  email       TEXT PRIMARY KEY CHECK (email = lower(email)),
  name        TEXT,
  phone       TEXT,
  invited_by  UUID DEFAULT public.current_app_user_id() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage admin invites" ON public.admin_invites;
CREATE POLICY "Admins manage admin invites" ON public.admin_invites
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

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
    license_number, toda_membership, vehicle_details, verification_status
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
    CASE WHEN safe_user_type = 'driver' THEN 'pending' ELSE NULL END
  )
  ON CONFLICT (auth_id) DO NOTHING;

  IF v_invited THEN
    DELETE FROM public.admin_invites WHERE email = lower(new.email);
  END IF;

  RETURN new;
END;
$$;

-- ── 7. Admin account deletion (Auth login + profile) ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can delete accounts.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = public.current_app_user_id() THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;

  SELECT auth_id INTO v_auth_id FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That account no longer exists.';
  END IF;

  -- public.users.auth_id cascades from auth.users; the explicit delete covers
  -- deployments where that foreign key was changed.
  DELETE FROM auth.users WHERE id = v_auth_id;
  DELETE FROM public.users WHERE id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- ── 8a. MTOP workflow trigger (059 version + 068 rules) ─────────────────────
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
    -- 068: the fee is set by the LGU schedule, never by the applicant's app.
    IF NOT v_admin THEN
      NEW.fees := CASE WHEN NEW.type = 'renewal' THEN 1000 ELSE 1500 END;
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

-- ── 8b. Driver re-uploads a rejected MTOP document ──────────────────────────
CREATE OR REPLACE FUNCTION public.resubmit_mtop_document(
  p_application_id UUID,
  p_document_name  TEXT,
  p_file_url       TEXT,
  p_file_name      TEXT DEFAULT NULL
)
RETURNS SETOF public.franchise_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app    public.franchise_applications%ROWTYPE;
  v_doc    JSONB;
  v_docs   JSONB := '[]'::jsonb;
  v_found  BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_app FROM public.franchise_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.driver_id IS DISTINCT FROM public.current_app_user_id() THEN
    RAISE EXCEPTION 'MTOP application not found.';
  END IF;
  IF v_app.documents_verified_at IS NOT NULL OR v_app.status NOT IN ('submitted', 'document_verification') THEN
    RAISE EXCEPTION 'Documents can only be replaced while the application is still in review.';
  END IF;
  IF p_file_url IS NULL
     OR p_file_url !~* '^data:(image/(jpeg|jpg|png|webp)|application/pdf);base64,'
     OR length(p_file_url) > 3500000 THEN
    RAISE EXCEPTION 'Upload a clear photo or PDF under 2.5 MB.';
  END IF;

  FOR v_doc IN SELECT value FROM jsonb_array_elements(COALESCE(v_app.documents, '[]'::jsonb)) LOOP
    IF v_doc->>'name' = p_document_name THEN
      IF COALESCE(v_doc->>'review_status', 'pending') <> 'rejected' THEN
        RAISE EXCEPTION 'Only a document the administrator rejected can be re-uploaded.';
      END IF;
      v_found := TRUE;
      v_doc := v_doc || jsonb_build_object(
        'uploaded', TRUE,
        'file_url', p_file_url,
        'file_name', LEFT(p_file_name, 255),
        'uploaded_at', to_jsonb(NOW()),
        'review_status', 'pending',
        'review_remarks', NULL
      );
    END IF;
    v_docs := v_docs || jsonb_build_array(v_doc);
  END LOOP;

  IF NOT v_found THEN
    RAISE EXCEPTION 'That document is not part of this application.';
  END IF;

  PERFORM set_config('app.mtop_doc_resubmit_rpc', 'on', TRUE);
  RETURN QUERY
    UPDATE public.franchise_applications
       SET documents = v_docs, updated_at = NOW()
     WHERE id = p_application_id
    RETURNING *;
  PERFORM set_config('app.mtop_doc_resubmit_rpc', 'off', TRUE);
END;
$$;
REVOKE ALL ON FUNCTION public.resubmit_mtop_document(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resubmit_mtop_document(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.resubmit_mtop_document(UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;

-- =============================================================================
-- OPTIONAL one-time cleanup — NOT run automatically.
--
-- Before 068, "Delete user" in the admin panel removed only the profile row and
-- left the Supabase login behind. Those people can neither sign in ("profile
-- not found") nor sign up again ("already registered"). Preview them first:
--
--   SELECT u.id, u.email, u.created_at
--     FROM auth.users u
--    WHERE NOT EXISTS (SELECT 1 FROM public.users p WHERE p.auth_id = u.id);
--
-- If every row listed is an account an admin deleted on purpose, remove them:
--
--   DELETE FROM auth.users u
--    WHERE NOT EXISTS (SELECT 1 FROM public.users p WHERE p.auth_id = u.id);
-- =============================================================================

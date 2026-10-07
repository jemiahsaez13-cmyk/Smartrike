-- =============================================================================
-- 075 · Succession request: "Does your successor have an app account?"
-- -----------------------------------------------------------------------------
-- The holder now answers whether the successor already has a Smart Trike
-- account:
--   • Yes → they type the successor's name and the email used in the app.
--           The email must belong to an eligible driver account.
--   • No  → they type the successor's name (and optionally a contact number).
--           The successor signs up as a driver before the transfer.
-- The administrator selects the successor's account from the eligible-driver
-- list when approving, so review_franchise_succession() now takes the chosen
-- account.
--
-- Requires migration 074. Idempotent: safe to run more than once.
-- =============================================================================

ALTER TABLE public.franchise_succession_requests
  ALTER COLUMN successor_id DROP NOT NULL,
  ALTER COLUMN successor_email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS successor_has_account BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS successor_phone TEXT;

ALTER TABLE public.franchise_succession_requests
  DROP CONSTRAINT IF EXISTS franchise_succession_successor_name_check;
ALTER TABLE public.franchise_succession_requests
  ADD CONSTRAINT franchise_succession_successor_name_check
  CHECK (char_length(btrim(successor_name)) BETWEEN 2 AND 255);

-- ── Request (holder) ────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.request_franchise_succession(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.request_franchise_succession(
  p_franchise_id    UUID,
  p_has_account     BOOLEAN,
  p_successor_name  TEXT,
  p_successor_email TEXT,
  p_successor_phone TEXT,
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
  v_name      TEXT := btrim(COALESCE(p_successor_name, ''));
  v_email     TEXT := lower(btrim(COALESCE(p_successor_email, '')));
  v_phone     TEXT := NULLIF(btrim(COALESCE(p_successor_phone, '')), '');
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
    relationship, reason
  ) VALUES (
    p_franchise_id, v_me, COALESCE(v_me_name, 'Driver'),
    p_has_account,
    CASE WHEN p_has_account THEN v_successor.id END,
    v_name,
    NULLIF(v_email, ''),
    v_phone,
    p_relationship,
    btrim(p_reason)
  )
  RETURNING * INTO v_request;

  INSERT INTO public.notifications (user_id, type, title, body, read)
  SELECT u.id, 'franchise_status', 'Succession request',
         COALESCE(v_me_name, 'A driver') || ' requested to pass ' || COALESCE(v_franchise.mtop_number, 'their MTOP')
           || ' to ' || v_name
           || CASE WHEN p_has_account THEN '' ELSE ' (no app account yet)' END
           || '. Review it in the Franchise Registry.',
         FALSE
    FROM public.users u
   WHERE u.user_type = 'admin' AND u.status = 'active';

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_franchise_succession(UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── Review (admin) ──────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.review_franchise_succession(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.review_franchise_succession(
  p_request_id   UUID,
  p_decision     TEXT,
  p_reason       TEXT DEFAULT NULL,
  p_successor_id UUID DEFAULT NULL
)
RETURNS public.franchise_succession_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request   public.franchise_succession_requests%ROWTYPE;
  v_franchise public.franchise_applications%ROWTYPE;
  v_chosen    UUID;
  v_successor public.users%ROWTYPE;
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
    -- The admin's selected account; falls back to the one the holder named.
    v_chosen := COALESCE(p_successor_id, v_request.successor_id);
    IF v_chosen IS NULL THEN
      RAISE EXCEPTION 'Select the successor''s driver account.';
    END IF;
    IF v_franchise.driver_id IS DISTINCT FROM v_chosen THEN
      RAISE EXCEPTION 'Record the succession transfer to the selected account first.';
    END IF;
    SELECT * INTO v_successor FROM public.users WHERE id = v_chosen;
  ELSIF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Enter the reason for rejecting the request.';
  END IF;

  UPDATE public.franchise_succession_requests
     SET status = p_decision,
         successor_id = CASE WHEN p_decision = 'approved' THEN v_chosen ELSE successor_id END,
         rejection_reason = CASE WHEN p_decision = 'rejected' THEN btrim(p_reason) ELSE NULL END,
         reviewed_by = public.current_app_user_id(),
         reviewed_at = now()
   WHERE id = p_request_id
  RETURNING * INTO v_request;

  IF p_decision = 'approved' THEN
    INSERT INTO public.notifications (user_id, type, title, body, read) VALUES
      (v_request.requested_by, 'franchise_status', 'Succession approved',
       COALESCE(v_franchise.mtop_number, 'Your MTOP') || ' has been passed to ' || COALESCE(v_successor.name, v_request.successor_name) || '.', FALSE),
      (v_chosen, 'franchise_status', 'You are now the MTOP holder',
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

REVOKE ALL ON FUNCTION public.review_franchise_succession(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_franchise_succession(UUID, TEXT, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_franchise_succession(UUID, TEXT, TEXT, UUID) TO authenticated;

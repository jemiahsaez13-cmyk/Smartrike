-- Drivers cannot directly update issued MTOP rows because the payment workflow
-- trigger locks non-payment updates. This owner-scoped RPC is the safe entry
-- point for Change of Unit submissions.
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID := public.current_app_user_id();
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

  -- Read by enforce_mtop_workflow only for this transaction/RPC call.
  PERFORM set_config('app.change_of_unit_rpc', 'on', TRUE);

  RETURN QUERY
  UPDATE public.franchise_applications
     SET cou_status = 'pending',
         cou_unit_type = p_unit_type,
         cou_vehicle_make = CASE WHEN p_unit_type = 'sidecar' THEN NULL ELSE btrim(p_vehicle_make) END,
         cou_vehicle_model = CASE WHEN p_unit_type = 'sidecar' THEN NULL ELSE btrim(p_vehicle_model) END,
         cou_new_plate = upper(btrim(p_new_plate)),
         cou_new_body = upper(btrim(p_new_body)),
         cou_or_number = CASE WHEN p_unit_type = 'sidecar' THEN NULL ELSE btrim(p_or_number) END,
         cou_cr_number = CASE WHEN p_unit_type = 'sidecar' THEN NULL ELSE btrim(p_cr_number) END,
         cou_or_image = p_or_image,
         cou_cr_image = p_cr_image,
         cou_unit_image = p_unit_image,
         cou_requested_at = NOW(),
         cou_reviewed_at = NULL,
         cou_reviewed_by = NULL,
         cou_rejection_reason = NULL,
         updated_at = NOW()
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

REVOKE ALL ON FUNCTION public.submit_change_of_unit_request(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_change_of_unit_request(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Amend the existing workflow trigger function without duplicating its full
-- definition. Only the validated SECURITY DEFINER RPC above sets this local
-- transaction flag; ordinary driver updates remain locked by RLS and trigger.
DO $$
DECLARE
  v_definition TEXT;
  v_marker TEXT := '  IF NOT v_admin THEN';
  v_guard TEXT := E'  IF current_setting(''app.change_of_unit_rpc'', TRUE) = ''on''\n'
    || E'     AND OLD.driver_id = v_owner\n'
    || E'     AND OLD.status = ''issued''\n'
    || E'     AND NEW.status = OLD.status\n'
    || E'     AND NEW.cou_status = ''pending'' THEN\n'
    || E'    RETURN NEW;\n'
    || E'  END IF;\n\n'
    || v_marker;
BEGIN
  SELECT pg_get_functiondef('public.enforce_mtop_workflow()'::regprocedure)
    INTO v_definition;
  IF position('app.change_of_unit_rpc' IN v_definition) = 0 THEN
    IF position(v_marker IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Could not patch enforce_mtop_workflow for Change of Unit requests.';
    END IF;
    EXECUTE replace(v_definition, v_marker, v_guard);
  END IF;
END;
$$;

-- =============================================================================
-- 083 · Live admin notifications for everything waiting on an administrator
-- -----------------------------------------------------------------------------
-- Every active admin gets a notification (bell + live badge in the app) when:
--   • a driver or passenger account is created            admin_new_driver / admin_new_passenger
--   • a driver submits or re-uploads registration photos   admin_driver_documents
--   • a new MTOP application or renewal is filed           admin_mtop_application / admin_mtop_renewal
--   • a driver re-uploads a corrected MTOP document        admin_mtop_documents
--   • a driver sends MTOP payment proof or books an
--     in-person payment appointment                        admin_mtop_payment
--   • a driver requests a Change of Unit                   admin_change_of_unit
--   • a holder requests a franchise succession             admin_succession
--   • a passenger or driver files a report                 admin_report
-- Flag alerts from 079 (system_alert) are unchanged.
--
-- Triggers only add notifications; they never block or change the original
-- write (each insert is wrapped so a notification failure cannot undo it).
-- Apply after 082. Idempotent: safe to run more than once.
-- =============================================================================

BEGIN;

-- ── Helper ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_event(p_type TEXT, p_title TEXT, p_body TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, read)
  SELECT u.id, p_type, left(p_title, 255), p_body, FALSE
    FROM public.users u
   WHERE u.user_type = 'admin' AND u.status = 'active';
EXCEPTION WHEN others THEN
  -- An alert must never undo the action that triggered it.
  RAISE WARNING 'notify_admins_event(%) failed: %', p_type, SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_admins_event(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admins_event(TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.notify_admins_event(TEXT, TEXT, TEXT) FROM authenticated;

CREATE OR REPLACE FUNCTION public.user_display_name(p_user UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(btrim(name), ''), email, 'A user') FROM public.users WHERE id = p_user;
$$;
REVOKE ALL ON FUNCTION public.user_display_name(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_display_name(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.user_display_name(UUID) FROM authenticated;

-- ── 1. New accounts ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.alert_admins_new_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_type = 'driver' THEN
    PERFORM public.notify_admins_event(
      'admin_new_driver',
      'New driver registered',
      format('%s signed up as a driver. Review their documents before verifying the account.', COALESCE(NEW.name, NEW.email))
    );
  ELSIF NEW.user_type = 'passenger' THEN
    PERFORM public.notify_admins_event(
      'admin_new_passenger',
      'New passenger registered',
      format('%s created a passenger account.', COALESCE(NEW.name, NEW.email))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_admins_new_account_trigger ON public.users;
CREATE TRIGGER alert_admins_new_account_trigger
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.alert_admins_new_account();

-- ── 2. Driver registration documents (078) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.alert_admins_driver_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_type = 'driver'
     AND NEW.driver_documents_status = 'pending'
     AND OLD.driver_documents_status IS DISTINCT FROM 'pending' THEN
    PERFORM public.notify_admins_event(
      'admin_driver_documents',
      CASE WHEN OLD.driver_documents_status = 'rejected'
           THEN 'Driver re-uploaded documents' ELSE 'Driver documents to review' END,
      format('%s %s their license, plate, OR and CR photos. Open User Management → Review Documents.',
             COALESCE(NEW.name, NEW.email),
             CASE WHEN OLD.driver_documents_status = 'rejected' THEN 're-uploaded' ELSE 'submitted' END)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_admins_driver_documents_trigger ON public.users;
CREATE TRIGGER alert_admins_driver_documents_trigger
  AFTER UPDATE OF driver_documents_status ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.alert_admins_driver_documents();

-- ── 3. MTOP applications, renewals, documents, payment, Change of Unit ──────
CREATE OR REPLACE FUNCTION public.alert_admins_mtop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_who TEXT;
BEGIN
  v_who := COALESCE(NULLIF(btrim(NEW.driver_name), ''), public.user_display_name(NEW.driver_id), 'A driver');

  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'renewal' THEN
      PERFORM public.notify_admins_event(
        'admin_mtop_renewal',
        'MTOP renewal filed',
        format('%s filed an MTOP renewal%s%s.', v_who,
               CASE WHEN NEW.toda IS NOT NULL THEN ' for ' || NEW.toda ELSE '' END,
               CASE WHEN NEW.body_number IS NOT NULL THEN ' (body no. ' || NEW.body_number || ')' ELSE '' END)
      );
    ELSE
      PERFORM public.notify_admins_event(
        'admin_mtop_application',
        'New MTOP application',
        format('%s submitted a new MTOP application%s. Review the documents in MTOP Management.', v_who,
               CASE WHEN NEW.toda IS NOT NULL THEN ' for ' || NEW.toda ELSE '' END)
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Updates: only changes made by the driver (an admin's own edits and the
  -- daily renewal cycle never alert).
  IF public.is_admin() OR public.current_app_user_id() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_review_status = 'pending_review'
     AND OLD.payment_review_status IS DISTINCT FROM 'pending_review' THEN
    PERFORM public.notify_admins_event(
      'admin_mtop_payment',
      'MTOP payment to verify',
      format('%s sent MTOP payment proof%s. Verify it in MTOP Management.', v_who,
             CASE WHEN NULLIF(btrim(NEW.payment_reference), '') IS NOT NULL
                  THEN ' (ref. ' || NEW.payment_reference || ')' ELSE '' END)
    );
  ELSIF NEW.appointment_date IS NOT NULL
     AND NEW.appointment_date IS DISTINCT FROM OLD.appointment_date THEN
    PERFORM public.notify_admins_event(
      'admin_mtop_payment',
      'MTOP payment appointment',
      format('%s booked an in-person MTOP payment on %s.', v_who,
             to_char(NEW.appointment_date AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM'))
    );
  END IF;

  IF NEW.cou_status = 'pending' AND OLD.cou_status IS DISTINCT FROM 'pending' THEN
    PERFORM public.notify_admins_event(
      'admin_change_of_unit',
      'Change of Unit request',
      format('%s asked to change the unit on MTOP %s.', v_who, COALESCE(NEW.mtop_number, '(no number yet)'))
    );
  END IF;

  IF NEW.documents IS DISTINCT FROM OLD.documents
     AND NEW.status IN ('submitted', 'document_verification') THEN
    PERFORM public.notify_admins_event(
      'admin_mtop_documents',
      'Corrected MTOP document',
      format('%s re-uploaded an MTOP document. Review it in MTOP Management.', v_who)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_admins_mtop_trigger ON public.franchise_applications;
CREATE TRIGGER alert_admins_mtop_trigger
  AFTER INSERT OR UPDATE ON public.franchise_applications
  FOR EACH ROW EXECUTE FUNCTION public.alert_admins_mtop();

-- ── 4. Succession requests (074) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.alert_admins_succession()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins_event(
    'admin_succession',
    'Franchise succession request',
    format('%s asked to pass their franchise to %s (%s). Review it in the Franchise Registry.',
           NEW.requested_by_name, NEW.successor_name, replace(NEW.relationship, '_', ' '))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_admins_succession_trigger ON public.franchise_succession_requests;
CREATE TRIGGER alert_admins_succession_trigger
  AFTER INSERT ON public.franchise_succession_requests
  FOR EACH ROW EXECUTE FUNCTION public.alert_admins_succession();

-- ── 5. Reports (027) ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.alert_admins_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins_event(
    'admin_report',
    CASE WHEN NEW.reporter_role = 'passenger' THEN 'Passenger reported a driver' ELSE 'Driver reported a passenger' END,
    format('%s reported %s: %s', COALESCE(public.user_display_name(NEW.reporter_id), 'A user'),
           COALESCE(public.user_display_name(NEW.reported_id), 'a user'), NEW.reason)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_admins_report_trigger ON public.reports;
CREATE TRIGGER alert_admins_report_trigger
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.alert_admins_report();

COMMIT;

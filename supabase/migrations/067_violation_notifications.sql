ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS violation_id UUID
  REFERENCES public.driver_violations(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_violation_id_key ON public.notifications(violation_id);

CREATE OR REPLACE FUNCTION public.violation_notification_body(v public.driver_violations)
RETURNS TEXT LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT concat_ws(E'\n',
    'Violation: ' || v.violation_type,
    'Account: ' || CASE WHEN v.passenger_id IS NOT NULL THEN 'Passenger' ELSE 'Driver' END,
    'Incident date: ' || to_char(v.incident_date, 'Mon DD, YYYY'),
    'Status: ' || initcap(v.status),
    'Details: ' || COALESCE(NULLIF(v.description, ''), 'No additional details.'),
    'Penalty / sanction: ' || COALESCE(NULLIF(v.penalty, ''), 'None specified.')
  );
$$;

-- Generated in the same transaction as manual records/report conversions.
-- Only the person recorded in the violation receives it, never the reporter.
CREATE OR REPLACE FUNCTION public.notify_violation_subject()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.driver_id, NEW.passenger_id, NEW.violation_type, NEW.description, NEW.incident_date, NEW.penalty, NEW.status)
      IS NOT DISTINCT FROM
      ROW(OLD.driver_id, OLD.passenger_id, OLD.violation_type, OLD.description, OLD.incident_date, OLD.penalty, OLD.status)
    THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.notifications(user_id, type, title, body, violation_id, read)
  VALUES (COALESCE(NEW.driver_id, NEW.passenger_id), 'violation',
    CASE WHEN NEW.status = 'open' THEN 'Violation recorded' ELSE 'Violation ' || NEW.status END,
    public.violation_notification_body(NEW), NEW.id, false)
  ON CONFLICT (violation_id) DO UPDATE SET
    user_id = EXCLUDED.user_id, title = EXCLUDED.title, body = EXCLUDED.body,
    read = false, created_at = NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_violation_subject ON public.driver_violations;
CREATE TRIGGER notify_violation_subject AFTER INSERT OR UPDATE ON public.driver_violations
  FOR EACH ROW EXECUTE FUNCTION public.notify_violation_subject();

-- Existing violations also appear in the owner's bell. Reapplying does not
-- duplicate notifications or reset already-read notifications.
INSERT INTO public.notifications(user_id, type, title, body, violation_id, read, created_at)
SELECT COALESCE(v.driver_id, v.passenger_id), 'violation',
  CASE WHEN v.status = 'open' THEN 'Violation recorded' ELSE 'Violation ' || v.status END,
  public.violation_notification_body(v), v.id, false, v.created_at
FROM public.driver_violations v
ON CONFLICT (violation_id) DO NOTHING;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = public.current_app_user_id());
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

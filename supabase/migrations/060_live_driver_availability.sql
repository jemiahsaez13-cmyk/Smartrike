-- Publish only availability, without exposing private user profiles to passengers.
BEGIN;
CREATE TABLE IF NOT EXISTS public.driver_availability (
  driver_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_availability FROM anon, authenticated;
GRANT SELECT ON public.driver_availability TO authenticated;
DROP POLICY IF EXISTS "Authenticated users read availability" ON public.driver_availability;
CREATE POLICY "Authenticated users read availability" ON public.driver_availability
  FOR SELECT TO authenticated USING (true);
CREATE OR REPLACE FUNCTION public.sync_driver_availability()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_type = 'driver' THEN
    INSERT INTO public.driver_availability(driver_id, is_available)
    VALUES (NEW.id, COALESCE(NEW.current_status = 'online' AND NEW.status = 'active'
      AND NEW.verification_status = 'verified', FALSE))
    ON CONFLICT (driver_id) DO UPDATE SET is_available = EXCLUDED.is_available;
  ELSE
    DELETE FROM public.driver_availability WHERE driver_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_driver_availability() FROM PUBLIC;
DROP TRIGGER IF EXISTS sync_driver_availability ON public.users;
CREATE TRIGGER sync_driver_availability AFTER INSERT OR UPDATE OF current_status, status, verification_status, user_type
  ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_driver_availability();
INSERT INTO public.driver_availability(driver_id, is_available)
SELECT id, COALESCE(current_status = 'online' AND status = 'active' AND verification_status = 'verified', FALSE)
FROM public.users WHERE user_type = 'driver'
ON CONFLICT (driver_id) DO UPDATE SET is_available = EXCLUDED.is_available;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'driver_availability') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_availability;
  END IF;
END;
$$;
COMMIT;

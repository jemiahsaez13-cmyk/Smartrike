-- =============================================================================
-- 033_purge_trip_chats.sql
--
-- Privacy: trip chat is transient. One hour AFTER a trip completes (timer
-- starts at completed_at, never while the trip is active), its messages are
-- deleted server-side. A pg_cron job sweeps every 10 minutes; the app also
-- hides expired threads client-side so the UX doesn't depend on sweep timing.
--
-- Idempotent.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_completed_trip_chats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.messages m
  USING public.bookings b
  WHERE m.booking_id = b.id
    AND b.status = 'completed'
    AND b.completed_at IS NOT NULL
    AND b.completed_at < NOW() - INTERVAL '1 hour';
$$;

-- (Re)schedule the sweep — unschedule first so reruns don't stack jobs.
DO $$
BEGIN
  PERFORM cron.unschedule('purge-trip-chats');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet
END $$;

SELECT cron.schedule(
  'purge-trip-chats',
  '*/10 * * * *',
  $$SELECT public.purge_completed_trip_chats()$$
);

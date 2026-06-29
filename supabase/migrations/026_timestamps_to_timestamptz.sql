-- =============================================================================
-- 026_timestamps_to_timestamptz.sql
--
-- BUG: every time column was `timestamp without time zone`. PostgREST returns
-- those WITHOUT a timezone offset (e.g. "2026-06-29T09:42:47"), and JS
-- `new Date("...")` then parses them as the device's LOCAL time. On a PHT
-- (+08:00) phone, a booking created "now" (UTC) parses as 8 hours in the past,
-- so the driver dashboard's freshness filter (hide requests older than 20 min)
-- silently dropped brand-new requests — "the request suddenly disappears". It
-- also skewed every displayed time/ordering across the app.
--
-- Fix: convert the columns to `timestamptz`, interpreting the stored naive
-- values as UTC (Supabase wrote them with NOW() in UTC). PostgREST then returns
-- proper ISO-8601 with an offset and JS parses them correctly everywhere.
--
-- Idempotent: only converts columns still stored without a time zone.
-- =============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'timestamp without time zone'
      AND (table_name, column_name) IN (
        ('bookings','created_at'), ('bookings','accepted_at'), ('bookings','started_at'),
        ('bookings','completed_at'), ('bookings','scheduled_time'),
        ('driver_locations','timestamp'), ('messages','timestamp'),
        ('notifications','created_at'), ('users','created_at'), ('users','last_location_update')
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
      r.table_name, r.column_name, r.column_name
    );
  END LOOP;
END $$;

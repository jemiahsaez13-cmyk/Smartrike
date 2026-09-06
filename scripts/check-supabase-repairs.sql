-- Read-only deployment audit. Run in Supabase SQL Editor after applying repairs.
-- Does not read passenger names, account numbers, screenshots, or payment records.
SELECT n.nspname AS schema, p.proname AS function_name,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'get_ride_driver_payment_methods', 'submit_ride_payment', 'review_ride_payment',
  'switch_ride_payment_to_cash', 'sync_driver_availability',
  'release_driver_after_ride_cancellation', 'current_app_user_id', 'is_admin'
) ORDER BY p.proname;

SELECT t.relname AS table_name, tr.tgname AS trigger_name,
       tr.tgenabled AS enabled, pg_get_triggerdef(tr.oid) AS definition
FROM pg_trigger tr JOIN pg_class t ON t.oid = tr.tgrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname IN ('users','bookings','ride_payment_submissions')
  AND NOT tr.tgisinternal ORDER BY t.relname, tr.tgname;

SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_trigger WHERE tgrelid='public.bookings'::regclass
  AND tgname='trigger_update_driver_stats' AND tgenabled <> 'D'
) THEN 'CHECK: legacy stats trigger is still enabled; review migration 028 to prevent double earnings'
ELSE 'OK: legacy double-counting trigger absent/disabled' END AS stats_check;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('driver_availability','driver_payment_methods','ride_payment_submissions');
SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN
 ('driver_availability','driver_payment_methods','ride_payment_submissions');
SELECT pubname, schemaname, tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND tablename IN ('driver_availability','bookings');
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public'
AND indexname IN ('transactions_booking_unique','ride_payment_reference_per_driver');

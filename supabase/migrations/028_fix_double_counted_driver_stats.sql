-- =============================================================================
-- 028_fix_double_counted_driver_stats.sql
--
-- BUG (data integrity): two triggers fire on a booking completing and BOTH
-- increment the same stats —
--   * handle_booking_completion()  (BEFORE UPDATE, on_booking_completion)
--   * update_driver_stats()        (AFTER UPDATE,  trigger_update_driver_stats)
-- both do driver completed_trips+1, total_trips+1, total_earnings+fare and
-- passenger total_trips+1. Result: every completed trip counts TWICE — inflated
-- trip counts and DOUBLED driver earnings.
--
-- Fix: keep handle_booking_completion (it's the superset — also sets
-- current_status, payment_status, and records the transaction) and drop the
-- redundant update_driver_stats trigger + function.
--
-- Idempotent.
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_update_driver_stats ON public.bookings;
DROP FUNCTION IF EXISTS public.update_driver_stats();

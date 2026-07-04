-- =============================================================================
-- 031_transactions_online_payment.sql
--
-- Completes what migration 030 started: 030 allowed the demo 'online' payment
-- method on bookings, but the trip-completion trigger (016/024) copies the
-- booking's payment_method into `transactions`, whose own check constraint
-- still only allowed cash/gcash/paymaya. Completing an online-paid trip then
-- failed with:
--   new row for relation "transactions" violates check constraint
--   "transactions_payment_method_check"
--
-- Idempotent.
-- =============================================================================

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_payment_method_check
  CHECK (payment_method IN ('cash', 'gcash', 'paymaya', 'online'));

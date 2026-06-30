-- =============================================================================
-- 030_online_payment_method.sql
--
-- Adds 'online' as an allowed payment method. The app is moving away from the
-- in-app e-money wallet toward direct online payment. For now the online flow is
-- a DEMO (faked success) — real GCash/card requires a licensed gateway
-- (PayMongo/Xendit/Maya) plus business registration and BIR permits.
--
-- Idempotent.
-- =============================================================================

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_method_check
  CHECK (payment_method IN ('cash', 'gcash', 'paymaya', 'online'));

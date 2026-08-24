-- Migration 044: Add chosen_payment_method_snapshot to franchise_applications
--
-- Stores the single AdminMtopPaymentMethod object the driver selected when
-- they submitted their MTOP payment proof.  This lets both the driver's
-- FranchiseScreen and the admin's payment review card display exactly which
-- method was used — not all configured methods.

ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS chosen_payment_method_snapshot JSONB;

COMMENT ON COLUMN public.franchise_applications.chosen_payment_method_snapshot IS
  'The single AdminMtopPaymentMethod the driver chose when submitting payment '
  '(snapshot of id, method_type, display_name, account_name, account_number, address).';

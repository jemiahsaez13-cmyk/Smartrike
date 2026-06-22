-- =============================================================================
-- 015 · Official Boac (Marinduque) LGU tricycle fare matrix
-- -----------------------------------------------------------------------------
-- Replaces the old placeholder fare (₱50 base + ₱15/km + 1.5× peak) with the
-- published Boac matrix:
--   • ₱120 base fare for the first kilometer
--   • ₱10 for every succeeding kilometer
--   • Distance rounded up to the next whole kilometer (applied in app logic)
--   • No peak-hour surcharge
-- Formula:  fare = 120 + (ceil(distance_km) - 1) × 10
-- Idempotent: safe to run more than once.
-- =============================================================================

UPDATE public.fare_matrix
SET base_fare            = 120.00,
    per_km_rate          = 10.00,
    peak_hour_multiplier = 1.00,
    peak_hours_enabled   = false;

-- Seed a row if the table is empty (fresh project).
INSERT INTO public.fare_matrix (base_fare, per_km_rate, peak_hour_multiplier, peak_hours_enabled)
SELECT 120.00, 10.00, 1.00, false
WHERE NOT EXISTS (SELECT 1 FROM public.fare_matrix);

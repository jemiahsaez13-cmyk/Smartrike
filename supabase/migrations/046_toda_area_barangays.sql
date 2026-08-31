-- =============================================================================
-- 046 · Widen toda_associations.area to TEXT and add area_barangays JSONB
--
-- area            — kept for freetext fallback, widened from VARCHAR(180) to TEXT
-- area_barangays  — JSONB array of selected Boac barangay names
-- Idempotent and safe to re-run.
-- =============================================================================

ALTER TABLE public.toda_associations
  ALTER COLUMN area TYPE TEXT;

ALTER TABLE public.toda_associations
  ADD COLUMN IF NOT EXISTS area_barangays JSONB NOT NULL DEFAULT '[]'::jsonb;

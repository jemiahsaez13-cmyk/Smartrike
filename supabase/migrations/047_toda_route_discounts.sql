-- =============================================================================
-- 047 · TODA Route Discount Percentages
--
-- Adds per-route discount columns to toda_routes:
--   senior_discount   — % discount for senior citizens   (default 20)
--   pwd_discount      — % discount for PWD               (default 20)
--   student_discount  — % discount for students          (default 0)
--
-- Values are stored as plain percentages (0–100), e.g. 20 = 20%.
-- Admin sets them per route; drivers use them for viewing only.
-- =============================================================================

ALTER TABLE public.toda_routes
  ADD COLUMN IF NOT EXISTS senior_discount  NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (senior_discount  BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS pwd_discount     NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (pwd_discount     BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS student_discount NUMERIC(5,2) NOT NULL DEFAULT 0  CHECK (student_discount BETWEEN 0 AND 100);

COMMENT ON COLUMN public.toda_routes.senior_discount  IS 'Senior citizen discount in percent (0–100). Default 20.';
COMMENT ON COLUMN public.toda_routes.pwd_discount     IS 'PWD discount in percent (0–100). Default 20.';
COMMENT ON COLUMN public.toda_routes.student_discount IS 'Student discount in percent (0–100). Default 0.';

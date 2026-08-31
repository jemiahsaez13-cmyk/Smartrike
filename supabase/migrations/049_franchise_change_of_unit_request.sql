-- =============================================================================
-- 049 · Change of Unit Request columns on franchise_applications (Module 12)
--
-- Adds a self-contained change-of-unit request workflow directly on the
-- franchise_applications row so no extra table is needed:
--
--   cou_status          pending | approved | rejected | null (no request yet)
--   cou_new_plate       requested new plate number
--   cou_new_body        requested new body number
--   cou_or_number       LTO OR number of the new unit
--   cou_cr_number       LTO CR number of the new unit
--   cou_requested_at    when driver submitted the request
--   cou_reviewed_at     when admin approved or rejected
--   cou_reviewed_by     admin user id
--   cou_rejection_reason reason text when rejected
--
-- Idempotent — safe to re-run.
-- =============================================================================

ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS cou_status            VARCHAR(20)  DEFAULT NULL
    CHECK (cou_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS cou_new_plate         VARCHAR(30)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_new_body          VARCHAR(30)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_or_number         VARCHAR(60)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_cr_number         VARCHAR(60)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_requested_at      TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_reviewed_at       TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cou_reviewed_by       UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cou_rejection_reason  TEXT         DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_franchise_cou_status
  ON public.franchise_applications(cou_status)
  WHERE cou_status IS NOT NULL;

COMMENT ON COLUMN public.franchise_applications.cou_status           IS 'Change of Unit request status: pending | approved | rejected. NULL = no active request.';
COMMENT ON COLUMN public.franchise_applications.cou_new_plate        IS 'New plate number requested by driver.';
COMMENT ON COLUMN public.franchise_applications.cou_new_body         IS 'New body number requested by driver.';
COMMENT ON COLUMN public.franchise_applications.cou_or_number        IS 'LTO Official Receipt number of the replacement unit.';
COMMENT ON COLUMN public.franchise_applications.cou_cr_number        IS 'LTO Certificate of Registration number of the replacement unit.';
COMMENT ON COLUMN public.franchise_applications.cou_requested_at     IS 'Timestamp when driver submitted the COU request.';
COMMENT ON COLUMN public.franchise_applications.cou_reviewed_at      IS 'Timestamp when admin approved or rejected the COU request.';
COMMENT ON COLUMN public.franchise_applications.cou_reviewed_by      IS 'Admin user id who reviewed the COU request.';
COMMENT ON COLUMN public.franchise_applications.cou_rejection_reason IS 'Reason provided by admin when rejecting a COU request.';

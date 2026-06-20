-- =============================================================================
-- 009 · Franchise document review (admin verifies submitted documents)
-- -----------------------------------------------------------------------------
-- Adds the data the admin "Franchise / MTOP" screen needs to view and verify
-- every submitted document before approving an application:
--   1. New columns: documents_verified_at, reviewed_by.
--   2. Per-document review state (review_status / review_remarks / uploaded_at /
--      file_url) lives inside the existing `documents` JSONB — backfilled here so
--      historical rows render correctly.
--   3. Explicit admin manage-all policy + realtime publication so the admin sees
--      live updates as drivers submit and as documents are reviewed.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

-- ── New columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS documents_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Default the documents column to an empty array and normalise NULLs.
ALTER TABLE public.franchise_applications
  ALTER COLUMN documents SET DEFAULT '[]'::jsonb;

UPDATE public.franchise_applications
  SET documents = '[]'::jsonb
  WHERE documents IS NULL;

-- ── Backfill: rows already past document verification → mark uploaded docs as
--    approved and stamp the verification time so the UI shows them as complete.
UPDATE public.franchise_applications fa
SET
  documents = (
    SELECT jsonb_agg(
      doc || jsonb_build_object(
        'review_status', CASE WHEN COALESCE((doc->>'uploaded')::boolean, false)
                              THEN COALESCE(NULLIF(doc->>'review_status', ''), 'approved')
                              ELSE COALESCE(NULLIF(doc->>'review_status', ''), 'pending') END,
        'uploaded_at',   COALESCE(NULLIF(doc->>'uploaded_at', ''), fa.created_at::text)
      )
    )
    FROM jsonb_array_elements(fa.documents) AS doc
  ),
  documents_verified_at = COALESCE(fa.documents_verified_at, fa.updated_at)
WHERE fa.status IN ('inspection', 'payment', 'approved', 'issued')
  AND jsonb_typeof(fa.documents) = 'array'
  AND jsonb_array_length(fa.documents) > 0;

-- ── Backfill: rows still awaiting review → ensure every doc has a review_status.
UPDATE public.franchise_applications fa
SET documents = (
  SELECT jsonb_agg(
    doc || jsonb_build_object(
      'review_status', COALESCE(NULLIF(doc->>'review_status', ''), 'pending')
    )
  )
  FROM jsonb_array_elements(fa.documents) AS doc
)
WHERE fa.status IN ('submitted', 'document_verification')
  AND jsonb_typeof(fa.documents) = 'array'
  AND jsonb_array_length(fa.documents) > 0;

-- ── Admin: explicit manage-all policy (view + verify documents + advance) ────
DROP POLICY IF EXISTS "Admins manage franchise applications" ON public.franchise_applications;
CREATE POLICY "Admins manage franchise applications" ON public.franchise_applications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Realtime: publish franchise_applications so the admin list updates live ───
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.franchise_applications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

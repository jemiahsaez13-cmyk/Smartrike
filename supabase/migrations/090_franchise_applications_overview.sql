-- 090: Light MTOP list for the admin screens.
--
-- Uploaded scans are stored inline as base64 data URIs (up to ~3.5 MB each)
-- in franchise_applications.documents[].file_url, payment_proof_url and the
-- Change of Unit image columns. The admin MTOP screen, the registry, the
-- dashboard and the reports all loaded `select *`, so every visit downloaded
-- every scan of every application — that is why the MTOP screen took so long.
--
-- franchise_applications_overview() returns the same rows as JSON without the
-- scans. It keeps only what the list actually shows inline:
--   * payment_proof_url while the application is at the payment step;
--   * the Change of Unit images while the request is pending.
-- documents[] keeps every field except file_url, and the row carries
-- files_omitted = true so the app knows to load the full row (getById) before
-- the admin opens the document review.
--
-- SECURITY INVOKER: the caller's RLS on franchise_applications still applies.

CREATE OR REPLACE FUNCTION public.franchise_applications_overview()
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    (to_jsonb(fa) - ARRAY['documents', 'payment_proof_url', 'cou_or_image', 'cou_cr_image', 'cou_unit_image'])
    || jsonb_build_object(
      'documents', COALESCE((
        SELECT jsonb_agg(
                 CASE WHEN jsonb_typeof(e.doc) = 'object' THEN e.doc - 'file_url' ELSE e.doc END
                 ORDER BY e.ord)
          FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(fa.documents) = 'array' THEN fa.documents ELSE '[]'::jsonb END
               ) WITH ORDINALITY AS e(doc, ord)
      ), '[]'::jsonb),
      'payment_proof_url', CASE WHEN fa.status = 'payment' THEN fa.payment_proof_url END,
      'cou_or_image',      CASE WHEN fa.cou_status = 'pending' THEN fa.cou_or_image END,
      'cou_cr_image',      CASE WHEN fa.cou_status = 'pending' THEN fa.cou_cr_image END,
      'cou_unit_image',    CASE WHEN fa.cou_status = 'pending' THEN fa.cou_unit_image END,
      'files_omitted',     TRUE
    )
  FROM public.franchise_applications fa
  ORDER BY fa.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.franchise_applications_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.franchise_applications_overview() TO authenticated;

-- The list is ordered newest first on every load.
CREATE INDEX IF NOT EXISTS idx_franchise_created_at
  ON public.franchise_applications (created_at DESC);

NOTIFY pgrst, 'reload schema';

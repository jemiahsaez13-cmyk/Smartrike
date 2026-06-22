-- =============================================================================
-- 017 · Admins can edit the fare matrix
-- -----------------------------------------------------------------------------
-- Migration 008 enabled RLS on fare_matrix and gave every authenticated user
-- SELECT. To let the admin console change the published fare, admins need a
-- manage-all (ALL) policy, via the SECURITY DEFINER is_admin() helper.
-- Idempotent: safe to run more than once.
-- =============================================================================

DROP POLICY IF EXISTS "Admins manage fare matrix" ON public.fare_matrix;
CREATE POLICY "Admins manage fare matrix" ON public.fare_matrix
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

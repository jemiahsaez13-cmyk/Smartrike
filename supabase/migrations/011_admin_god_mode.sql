-- =============================================================================
-- 011 · Admin "god mode" — full manage access across core tables
-- -----------------------------------------------------------------------------
-- The admin console needs to read AND act on every record: suspend/verify users,
-- audit or cancel bookings, manage transactions and notifications. Earlier
-- migrations only gave admins SELECT on some tables. This grants admins a
-- manage-all (ALL) policy everywhere, via the SECURITY DEFINER is_admin() helper
-- (no recursion). Idempotent: safe to run more than once.
-- =============================================================================

-- USERS — admin manage-all already exists (008); ensure present.
DROP POLICY IF EXISTS "Admins manage all users" ON public.users;
CREATE POLICY "Admins manage all users" ON public.users
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- BOOKINGS — was SELECT-only for admins; grant full manage (audit / cancel).
DROP POLICY IF EXISTS "Admins manage all bookings" ON public.bookings;
CREATE POLICY "Admins manage all bookings" ON public.bookings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- TRANSACTIONS — full manage for reconciliation.
DROP POLICY IF EXISTS "Admins manage all transactions" ON public.transactions;
CREATE POLICY "Admins manage all transactions" ON public.transactions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- NOTIFICATIONS — admins can broadcast / clean up.
DROP POLICY IF EXISTS "Admins manage all notifications" ON public.notifications;
CREATE POLICY "Admins manage all notifications" ON public.notifications
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ACTIVITY LOGS — admins can read everything and write system events.
DROP POLICY IF EXISTS "Admins manage all logs" ON public.activity_logs;
CREATE POLICY "Admins manage all logs" ON public.activity_logs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- SYSTEM HEALTH — admins can record / clear metrics.
DROP POLICY IF EXISTS "Admins manage system health" ON public.system_health;
CREATE POLICY "Admins manage system health" ON public.system_health
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- FRANCHISE — admin manage-all already added in 009; ensure present.
DROP POLICY IF EXISTS "Admins manage franchise applications" ON public.franchise_applications;
CREATE POLICY "Admins manage franchise applications" ON public.franchise_applications
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- 025_require_verified_driver_to_accept.sql
--
-- BUG: any driver could see and accept ride requests even while their account
-- was still verification_status='pending' (not yet approved by an admin). The
-- "Drivers view pending bookings" / "Drivers accept pending bookings" policies
-- only checked user_type='driver'.
--
-- Fix: require verification_status='verified' in both policies. Admins approve
-- drivers in the User Management screen (AdminService.setDriverVerification).
-- find_nearby_drivers() already only notifies verified drivers, so this makes
-- the whole pipeline consistent.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

DROP POLICY IF EXISTS "Drivers view pending bookings" ON public.bookings;
CREATE POLICY "Drivers view pending bookings" ON public.bookings
  FOR SELECT USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid()
        AND user_type = 'driver'
        AND verification_status = 'verified'
    )
  );

DROP POLICY IF EXISTS "Drivers accept pending bookings" ON public.bookings;
CREATE POLICY "Drivers accept pending bookings" ON public.bookings
  FOR UPDATE USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid()
        AND user_type = 'driver'
        AND verification_status = 'verified'
    )
  )
  WITH CHECK (driver_id = public.current_app_user_id());

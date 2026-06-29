-- =============================================================================
-- 022_chat_participants_view_profiles.sql
--
-- Problem: the only SELECT policy on `users` is "view own profile"
-- (auth.uid() = auth_id) plus admin. That means a passenger cannot read their
-- driver's name/photo (and vice versa), so chat headers, the Messages inbox,
-- and the driver-profile screen fall back to generic labels ("Your Driver").
--
-- Fix: let the two parties of a booking read each other's public profile.
-- We gate on a shared booking and use the SECURITY DEFINER helper
-- public.current_app_user_id() (added in 008) so the policy never recurses
-- back into `users` RLS.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

DROP POLICY IF EXISTS "Booking participants view each other" ON public.users;

CREATE POLICY "Booking participants view each other" ON public.users
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE
        -- The row being read is my driver (I'm the passenger on a shared booking)
        (b.driver_id = public.users.id AND b.passenger_id = public.current_app_user_id())
        -- …or the row being read is my passenger (I'm the driver)
        OR (b.passenger_id = public.users.id AND b.driver_id = public.current_app_user_id())
    )
  );

-- =============================================================================
-- 023_fix_users_policy_recursion.sql
--
-- HOTFIX for a regression introduced by 022. The "Booking participants view
-- each other" policy on public.users had an inline `EXISTS (SELECT … FROM
-- bookings …)`. Because the bookings RLS policies themselves sub-query
-- public.users, evaluating a users SELECT recursed:
--     users RLS → bookings RLS → users RLS → …  ⇒  42P17 infinite recursion.
-- That broke EVERY authenticated read of `users`, so logins failed with
-- "Your profile was not found."
--
-- Fix: move the booking-relationship check into a SECURITY DEFINER function
-- (same technique as is_admin() / current_app_user_id() in 008). A definer
-- function runs as its owner and bypasses RLS on the tables it touches, so the
-- policy no longer recurses.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.shares_booking_with(target_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE (b.driver_id = target_id    AND b.passenger_id = public.current_app_user_id())
       OR (b.passenger_id = target_id AND b.driver_id    = public.current_app_user_id())
  );
$$;

GRANT EXECUTE ON FUNCTION public.shares_booking_with(uuid) TO authenticated;

DROP POLICY IF EXISTS "Booking participants view each other" ON public.users;

CREATE POLICY "Booking participants view each other" ON public.users
  FOR SELECT TO authenticated USING (
    public.shares_booking_with(id)
  );

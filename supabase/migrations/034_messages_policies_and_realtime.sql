-- =============================================================================
-- 034_messages_policies_and_realtime.sql
--
-- 1. ROOT CAUSE of unread badges never clearing: `messages` had SELECT and
--    INSERT policies but NO UPDATE policy, so the app's mark-as-read writes
--    silently updated zero rows. Participants can now update (mark read) and
--    delete (remove a conversation) messages of their own bookings.
-- 2. Admin supervision: admins can view/manage all messages for moderation.
-- 3. Realtime: publish franchise_applications so MTOP approval states update
--    instantly on the driver's screen without a refresh.
--
-- Idempotent.
-- =============================================================================

-- Participants may mark a thread's messages read / manage them.
DROP POLICY IF EXISTS "Participants update messages" ON public.messages;
CREATE POLICY "Participants update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.passenger_id = public.current_app_user_id()
             OR b.driver_id = public.current_app_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.passenger_id = public.current_app_user_id()
             OR b.driver_id = public.current_app_user_id())
    )
  );

DROP POLICY IF EXISTS "Participants delete messages" ON public.messages;
CREATE POLICY "Participants delete messages" ON public.messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.passenger_id = public.current_app_user_id()
             OR b.driver_id = public.current_app_user_id())
    )
  );

-- Admin moderation: read + manage every conversation.
DROP POLICY IF EXISTS "Admins manage all messages" ON public.messages;
CREATE POLICY "Admins manage all messages" ON public.messages
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- MTOP approvals stream to the driver in real time.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.franchise_applications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- =============================================================================
-- 010 · Publish activity_logs for realtime
-- -----------------------------------------------------------------------------
-- The admin System Logs screen subscribes to INSERTs on activity_logs so new
-- events (bookings, franchise updates, sign-ins, profile edits) stream in live.
-- This adds the table to the supabase_realtime publication.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- =============================================================================
-- 032_message_notifications.sql
--
-- Real-time chat notifications, correctly targeted: whenever a trip message is
-- inserted, notify ONLY the other party of that booking (never the sender,
-- never bystanders). Runs server-side so it works no matter which client sent
-- the message. The app clears these ('type' = 'message', matching booking_id)
-- when the recipient opens the chat, keeping every unread badge in sync.
--
-- Idempotent.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_passenger UUID;
  v_driver    UUID;
  v_recipient UUID;
  v_sender    TEXT;
BEGIN
  SELECT passenger_id, driver_id INTO v_passenger, v_driver
  FROM public.bookings WHERE id = NEW.booking_id;

  IF v_passenger IS NULL THEN RETURN NEW; END IF;

  v_recipient := CASE
    WHEN NEW.sender_id = v_passenger THEN v_driver
    WHEN NEW.sender_id = v_driver    THEN v_passenger
    ELSE NULL  -- sender is not a party of this booking: notify nobody
  END;

  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN RETURN NEW; END IF;

  SELECT name INTO v_sender FROM public.users WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, booking_id, read)
  VALUES (
    v_recipient,
    'message',
    'New message from ' || COALESCE(v_sender, 'your ride'),
    left(NEW.message, 120),
    NEW.booking_id,
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_message_recipient ON public.messages;
CREATE TRIGGER trg_notify_message_recipient
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_recipient();

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { MessageService } from '@/models/services/MessageService';
import { supabase, isSupabaseConfigured } from '@/config/supabase';

const service = new MessageService();

/**
 * Live unread-message count for one trip's chat thread. Refreshes when the
 * screen regains focus (e.g. returning from the chat, which marks messages
 * read) and whenever a message row for this booking changes, so the red badge
 * appears and disappears in real time.
 */
export const useChatUnread = (bookingId: string | null | undefined, userId: string | null | undefined) => {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!bookingId || !userId) {
      setUnread(0);
      return;
    }
    try {
      setUnread(await service.getUnreadCountForBooking(bookingId, userId));
    } catch {
      /* keep last known count */
    }
  }, [bookingId, userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !bookingId) return;
    let channel: any;
    try {
      channel = supabase
        .channel(`chat_unread_${bookingId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
          () => refresh()
        )
        .subscribe();
    } catch {
      /* realtime unavailable */
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [bookingId, refresh]);

  return unread;
};

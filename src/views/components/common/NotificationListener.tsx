import { useEffect } from 'react';
import { Vibration } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { addNotification, fetchNotifications } from '@/controllers/slices/notificationSlice';
import { supabase, isSupabaseConfigured } from '@/config/supabase';

/**
 * App-wide notification pipe. Mounted once for the signed-in user, it:
 *  - loads their unread notifications so badges are correct from launch,
 *  - subscribes to THEIR notification inserts only (server-side user filter,
 *    plus a client-side user_id check as a second fence so an event can never
 *    surface on an account it doesn't belong to),
 *  - vibrates on each new notification (booking events and chat messages both
 *    arrive here, so haptic feedback is consistent everywhere).
 */
export const NotificationListener = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id || user.id.startsWith('demo-')) return;

    dispatch(fetchNotifications(user.id));

    let channel: any;
    try {
      channel = supabase
        .channel(`user_notifications_${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            const row = payload?.new;
            if (!row || row.user_id !== user.id) return; // never someone else's
            dispatch(addNotification(row));
            Vibration.vibrate([0, 180, 90, 180]);
          }
        )
        .subscribe();
    } catch {
      /* realtime unavailable — badges still refresh on screen focus */
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [user?.id, dispatch]);

  return null;
};

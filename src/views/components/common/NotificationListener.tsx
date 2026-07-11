import { useEffect } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { addNotification, fetchNotifications } from '@/controllers/slices/notificationSlice';
import { supabase, isSupabaseConfigured } from '@/config/supabase';

// Heads-up banners even while the app is open (Messenger-style pop-over).
const notificationsSupported = Platform.OS !== 'web';
if (notificationsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * App-wide notification pipe. Mounted once for the signed-in user, it:
 *  - asks for the device's notification permission (needed for heads-up
 *    banners) the first time a user signs in,
 *  - loads their unread notifications so badges are correct from launch,
 *  - subscribes to THEIR notification inserts only (server-side user filter,
 *    plus a client-side user_id check as a second fence so an event can never
 *    surface on an account it doesn't belong to),
 *  - pops a Messenger-style heads-up banner + vibrates on each new
 *    notification (booking events and chat messages both arrive here).
 */
export const NotificationListener = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  // One-time device setup: high-importance Android channel + permission ask.
  useEffect(() => {
    if (!notificationsSupported) return;
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Smart Trike alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 180, 90, 180],
            lightColor: '#3B634E',
          });
        }
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') await Notifications.requestPermissionsAsync();
      } catch {
        /* notifications unavailable on this device — in-app badges still work */
      }
    })();
  }, []);

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
            if (notificationsSupported) {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: row.title || 'Smart Trike',
                  body: row.body || '',
                  data: { booking_id: row.booking_id ?? null, type: row.type },
                  sound: true,
                },
                trigger: null, // fire immediately → heads-up banner
              }).catch(() => undefined);
            }
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

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import {
  addNotification,
  markNotificationRead,
  markAllRead,
  markReadAndPersist,
  markAllReadAndPersist,
  fetchNotifications,
} from '@/controllers/slices/notificationSlice';
import { RealtimeService } from '@/models/services/RealtimeService';
import { Card } from '@/views/components/common/Card';
import { Loading } from '@/views/components/common/Loading';
import { colors, gradients, radius, shadows, spacing, typography } from '@/views/styles/theme';
import { formatRelativeTime } from '@/utils/dateUtils';
import { NOTIFICATION_TYPES } from '@/config/constants';

const NOTIF_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  [NOTIFICATION_TYPES.BOOKING_REQUEST]: { icon: 'bell-ring', color: colors.accent, bg: colors.infoLight },
  [NOTIFICATION_TYPES.BOOKING_ACCEPTED]: { icon: 'check-circle', color: colors.secondary, bg: colors.successLight },
  [NOTIFICATION_TYPES.BOOKING_COMPLETED]: { icon: 'flag-checkered', color: colors.secondary, bg: colors.successLight },
  [NOTIFICATION_TYPES.BOOKING_CANCELLED]: { icon: 'close-circle', color: colors.error, bg: colors.errorLight },
  [NOTIFICATION_TYPES.DRIVER_ARRIVED]: { icon: 'map-marker-check', color: colors.accent, bg: colors.infoLight },
  [NOTIFICATION_TYPES.TRIP_STARTED]: { icon: 'navigation-variant', color: colors.accent, bg: colors.infoLight },
  [NOTIFICATION_TYPES.PAYMENT_RECEIVED]: { icon: 'cash-check', color: colors.secondary, bg: colors.successLight },
  [NOTIFICATION_TYPES.FRANCHISE_STATUS]: { icon: 'card-account-details', color: colors.warning, bg: colors.warningLight },
  [NOTIFICATION_TYPES.SYSTEM_ALERT]: { icon: 'alert-circle', color: colors.warning, bg: colors.warningLight },
};

const getNotifMeta = (type: string) =>
  NOTIF_ICONS[type] ?? { icon: 'bell', color: colors.textSecondary, bg: colors.surfaceAlt };

export const NotificationsScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { notifications, loading } = useAppSelector(state => state.notification);
  const { user } = useAppSelector(state => state.auth);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const realtime = useRef(new RealtimeService()).current;
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 30, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  // Load + live-subscribe whenever the signed-in user changes. New rows inserted
  // for this user (by drivers, the system, etc.) appear without a manual refresh.
  useEffect(() => {
    if (!user?.id) return;
    dispatch(fetchNotifications(user.id));
    // Realtime is best-effort: a failed channel/WebSocket must never blank the
    // list, so guard subscribe/unsubscribe and just log on failure.
    let key: string | undefined;
    try {
      key = realtime.subscribeToNotifications(user.id, (payload: any) => {
        if (payload?.new) dispatch(addNotification(payload.new));
      });
    } catch (err) {
      console.warn('Notification realtime subscribe failed:', err);
    }
    return () => {
      try {
        if (key) realtime.unsubscribe(key);
      } catch {
        // ignore teardown errors
      }
    };
  }, [user?.id]);

  const onRefresh = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    await dispatch(fetchNotifications(user.id));
    setRefreshing(false);
  };

  const handleMarkRead = (id: string) => {
    dispatch(markNotificationRead(id)); // optimistic
    dispatch(markReadAndPersist(id));   // persist to backend
  };

  const handleMarkAll = () => {
    dispatch(markAllRead()); // optimistic
    if (user?.id) dispatch(markAllReadAndPersist(user.id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return <Loading message="Loading notifications..." />;

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <LinearGradient colors={gradients.brand} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <Text style={styles.headerSub}>{unreadCount} unread</Text>
              )}
            </View>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAll}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="bell-off-outline" size={72} color={colors.textLight} />
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptyBody}>No notifications yet. We'll let you know when something happens.</Text>
            </View>
          ) : (
            notifications.map((notif, idx) => {
              const meta = getNotifMeta(notif.type);
              return (
                <TouchableOpacity
                  key={notif.id ?? idx}
                  onPress={() => handleMarkRead(notif.id)}
                  activeOpacity={0.8}
                >
                  <Card
                    variant={notif.read ? 'outlined' : 'elevated'}
                    padding="none"
                    style={[styles.notifCard, !notif.read && styles.notifUnread]}
                  >
                    {!notif.read && <View style={styles.unreadBar} />}
                    <View style={styles.notifContent}>
                      <View style={[styles.notifIcon, { backgroundColor: meta.bg }]}>
                        <MaterialCommunityIcons name={meta.icon as any} size={22} color={meta.color} />
                      </View>
                      <View style={styles.notifText}>
                        <Text style={styles.notifTitle}>{notif.title}</Text>
                        <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                        <Text style={styles.notifTime}>
                          {formatRelativeTime(notif.created_at)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 52,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: { ...typography.h1, color: '#fff', fontSize: 28 },
  headerSub: { ...typography.bodySmall, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  markAllBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  markAllText: { ...typography.label, color: '#fff', fontSize: 12 },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: 48,
    gap: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: { ...typography.h2, color: colors.textSecondary },
  emptyBody: { ...typography.body, color: colors.textMuted, textAlign: 'center', maxWidth: 280 },
  notifCard: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  notifUnread: {
    borderLeftWidth: 0,
  },
  unreadBar: {
    width: 4,
    backgroundColor: colors.accent,
  },
  notifContent: {
    flex: 1,
    flexDirection: 'row',
    padding: spacing.md,
    gap: 14,
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifText: { flex: 1 },
  notifTitle: { ...typography.subtitle, color: colors.text, fontSize: 14 },
  notifBody: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 18 },
  notifTime: { ...typography.bodySmall, color: colors.textLight, fontSize: 11, marginTop: 6 },
});

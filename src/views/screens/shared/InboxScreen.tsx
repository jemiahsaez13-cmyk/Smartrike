import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { MessageService } from '@/models/services/MessageService';
import { Conversation } from '@/models/types';
import { supabase, isSupabaseConfigured } from '@/config/supabase';
import { colors, layout, spacing, typography } from '@/views/styles/theme';

const service = new MessageService();

/** "9:41 AM" today, "Mon" this week, otherwise "Jun 12". */
const formatStamp = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diffDays = (now.getTime() - d.getTime()) / 86_400_000;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const statusMeta: Record<Conversation['bookingStatus'], { label: string; color: string }> = {
  pending: { label: 'Pending', color: colors.textMuted },
  accepted: { label: 'On the way', color: colors.success },
  'in-transit': { label: 'In transit', color: colors.success },
  completed: { label: 'Completed', color: colors.textMuted },
  cancelled: { label: 'Cancelled', color: colors.error },
};

export const InboxScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await service.getConversations(user.id);
      setConversations(data);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Refresh every time the inbox comes into focus (e.g. returning from a chat).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Realtime: any new/updated message for this user refreshes the previews
  // and unread badges without a manual pull.
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    let channel: any;
    try {
      channel = supabase
        .channel(`inbox_${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
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
  }, [user?.id, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openChat = (c: Conversation) => {
    navigation.navigate('Chat', { bookingId: c.bookingId, otherName: c.otherName });
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const renderItem = ({ item }: { item: Conversation }) => {
    const status = statusMeta[item.bookingStatus];
    const hasUnread = item.unreadCount > 0;
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openChat(item)}>
        <View style={[styles.avatar, item.active && styles.avatarActive]}>
          <Text style={styles.avatarText}>{item.otherName.charAt(0).toUpperCase()}</Text>
          {item.active && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>
              {item.otherName}
            </Text>
            <Text style={[styles.time, hasUnread && styles.timeUnread]}>{formatStamp(item.lastTimestamp)}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
              {item.lastMessage ?? `${item.otherType === 'driver' ? 'Your driver is assigned' : 'New passenger'} — say hello`}
            </Text>
            {hasUnread ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
              </View>
            ) : (
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Messages</Text>
          {totalUnread > 0 && <Text style={styles.subtitle}>{totalUnread} unread</Text>}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.bookingId}
          renderItem={renderItem}
          contentContainerStyle={conversations.length === 0 ? styles.emptyContent : styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons name="message-text-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                When you’re matched with a {user?.user_type === 'driver' ? 'passenger' : 'driver'}, your chat will appear
                here automatically.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.screen,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  titleWrap: { flex: 1 },
  title: { ...typography.h3, color: colors.text, fontSize: 20 },
  subtitle: { ...typography.bodySmall, color: colors.primary, fontSize: 12, marginTop: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingVertical: spacing.xs },
  separator: { height: 1, backgroundColor: colors.borderLight, marginLeft: 84 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarActive: { backgroundColor: colors.primary },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  rowBody: { flex: 1, justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...typography.subtitle, color: colors.text, flex: 1, marginRight: spacing.sm },
  time: { ...typography.labelSmall, color: colors.textMuted, fontSize: 12 },
  timeUnread: { color: colors.primary, fontWeight: '700' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  preview: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, marginRight: spacing.sm, fontSize: 13 },
  previewUnread: { color: colors.text, fontWeight: '600' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl * 1.5, gap: spacing.sm },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptyText: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/config/supabase';
import { Message } from '@/models/types';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';
import { formatDate, formatTime } from '@/utils/dateUtils';

type ThreadSummary = {
  bookingId: string;
  passengerName: string;
  driverName: string;
  lastMessage: string;
  lastTimestamp: string;
  count: number;
};

/**
 * Admin-only moderation view of trip conversations (read-only). RLS: the
 * "Admins manage all messages" policy is what makes these queries return
 * data — regular accounts still only ever see their own threads.
 */
export const AdminMessagesScreen = () => {
  const navigation = useNavigation<any>();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openThread, setOpenThread] = useState<ThreadSummary | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('booking_id, message, timestamp')
        .order('timestamp', { ascending: false })
        .limit(400);
      if (error) throw error;

      // Collapse to one row per booking (msgs are newest-first).
      const byBooking = new Map<string, { last: any; count: number }>();
      for (const m of msgs ?? []) {
        const cur = byBooking.get(m.booking_id);
        if (cur) cur.count += 1;
        else byBooking.set(m.booking_id, { last: m, count: 1 });
      }
      const bookingIds = Array.from(byBooking.keys());
      if (!bookingIds.length) {
        setThreads([]);
        return;
      }
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, passenger_id, driver_id')
        .in('id', bookingIds);
      const userIds = Array.from(
        new Set((bookings ?? []).flatMap((b: any) => [b.passenger_id, b.driver_id]).filter(Boolean))
      );
      const { data: users } = userIds.length
        ? await supabase.from('users').select('id, name').in('id', userIds)
        : { data: [] as any[] };
      const nameById = new Map<string, string>((users ?? []).map((u: any) => [u.id, u.name]));
      const bookingById = new Map<string, any>((bookings ?? []).map((b: any) => [b.id, b]));

      setThreads(
        bookingIds.map((id) => {
          const info = byBooking.get(id)!;
          const b = bookingById.get(id);
          return {
            bookingId: id,
            passengerName: nameById.get(b?.passenger_id) ?? 'Passenger',
            driverName: nameById.get(b?.driver_id) ?? 'Driver',
            lastMessage: info.last.message,
            lastTimestamp: String(info.last.timestamp),
            count: info.count,
          };
        })
      );
    } catch (e) {
      console.error('Failed to load conversations:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openConversation = async (t: ThreadSummary) => {
    setOpenThread(t);
    setThreadLoading(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('booking_id', t.bookingId)
        .order('timestamp', { ascending: true });
      setThread((data ?? []) as Message[]);
    } finally {
      setThreadLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ThreadSummary }) => (
    <TouchableOpacity style={styles.row} activeOpacity={0.75} onPress={() => openConversation(item)}>
      <View style={styles.pairIcon}>
        <MaterialCommunityIcons name="account-multiple-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pairText} numberOfLines={1}>
          {item.passengerName} ↔ {item.driverName}
        </Text>
        <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
      </View>
      <View style={styles.metaCol}>
        <Text style={styles.stamp}>{formatDate(item.lastTimestamp)}</Text>
        <View style={styles.countChip}>
          <Text style={styles.countText}>{item.count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Message Supervision</Text>
          <Text style={styles.subtitle}>Read-only moderation view of trip conversations</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.bookingId}
          renderItem={renderItem}
          contentContainerStyle={threads.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="message-off-outline" size={40} color={colors.textLight} />
              <Text style={styles.emptyText}>No conversations on record.</Text>
            </View>
          }
        />
      )}

      {/* Read-only thread viewer */}
      <Modal visible={!!openThread} transparent animationType="slide" onRequestClose={() => setOpenThread(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {openThread?.passengerName} ↔ {openThread?.driverName}
                </Text>
                <Text style={styles.sheetSub}>Booking {openThread?.bookingId.slice(0, 8)} · read-only</Text>
              </View>
              <TouchableOpacity onPress={() => setOpenThread(null)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            {threadLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
            ) : (
              <ScrollView style={styles.thread} showsVerticalScrollIndicator={false}>
                {thread.map((m) => (
                  <View
                    key={m.id}
                    style={[styles.bubbleRow, m.sender_type === 'driver' ? styles.rowRight : styles.rowLeft]}
                  >
                    <View style={[styles.bubble, m.sender_type === 'driver' ? styles.bubbleDriver : styles.bubblePassenger]}>
                      <Text style={styles.senderTag}>{m.sender_type === 'driver' ? 'Driver' : 'Passenger'}</Text>
                      <Text style={styles.bubbleText}>{m.message}</Text>
                      <Text style={styles.bubbleTime}>{formatTime(m.timestamp as any)}</Text>
                    </View>
                  </View>
                ))}
                {thread.length === 0 && <Text style={styles.emptyText}>No messages.</Text>}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
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
  title: { ...typography.h3, fontSize: 20, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: spacing.screen, paddingBottom: layout.contentBottom },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pairIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairText: { ...typography.label, fontSize: 14, color: colors.text },
  preview: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  metaCol: { alignItems: 'flex-end', gap: 4 },
  stamp: { ...typography.bodySmall, fontSize: 11, color: colors.textLight },
  countChip: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: { ...typography.labelSmall, fontSize: 11, color: colors.textSecondary },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  sheetTitle: { ...typography.h3, fontSize: 17, color: colors.text },
  sheetSub: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, marginTop: 1 },
  thread: { marginTop: spacing.xs },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.sm },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubblePassenger: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: 4 },
  bubbleDriver: { backgroundColor: colors.infoLight, borderBottomRightRadius: 4 },
  senderTag: { ...typography.labelSmall, fontSize: 9, color: colors.textMuted, letterSpacing: 0.6, marginBottom: 2 },
  bubbleText: { ...typography.body, fontSize: 14, color: colors.text },
  bubbleTime: { ...typography.labelSmall, fontSize: 9, color: colors.textMuted, marginTop: 3, alignSelf: 'flex-end' },
});

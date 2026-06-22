import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { MessageService } from '@/models/services/MessageService';
import { Message } from '@/models/types';
import { supabase, isSupabaseConfigured } from '@/config/supabase';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

const service = new MessageService();

export const ChatScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const bookingId: string = route.params?.bookingId;
  const otherName: string = route.params?.otherName || 'Driver';

  const user = useAppSelector((state) => state.auth.user);
  const myType: 'passenger' | 'driver' = user?.user_type === 'driver' ? 'driver' : 'passenger';

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

  const load = useCallback(async () => {
    if (!bookingId) return;
    try {
      const data = await service.getMessages(bookingId);
      setMessages(data);
      scrollToEnd();
      await service.markAllRead(bookingId, myType);
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  }, [bookingId, myType]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: append new messages as they arrive.
  useEffect(() => {
    if (!isSupabaseConfigured || !bookingId) return;
    let channel: any;
    try {
      channel = supabase
        .channel(`messages_${bookingId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
          (payload: any) => {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
            scrollToEnd();
          }
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
  }, [bookingId]);

  const send = async () => {
    const body = text.trim();
    if (!body || !user?.id || !bookingId) return;
    setText('');
    setSending(true);
    // Optimistic append so the sender sees it instantly.
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      booking_id: bookingId,
      sender_id: user.id,
      sender_type: myType,
      message: body,
      read: false,
      timestamp: new Date() as any,
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToEnd();
    try {
      const saved = await service.sendMessage(bookingId, user.id, myType, body);
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
    } catch (e: any) {
      // Roll back the optimistic message on failure.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const fmtTime = (ts: any) => {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{otherName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{otherName}</Text>
            <Text style={styles.headerSub}>{myType === 'passenger' ? 'Your driver' : 'Your passenger'}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        >
          {messages.length === 0 && (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="message-text-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>Send a message about your pickup point or landmark.</Text>
            </View>
          )}

          {messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <View key={m.id} style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: '#fff' }]}>{m.message}</Text>
                  <Text style={[styles.bubbleTime, mine && { color: 'rgba(255,255,255,0.6)' }]}>{fmtTime(m.timestamp)}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            onSubmitEditing={send}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            onPress={send}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  headerName: { ...typography.label, fontSize: 15 },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, gap: spacing.sm },
  emptyText: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.xl },
  bubbleRow: { marginBottom: spacing.sm, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: 4 },
  bubbleText: { ...typography.body, fontSize: 14, color: colors.text },
  bubbleTime: { ...typography.labelSmall, fontSize: 9, color: colors.textMuted, marginTop: 3, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    ...typography.body,
    fontSize: 14,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

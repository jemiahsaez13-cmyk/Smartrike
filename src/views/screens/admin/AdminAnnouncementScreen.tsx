import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import {
  AnnouncementService,
  Announcement,
  AnnouncementAudience,
  AnnouncementCategory,
  ANNOUNCEMENT_CATEGORY_LABEL,
  AUDIENCE_LABEL,
} from '@/models/services/NotificationService';
import { colors, gradients, radius, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIENCES: AnnouncementAudience[] = ['all', 'driver', 'passenger'];
const CATEGORIES: AnnouncementCategory[] = [
  'general',
  'maintenance',
  'meeting',
  'renewal_reminder',
  'payment_reminder',
  'safety',
  'policy',
];

const CATEGORY_ICON: Record<AnnouncementCategory, string> = {
  general:          'bullhorn-outline',
  maintenance:      'wrench-outline',
  meeting:          'calendar-account-outline',
  renewal_reminder: 'card-account-details-outline',
  payment_reminder: 'cash-clock',
  safety:           'shield-alert-outline',
  policy:           'file-document-outline',
};

const announcementService = new AnnouncementService();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// ─── Component ────────────────────────────────────────────────────────────────

export const AdminAnnouncementScreen = () => {
  const navigation = useNavigation<any>();
  const user = useSelector((state: any) => state.auth.user);

  // ── History state ──
  const [history, setHistory] = useState<Announcement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Compose form state ──
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('all');
  const [category, setCategory] = useState<AnnouncementCategory>('general');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Load history ──
  const loadHistory = useCallback(async () => {
    try {
      const data = await announcementService.getHistory(50);
      setHistory(data);
    } catch (e: any) {
      console.error('Failed to load announcement history:', e);
    } finally {
      setHistoryLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setHistoryLoading(true);
      loadHistory();
    }, [loadHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  // ── Send announcement ──
  const handleSend = async () => {
    setFormError(null);
    if (!title.trim()) { setFormError('Title is required.'); return; }
    if (!body.trim()) { setFormError('Message body is required.'); return; }

    setSending(true);
    try {
      const result = await announcementService.broadcast(
        title.trim(),
        body.trim(),
        audience,
        category,
        user?.id ?? null,
      );
      // Prepend to history and close compose
      setHistory((prev) => [result, ...prev]);
      setTitle('');
      setBody('');
      setAudience('all');
      setCategory('general');
      setComposing(false);
    } catch (e: any) {
      setFormError(e?.message ?? 'Failed to send announcement.');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setBody('');
    setAudience('all');
    setCategory('general');
    setFormError(null);
    setComposing(false);
  };

  // ── Chip selector helpers ──
  const ChipRow = <T extends string>({
    options,
    selected,
    label,
    onSelect,
  }: {
    options: T[];
    selected: T;
    label: (v: T) => string;
    onSelect: (v: T) => void;
  }) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          activeOpacity={0.75}
          style={[styles.chip, selected === opt && styles.chipSelected]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[styles.chipLabel, selected === opt && styles.chipLabelSelected]}>
            {label(opt)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={gradients.admin}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.76}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Announcements</Text>
            <Text style={styles.headerSub}>Broadcast messages to users</Text>
          </View>
          <TouchableOpacity
            style={styles.composeBtn}
            onPress={() => setComposing(true)}
            activeOpacity={0.76}
          >
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* ── Compose Form ── */}
          {composing && (
            <Card variant="elevated" padding="lg" style={styles.composeCard}>
              <View style={styles.composeHeader}>
                <MaterialCommunityIcons
                  name="bullhorn"
                  size={20}
                  color={colors.primary}
                  style={styles.composeIcon}
                />
                <Text style={styles.composeTitleLabel}>New Announcement</Text>
              </View>

              {/* Title input */}
              <Text style={styles.fieldLabel}>Title</Text>
              <View style={styles.textInputWrapper}>
                <TextInputField
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Mandatory Safety Briefing"
                  maxLength={80}
                />
              </View>

              {/* Body input */}
              <Text style={styles.fieldLabel}>Message</Text>
              <View style={styles.textInputWrapper}>
                <TextInputField
                  value={body}
                  onChangeText={setBody}
                  placeholder="Write your announcement here…"
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
              </View>

              {/* Audience */}
              <Text style={styles.fieldLabel}>Audience</Text>
              <ChipRow
                options={AUDIENCES}
                selected={audience}
                label={(v) => AUDIENCE_LABEL[v]}
                onSelect={setAudience}
              />

              {/* Category */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Category</Text>
              <ChipRow
                options={CATEGORIES}
                selected={category}
                label={(v) => ANNOUNCEMENT_CATEGORY_LABEL[v]}
                onSelect={setCategory}
              />

              {/* Error */}
              {formError && (
                <View style={styles.errorRow}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={15} color={colors.error} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCancel}
                  activeOpacity={0.76}
                  disabled={sending}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  activeOpacity={0.76}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.sendBtnText}>Send</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* ── History list ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>BROADCAST HISTORY</Text>
            <Text style={styles.sectionCount}>{history.length} sent</Text>
          </View>

          {historyLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : history.length === 0 ? (
            <Card variant="elevated" padding="lg" style={styles.emptyCard}>
              <MaterialCommunityIcons
                name="bullhorn-outline"
                size={36}
                color={colors.textMuted}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>No announcements yet</Text>
              <Text style={styles.emptyBody}>
                Tap the + button to broadcast your first message.
              </Text>
            </Card>
          ) : (
            <Card variant="elevated" padding="none" style={styles.historyCard}>
              {history.map((item, index) => (
                <View key={item.id}>
                  <View style={styles.historyItem}>
                    <View
                      style={[
                        styles.historyIcon,
                        {
                          backgroundColor:
                            item.category === 'safety' || item.category === 'policy'
                              ? colors.errorLight
                              : colors.surfaceAlt,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={CATEGORY_ICON[item.category] as any}
                        size={20}
                        color={
                          item.category === 'safety' || item.category === 'policy'
                            ? colors.error
                            : colors.primary
                        }
                      />
                    </View>
                    <View style={styles.historyCopy}>
                      <View style={styles.historyTitleRow}>
                        <Text style={styles.historyTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <View style={styles.audiencePill}>
                          <Text style={styles.audiencePillText}>
                            {AUDIENCE_LABEL[item.audience]}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={styles.historyBody}
                        numberOfLines={2}
                      >
                        {item.body}
                      </Text>
                      <View style={styles.historyMeta}>
                        <MaterialCommunityIcons
                          name="account-group-outline"
                          size={12}
                          color={colors.textMuted}
                        />
                        <Text style={styles.historyMetaText}>
                          {item.recipient_count} recipient{item.recipient_count !== 1 ? 's' : ''}
                        </Text>
                        <Text style={styles.historyDot}>·</Text>
                        <Text style={styles.historyMetaText}>{formatDate(item.sent_at)}</Text>
                      </View>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {ANNOUNCEMENT_CATEGORY_LABEL[item.category]}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {index < history.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── Inline text input (avoids react-native-paper TextInput quirks) ───────────

import { TextInput as RNTextInput } from 'react-native';

const TextInputField = ({
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  maxLength,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
}) => (
  <RNTextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={colors.textMuted}
    multiline={multiline}
    numberOfLines={numberOfLines}
    maxLength={maxLength}
    style={[
      styles.textInput,
      multiline && { minHeight: (numberOfLines ?? 3) * 22, textAlignVertical: 'top' },
    ]}
  />
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: 44,
    paddingBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerCopy: { flex: 1 },
  headerTitle: {
    ...typography.h2,
    color: '#FFFFFF',
    fontSize: 22,
  },
  headerSub: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  composeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 100,
    paddingTop: spacing.md,
  },

  // Compose card
  composeCard: { marginBottom: spacing.xl },
  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  composeIcon: { marginRight: spacing.sm },
  composeTitleLabel: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 16,
  },
  fieldLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  textInputWrapper: { marginBottom: spacing.xs },
  textInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Questrial_400Regular',
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 12,
  },
  chipLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Form actions
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    fontSize: 12,
    flex: 1,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 14,
  },
  sendBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendBtnDisabled: { opacity: 0.55 },
  sendBtnText: {
    ...typography.label,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: spacing.md,
  },
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  sectionCount: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 11,
  },

  // Loading
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { marginBottom: spacing.md },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // History list
  historyCard: { marginBottom: spacing.sm },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  historyCopy: { flex: 1 },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  historyTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  audiencePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.infoLight,
  },
  audiencePillText: {
    ...typography.labelSmall,
    color: colors.info,
    fontSize: 10,
    fontWeight: '600',
  },
  historyBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  historyMetaText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 11,
  },
  historyDot: {
    color: colors.textMuted,
    fontSize: 11,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryBadgeText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
});

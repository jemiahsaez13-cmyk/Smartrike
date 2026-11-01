import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { ConductService, ConductSummary } from '@/models/services/ConductService';
import { DriverViolation, ViolationStatus } from '@/models/entities/Association';
import { CONDUCT_FLAG_THRESHOLD, CONDUCT_WINDOW_DAYS } from '@/config/constants';
import { formatDate } from '@/utils/dateUtils';
import { notify } from '@/utils/confirm';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

const conductService = new ConductService();

const STATUS_META: Record<ViolationStatus, { label: string; color: string; bg: string }> = {
  open:      { label: 'Under review', color: colors.error,     bg: colors.errorLight },
  confirmed: { label: 'Confirmed',    color: '#8A5A00',        bg: colors.warningLight },
  resolved:  { label: 'Resolved',     color: colors.success,   bg: colors.successLight },
  dismissed: { label: 'Dismissed',    color: colors.textMuted, bg: colors.surfaceAlt },
};

/** Driver/passenger view of their own violation notices and weekly standing. */
export const MyViolationsScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);
  const role = user?.user_type === 'driver' ? 'driver' : 'passenger';
  const [violations, setViolations] = useState<DriverViolation[]>([]);
  const [summary, setSummary] = useState<ConductSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await conductService.getMyConduct(user.id, role);
      setViolations(result.violations);
      setSummary(result.summary);
    } catch (error: any) {
      void notify('Could not load violations', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, role]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const underReview = !!summary && (summary.flagged || summary.repeatedCancellations);

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Violations & Restrictions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={[styles.standing, { backgroundColor: underReview ? colors.errorLight : colors.surface }]}>
              <MaterialCommunityIcons
                name={underReview ? 'flag' : 'shield-check'}
                size={28}
                color={underReview ? colors.error : colors.success}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.standingTitle, underReview && { color: colors.error }]}>
                  {underReview ? 'Account under admin review' : 'Account in good standing'}
                </Text>
                <Text style={styles.standingSub}>
                  {underReview
                    ? 'The TODA admin will review your records before deciding on any restriction.'
                    : 'No restriction is on your account.'}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Last {CONDUCT_WINDOW_DAYS} days</Text>
            <View style={styles.countCard}>
              <CountRow label="Confirmed violations" value={summary?.confirmedViolations ?? 0} />
              {role === 'passenger' && (
                <CountRow label="Cancellations without a valid reason" value={summary?.invalidCancellations ?? 0} />
              )}
              <Text style={styles.rule}>
                {CONDUCT_FLAG_THRESHOLD} or more within {CONDUCT_WINDOW_DAYS} days flags the account for admin review, which can lead to suspension or permanent deactivation.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Violation notices</Text>
            {violations.length === 0 ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="shield-check-outline" size={44} color={colors.textLight} />
                <Text style={styles.emptyText}>No violations on record.</Text>
              </View>
            ) : (
              violations.map((v) => {
                const meta = STATUS_META[v.status] ?? STATUS_META.open;
                return (
                  <View key={v.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardType}>{v.violation_type}</Text>
                      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardDate}>Incident date: {formatDate(v.incident_date)}</Text>
                    {!!v.description && <Text style={styles.cardBody}>{v.description}</Text>}
                    {!!v.penalty && (
                      <View style={styles.penaltyBox}>
                        <MaterialCommunityIcons name="gavel" size={14} color="#8A5A00" />
                        <Text style={styles.penaltyText}>{v.penalty}</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const CountRow = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.countRow}>
    <Text style={styles.countLabel}>{label}</Text>
    <Text style={[styles.countValue, value >= CONDUCT_FLAG_THRESHOLD && { color: colors.error }]}>
      {value} / {CONDUCT_FLAG_THRESHOLD}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.screen,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  appBarTitle: { ...typography.h3, fontSize: 18 },
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, paddingBottom: 120 },
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  standingTitle: { ...typography.label, fontSize: 16, color: colors.text },
  standingSub: { ...typography.bodySmall, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { ...typography.label, fontSize: 15, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm },
  countCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  countLabel: { ...typography.body, fontSize: 14, color: colors.text, flex: 1, paddingRight: spacing.sm },
  countValue: { ...typography.label, fontSize: 15, color: colors.text },
  rule: { ...typography.bodySmall, fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardType: { ...typography.label, fontSize: 15, color: colors.text, flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { ...typography.labelSmall, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  cardDate: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  cardBody: { ...typography.body, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
  penaltyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  penaltyText: { flex: 1, ...typography.labelSmall, fontSize: 12, color: '#8A5A00' },
});

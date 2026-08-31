import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { RidePaymentService } from '@/models/services/RidePaymentService';
import { RidePaymentSubmission, RidePaymentStatus } from '@/models/entities/RidePayment';
import { confirm, notify } from '@/utils/confirm';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

const service = new RidePaymentService();

type Filter = 'all' | RidePaymentStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_META: Record<RidePaymentStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: 'Pending',  color: colors.warning,  bg: colors.warningLight,  icon: 'clock-outline' },
  verified: { label: 'Verified', color: colors.success,  bg: colors.successLight,  icon: 'check-circle-outline' },
  rejected: { label: 'Rejected', color: colors.error,    bg: colors.errorLight,    icon: 'close-circle-outline' },
};

const peso = (n: number) => `₱${Number(n).toFixed(2)}`;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export const RidePaymentManagementScreen = () => {
  const navigation = useNavigation<any>();

  const [rows, setRows] = useState<RidePaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('pending');
  const [proof, setProof] = useState<string | undefined>();
  const [reviewing, setReviewing] = useState<string | undefined>();

  // ─── Load ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setRows(await service.listAll());
    } catch (error: any) {
      void notify('Could not load payments', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  // ─── Review action ─────────────────────────────────────────────
  const review = async (row: RidePaymentSubmission, decision: 'verified' | 'rejected') => {
    let reason: string | undefined;
    if (decision === 'rejected') {
      const okay = await confirm(
        'Reject payment proof?',
        'The passenger may replace the proof and submit again. Use this only when the screenshot or reference is invalid.',
        { confirmText: 'Reject', destructive: true }
      );
      if (!okay) return;
      reason = 'Payment proof or reference could not be validated';
    } else {
      const okay = await confirm(
        'Verify payment?',
        `Confirm receipt of ${peso(row.amount)} with reference ${row.payment_reference}.`,
        { confirmText: 'Verify Payment' }
      );
      if (!okay) return;
    }

    setReviewing(row.id);
    try {
      const updated = await service.review(row.id, decision, reason);
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...updated } : item)));
      await notify(
        decision === 'verified' ? 'Payment verified' : 'Payment rejected',
        decision === 'verified'
          ? 'The booking is now marked paid for the passenger, driver, and admin.'
          : 'The passenger can submit corrected proof.'
      );
    } catch (error: any) {
      await notify('Review failed', error?.message || 'This payment may already have been reviewed.');
    } finally {
      setReviewing(undefined);
    }
  };

  // ─── Derived data ──────────────────────────────────────────────
  const totalPending  = rows.filter((r) => r.status === 'pending').length;
  const totalVerified = rows.filter((r) => r.status === 'verified').length;
  const totalRejected = rows.filter((r) => r.status === 'rejected').length;
  const totalAmount   = rows
    .filter((r) => r.status === 'verified')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  // ─── Render ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Ride Payments</Text>
          <Text style={styles.headerSub}>Passenger proof & reference verification</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Summary Stats ── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="clock-alert-outline"
            label="Pending"
            value={totalPending}
            color={colors.warning}
            bg={colors.warningLight}
          />
          <StatCard
            icon="check-circle-outline"
            label="Verified"
            value={totalVerified}
            color={colors.success}
            bg={colors.successLight}
          />
          <StatCard
            icon="close-circle-outline"
            label="Rejected"
            value={totalRejected}
            color={colors.error}
            bg={colors.errorLight}
          />
        </View>

        {/* ── Total verified amount ── */}
        <Card variant="elevated" padding="md" style={styles.totalCard}>
          <View style={styles.totalRow}>
            <View style={styles.totalIcon}>
              <MaterialCommunityIcons name="cash-check" size={22} color={colors.primary} />
            </View>
            <View style={styles.totalCopy}>
              <Text style={styles.totalLabel}>TOTAL VERIFIED AMOUNT</Text>
              <Text style={[styles.totalAmount, typography.currency]}>{peso(totalAmount)}</Text>
            </View>
            <Text style={styles.totalCount}>{rows.length} submissions</Text>
          </View>
        </Card>

        {/* ── Filter chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            const count = key === 'all' ? rows.length : rows.filter((r) => r.status === key).length;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {label}
                </Text>
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Result count ── */}
        <Text style={styles.resultCount}>SHOWING {filtered.length} RECORDS</Text>

        {/* ── Cards ── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="receipt-text-clock-outline" size={52} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No {filter === 'all' ? '' : filter} payments</Text>
            <Text style={styles.emptyText}>
              Payment submissions will appear here after a passenger uploads proof.
            </Text>
          </View>
        ) : (
          filtered.map((row) => (
            <PaymentCard
              key={row.id}
              row={row}
              reviewing={reviewing}
              onViewProof={setProof}
              onReview={review}
            />
          ))
        )}
      </ScrollView>

      {/* ── Proof image modal ── */}
      <Modal
        visible={!!proof}
        transparent
        animationType="fade"
        onRequestClose={() => setProof(undefined)}
      >
        <View style={styles.imageOverlay}>
          <TouchableOpacity
            style={styles.imageClose}
            onPress={() => setProof(undefined)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {proof && (
            <Image source={{ uri: proof }} style={styles.proofImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = ({
  icon, label, value, color, bg,
}: {
  icon: string; label: string; value: number; color: string; bg: string;
}) => (
  <View style={[styles.statCard, { backgroundColor: bg }]}>
    <MaterialCommunityIcons name={icon as any} size={20} color={color} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={[styles.statLabel, { color }]}>{label}</Text>
  </View>
);

interface PaymentCardProps {
  row: RidePaymentSubmission;
  reviewing: string | undefined;
  onViewProof: (url: string) => void;
  onReview: (row: RidePaymentSubmission, decision: 'verified' | 'rejected') => void;
}

const PaymentCard = ({ row, reviewing, onViewProof, onReview }: PaymentCardProps) => {
  const meta = STATUS_META[row.status];
  return (
    <Card variant="elevated" padding="md" style={styles.card}>
      {/* ── Card header: names + status badge ── */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarBox}>
          <MaterialCommunityIcons name="account-cash-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.cardNames}>
          <Text style={styles.passengerName} numberOfLines={1}>
            {row.passenger_name || 'Passenger'}
          </Text>
          <Text style={styles.driverName} numberOfLines={1}>
            Driver: {row.driver_name || 'Driver'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <MaterialCommunityIcons name={meta.icon as any} size={12} color={meta.color} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
        </View>
      </View>

      {/* ── Amount + method ── */}
      <View style={styles.amountRow}>
        <Text style={[styles.amount, typography.currency]}>{peso(row.amount)}</Text>
        <View style={styles.methodBadge}>
          <MaterialCommunityIcons
            name={row.payment_details_snapshot?.method_type === 'gcash' ? 'cellphone' : 'bank-outline'}
            size={13}
            color={colors.textSecondary}
          />
          <Text style={styles.methodText} numberOfLines={1}>
            {row.payment_details_snapshot?.display_name || 'Online Payment'}
          </Text>
        </View>
      </View>

      {/* ── Reference ── */}
      <View style={styles.referenceBox}>
        <Text style={styles.referenceLabel}>REFERENCE NO.</Text>
        <Text selectable style={styles.referenceValue}>{row.payment_reference}</Text>
      </View>

      {/* ── Date + booking ID ── */}
      <View style={styles.metaRow}>
        <MaterialCommunityIcons name="calendar-outline" size={14} color={colors.textMuted} />
        <Text style={styles.metaText}>{formatDate(row.submitted_at)}</Text>
        <View style={styles.metaDot} />
        <MaterialCommunityIcons name="identifier" size={14} color={colors.textMuted} />
        <Text style={styles.metaText} numberOfLines={1}>
          {row.booking_id.slice(0, 8).toUpperCase()}
        </Text>
      </View>

      {/* ── Rejection reason ── */}
      {row.rejection_reason ? (
        <View style={styles.rejectionBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={15} color={colors.error} />
          <Text style={styles.rejectionText}>{row.rejection_reason}</Text>
        </View>
      ) : null}

      {/* ── Reviewed by info ── */}
      {row.reviewed_at && row.status !== 'pending' ? (
        <Text style={styles.reviewedAt}>
          {meta.label} on {formatDate(row.reviewed_at)}
        </Text>
      ) : null}

      {/* ── View proof button ── */}
      <TouchableOpacity
        style={styles.proofBtn}
        onPress={() => onViewProof(row.proof_url)}
        activeOpacity={0.75}
      >
        <MaterialCommunityIcons name="image-search-outline" size={18} color={colors.primary} />
        <Text style={styles.proofBtnText}>View payment screenshot</Text>
      </TouchableOpacity>

      {/* ── Verify / Reject actions (pending only) ── */}
      {row.status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => onReview(row, 'rejected')}
            disabled={!!reviewing}
            activeOpacity={0.8}
          >
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.verifyBtn, !!reviewing && { opacity: 0.7 }]}
            onPress={() => onReview(row, 'verified')}
            disabled={!!reviewing}
            activeOpacity={0.8}
          >
            {reviewing === row.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
                <Text style={styles.verifyBtnText}>Verify Payment</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    paddingRight: spacing.screen,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { ...typography.h2, fontSize: 22 },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 1 },

  // Scroll
  scrollContent: {
    paddingBottom: 100,
  },

  // Summary stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  statLabel: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Total verified card
  totalCard: {
    marginHorizontal: spacing.screen,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  totalIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCopy: { flex: 1 },
  totalLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  totalAmount: {
    ...typography.h2,
    fontSize: 22,
    color: colors.text,
    marginTop: 2,
  },
  totalCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
  },

  // Filter chips
  filterScroll: {
    marginTop: spacing.sm,
  },
  filterContent: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.label,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: { color: '#fff' },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipBadgeText: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  chipBadgeTextActive: { color: '#fff' },

  // Result count label
  resultCount: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  // Payment card
  card: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNames: { flex: 1, minWidth: 0 },
  passengerName: {
    ...typography.label,
    fontSize: 15,
    color: colors.text,
  },
  driverName: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  statusText: {
    ...typography.labelSmall,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Amount row
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  amount: {
    ...typography.h2,
    fontSize: 26,
    color: colors.primary,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    maxWidth: 160,
  },
  methodText: {
    ...typography.labelSmall,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Reference
  referenceBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  referenceLabel: {
    ...typography.labelSmall,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  referenceValue: {
    ...typography.label,
    fontSize: 14,
    color: colors.text,
    marginTop: 3,
  },

  // Meta row (date + booking ID)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.sm,
  },
  metaText: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textMuted,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
    marginHorizontal: 2,
  },

  // Rejection reason
  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rejectionText: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.error,
    lineHeight: 18,
  },

  // Reviewed at
  reviewedAt: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },

  // View proof button
  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.xs,
  },
  proofBtnText: {
    ...typography.label,
    fontSize: 13,
    color: colors.primary,
  },

  // Verify / Reject actions
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  rejectBtn: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: radius.md,
  },
  rejectBtnText: {
    ...typography.button,
    color: colors.error,
    fontSize: 13,
  },
  verifyBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  verifyBtnText: {
    ...typography.button,
    color: '#fff',
    fontSize: 13,
  },

  // States
  center: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.screen,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  // Proof image modal
  imageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  imageClose: {
    position: 'absolute',
    top: layout.headerTop,
    right: spacing.lg,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  proofImage: {
    width: '100%',
    height: '82%',
  },
});

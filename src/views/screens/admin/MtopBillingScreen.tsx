import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FranchiseService, MtopBillingRecord } from '@/models/services/FranchiseService';
import { ExportService } from '@/models/services/ExportService';
import { mtopBilledAt, mtopBillingState, mtopDueDate, mtopPaidMethodLabel } from '@/models/entities/Franchise';
import { notify } from '@/utils/confirm';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

const service = new FranchiseService();

/** Unpaid billings past their due date (30 days after billing) are overdue. */
const OVERDUE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type BillingState = 'to_bill' | 'unpaid' | 'for_verification' | 'paid';
type Filter = 'all' | BillingState | 'overdue';
type Period = 'all' | 'month' | 'year';

const STATE_META: Record<BillingState, { label: string; color: string; bg: string; icon: string }> = {
  to_bill:          { label: 'To bill',          color: colors.textSecondary, bg: colors.surfaceAlt,   icon: 'file-send-outline' },
  unpaid:           { label: 'Unpaid',           color: colors.warning,       bg: colors.warningLight, icon: 'cash-clock' },
  for_verification: { label: 'For verification', color: colors.primary,       bg: colors.primaryLight, icon: 'clock-alert-outline' },
  paid:             { label: 'Paid',             color: colors.success,       bg: colors.successLight, icon: 'check-circle-outline' },
};

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'to_bill', label: 'To bill' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'for_verification', label: 'For verification' },
  { key: 'paid', label: 'Paid' },
];

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'all', label: 'All time' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
];

interface BillingRow extends MtopBillingRecord {
  state: BillingState;
  /** When the billing went out; updated_at stands in for rows before migration 085. */
  billedAt: string | null;
  overdue: boolean;
  daysOutstanding: number;
  /** Paid date for paid rows, otherwise the billing (or filing) date. */
  recordDate: string;
  /** YYYY-MM-DD: the statement's due date (086), else 30 days after billing. */
  dueDate: string | null;
  /** Date the fee was paid: the recorded date (086), else the verification date. */
  paidOn: string | null;
  /** Amount collected: the recorded amount (086), else the fee. */
  collected: number;
  methodLabel: string | null;
}

const toRow = (row: MtopBillingRecord, now: number): BillingRow => {
  const full = row as unknown as Parameters<typeof mtopBillingState>[0];
  const billingState = mtopBillingState(full);
  // Overdue is shown as a flag on an unpaid row, not as its own state.
  const state: BillingState = billingState === 'overdue' ? 'unpaid' : billingState;
  const billedAt = mtopBilledAt(full);
  const daysOutstanding = state === 'unpaid' && billedAt
    ? Math.floor((now - new Date(billedAt).getTime()) / DAY_MS)
    : 0;
  const paidOn = row.payment_paid_on ?? row.payment_verified_at;
  return {
    ...row,
    state,
    billedAt,
    overdue: billingState === 'overdue',
    daysOutstanding,
    recordDate: (state === 'paid' ? paidOn : billedAt) ?? row.created_at,
    dueDate: billedAt ? mtopDueDate(full) : null,
    paidOn,
    collected: row.payment_amount ?? row.fees,
    methodLabel: mtopPaidMethodLabel({
      payment_method: row.payment_method,
      chosen_payment_method_snapshot: row.paid_method ? ({ display_name: row.paid_method } as any) : null,
      appointment_date: row.appointment_date,
    }),
  };
};

const peso = (n: number) => `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (iso?: string | null) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

const inPeriod = (iso: string, period: Period) => {
  if (period === 'all') return true;
  const date = new Date(iso);
  const now = new Date();
  if (date.getFullYear() !== now.getFullYear()) return false;
  return period === 'year' || date.getMonth() === now.getMonth();
};

export const MtopBillingScreen = () => {
  const navigation = useNavigation<any>();
  const [records, setRecords] = useState<MtopBillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [toda, setToda] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setRecords(await service.getBillingRecords());
    } catch (error: any) {
      void notify('Could not load billing', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const rows = useMemo(() => {
    const now = Date.now();
    return records.map((row) => toRow(row, now));
  }, [records]);

  const todas = useMemo(
    () => Array.from(new Set(rows.map((row) => row.toda).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  // TODA + period narrow everything on screen, including the totals.
  const scoped = useMemo(
    () => rows.filter((row) => (toda === 'all' || row.toda === toda) && inPeriod(row.recordDate, period)),
    [rows, toda, period]
  );

  const matches = (row: BillingRow, key: Filter) =>
    key === 'all' ? true : key === 'overdue' ? row.overdue : row.state === key;

  const filtered = useMemo(() => scoped.filter((row) => matches(row, filter)), [scoped, filter]);

  const collected = scoped.filter((r) => r.state === 'paid').reduce((sum, r) => sum + r.collected, 0);
  const outstanding = scoped
    .filter((r) => r.state === 'unpaid' || r.state === 'for_verification')
    .reduce((sum, r) => sum + r.fees, 0);
  const overdueCount = scoped.filter((r) => r.overdue).length;

  const exportCsv = async () => {
    setExporting(true);
    try {
      await ExportService.exportRowsToCSV(
        filtered.map((row) => ({
          Driver: row.driver_name,
          TODA: row.toda,
          'MTOP No.': row.mtop_number ?? '',
          Plate: row.plate_number,
          Type: row.type === 'renewal' ? 'Renewal' : 'New',
          'Statement no.': row.billing_statement_no ?? '',
          Amount: row.fees.toFixed(2),
          Status: row.overdue ? 'Overdue' : STATE_META[row.state].label,
          'Billed on': row.billedAt ? row.billedAt.slice(0, 10) : '',
          'Due on': row.dueDate ?? '',
          'Paid on': row.state === 'paid' && row.paidOn ? row.paidOn.slice(0, 10) : '',
          'Amount paid': row.state === 'paid' ? row.collected.toFixed(2) : '',
          Method: row.state === 'paid' || row.state === 'for_verification' ? row.methodLabel ?? '' : '',
          'OR / reference no.': row.payment_reference ?? '',
        })),
        'mtop_billing'
      );
    } catch (error: any) {
      await notify('Export failed', error?.message || 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7} accessibilityLabel="Go back">
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>MTOP Billing & Payments</Text>
          <Text style={styles.headerSub}>Fees billed, collected, and overdue</Text>
        </View>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={exportCsv}
          disabled={exporting || filtered.length === 0}
          activeOpacity={0.75}
          accessibilityLabel="Export to CSV"
        >
          {exporting
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <MaterialCommunityIcons name="tray-arrow-down" size={22} color={filtered.length ? colors.primary : colors.textLight} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />
        }
      >
        {/* ── Totals ── */}
        <View style={styles.statsRow}>
          <Card variant="elevated" padding="md" style={styles.totalCard}>
            <Text style={styles.totalLabel}>COLLECTED</Text>
            <Text style={[styles.totalAmount, typography.currency, { color: colors.success }]}>{peso(collected)}</Text>
          </Card>
          <Card variant="elevated" padding="md" style={styles.totalCard}>
            <Text style={styles.totalLabel}>OUTSTANDING</Text>
            <Text style={[styles.totalAmount, typography.currency, { color: colors.warning }]}>{peso(outstanding)}</Text>
          </Card>
        </View>
        {overdueCount > 0 ? (
          <TouchableOpacity style={styles.overdueBanner} onPress={() => setFilter('overdue')} activeOpacity={0.8}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.overdueText}>
              {overdueCount} billing{overdueCount === 1 ? ' is' : 's are'} past the due date ({OVERDUE_AFTER_DAYS} days)
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.error} />
          </TouchableOpacity>
        ) : null}

        {/* ── Status filter ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent} style={styles.filterScroll}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            const count = scoped.filter((row) => matches(row, key)).length;
            const alert = key === 'overdue' && count > 0;
            return (
              <TouchableOpacity key={key} style={[styles.chip, active && styles.chipActive]} onPress={() => setFilter(key)} activeOpacity={0.75}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                <View style={[styles.chipBadge, active && styles.chipBadgeActive, alert && !active && styles.chipBadgeAlert]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive, alert && !active && { color: '#fff' }]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Period + TODA ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent} style={styles.filterScroll}>
          {PERIODS.map(({ key, label }) => (
            <TouchableOpacity key={key} style={[styles.chipSmall, period === key && styles.chipActive]} onPress={() => setPeriod(key)} activeOpacity={0.75}>
              <Text style={[styles.chipSmallText, period === key && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.chipDivider} />
          {['all', ...todas].map((name) => (
            <TouchableOpacity key={name} style={[styles.chipSmall, toda === name && styles.chipActive]} onPress={() => setToda(name)} activeOpacity={0.75}>
              <Text style={[styles.chipSmallText, toda === name && styles.chipTextActive]}>{name === 'all' ? 'All TODAs' : name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.resultCount}>SHOWING {filtered.length} RECORDS</Text>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="receipt-text-clock-outline" size={52} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No billing records</Text>
            <Text style={styles.emptyText}>MTOP fees appear here once an application reaches the payment step.</Text>
          </View>
        ) : (
          filtered.map((row) => {
            const meta = row.overdue
              ? { label: 'Overdue', color: colors.error, bg: colors.errorLight, icon: 'cash-remove' }
              : STATE_META[row.state];
            return (
              <Card key={row.id} variant="elevated" padding="md" style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardNames}>
                    <Text style={styles.driverName} numberOfLines={1}>{row.driver_name}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {row.toda} · {row.type === 'renewal' ? 'Renewal' : 'New MTOP'}{row.mtop_number ? ` · ${row.mtop_number}` : ''}{row.billing_statement_no ? ` · ${row.billing_statement_no}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <MaterialCommunityIcons name={meta.icon as any} size={12} color={meta.color} />
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={[styles.amount, typography.currency]}>{peso(row.fees)}</Text>

                <View style={styles.detailGrid}>
                  <Detail label="BILLED" value={row.billedAt ? shortDate(row.billedAt) : 'Not yet'} />
                  <Detail
                    label={row.state === 'paid' ? 'PAID ON' : 'DUE'}
                    value={row.state === 'paid'
                      ? shortDate(row.paidOn)
                      : row.dueDate ? `${shortDate(row.dueDate)}${row.state === 'unpaid' ? ` · ${row.daysOutstanding}d` : ''}` : '—'}
                    alert={row.overdue}
                  />
                  <Detail label="METHOD" value={(row.state === 'paid' || row.state === 'for_verification' ? row.methodLabel : null) ?? '—'} />
                  <Detail label="OR / REFERENCE NO." value={row.payment_reference || '—'} />
                </View>

                {row.payment_review_status === 'rejected' && row.payment_rejection_reason && row.state === 'unpaid' ? (
                  <View style={styles.rejectionBox}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={15} color={colors.error} />
                    <Text style={styles.rejectionText}>Proof rejected: {row.payment_rejection_reason}</Text>
                  </View>
                ) : null}

                {row.state !== 'paid' ? (
                  <TouchableOpacity
                    style={styles.openBtn}
                    onPress={() => navigation.navigate('AdminMain', { screen: 'MTOP' })}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name="open-in-new" size={16} color={colors.primary} />
                    <Text style={styles.openBtnText}>
                      {row.state === 'to_bill'
                        ? 'Send billing in MTOP Management'
                        : row.state === 'for_verification'
                        ? 'Verify payment in MTOP Management'
                        : 'Record payment in MTOP Management'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const Detail = ({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) => (
  <View style={styles.detail}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, alert && { color: colors.error }]} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    paddingRight: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { ...typography.h2, fontSize: 22 },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 1 },
  exportBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 100 },
  center: { paddingVertical: spacing.xxl, alignItems: 'center' },

  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.screen, paddingTop: spacing.lg },
  totalCard: { flex: 1 },
  totalLabel: { ...typography.labelSmall, color: colors.textMuted, fontSize: 9, letterSpacing: 1.5 },
  totalAmount: { ...typography.h2, fontSize: 20, marginTop: 2 },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    padding: spacing.md,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
  },
  overdueText: { ...typography.label, fontSize: 13, color: colors.error, flex: 1 },

  filterScroll: { marginTop: spacing.md },
  filterContent: { paddingHorizontal: spacing.screen, gap: spacing.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
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
  chipBadgeAlert: { backgroundColor: colors.error },
  chipBadgeText: { ...typography.labelSmall, fontSize: 10, fontWeight: '800', color: colors.textSecondary },
  chipBadgeTextActive: { color: '#fff' },
  chipSmall: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSmallText: { ...typography.labelSmall, fontSize: 12, color: colors.textSecondary },
  chipDivider: { width: 1, height: 20, backgroundColor: colors.border },

  resultCount: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  card: { marginHorizontal: spacing.screen, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardNames: { flex: 1, minWidth: 0 },
  driverName: { ...typography.label, fontSize: 15, color: colors.text },
  cardSub: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm },
  statusText: { ...typography.labelSmall, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  amount: { ...typography.h2, fontSize: 22, color: colors.text, marginTop: spacing.sm },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    rowGap: spacing.sm,
  },
  detail: { width: '50%', paddingRight: spacing.sm },
  detailLabel: { ...typography.labelSmall, fontSize: 9, color: colors.textMuted, letterSpacing: 0.8 },
  detailValue: { ...typography.label, fontSize: 12, color: colors.text, marginTop: 2 },
  rejectionBox: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.errorLight,
  },
  rejectionText: { ...typography.bodySmall, fontSize: 12, color: colors.error, flex: 1 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginTop: spacing.sm },
  openBtnText: { ...typography.label, fontSize: 13, color: colors.primary },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.screen },
  emptyTitle: { ...typography.h3, marginTop: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
});

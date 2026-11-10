/**
 * RevenueDetailsScreen (B8)
 *
 * Every peso the office has collected, one row per paid MTOP fee, labeled
 * with what it was for (MTOP Registration, MTOP Renewal). Opened from the
 * Command Center "Total Revenue" card and the MTOP Income graph.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  MTOP_REVENUE_PURPOSE_LABEL,
  MtopRevenueItem,
  MtopRevenuePurpose,
  MtopRevenueService,
} from '@/models/services/MtopRevenueService';
import { ExportService } from '@/models/services/ExportService';
import { incomeDayKey } from '@/utils/incomeUtils';
import { phtDayKey } from '@/utils/dateUtils';
import { notify } from '@/utils/confirm';
import { Card } from '@/views/components/common/Card';
import { IncomeChart } from '@/views/components/common/IncomeChart';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

type Period = 'all' | 'today' | 'month' | 'year';

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
];

const PURPOSE_META: Record<MtopRevenuePurpose, { icon: string; color: string; bg: string }> = {
  new: { icon: 'file-certificate-outline', color: colors.primary, bg: colors.primaryLight },
  renewal: { icon: 'autorenew', color: colors.success, bg: colors.successLight },
};

const peso = (n: number) =>
  `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Nov 11, 2026" from the Manila calendar date of the payment. */
const paidDate = (at: string) => {
  const key = incomeDayKey(at);
  return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}, ${key.slice(0, 4)}`;
};

const inPeriod = (at: string, period: Period, today: string) => {
  const key = incomeDayKey(at);
  if (period === 'today') return key === today;
  if (period === 'month') return key.slice(0, 7) === today.slice(0, 7);
  if (period === 'year') return key.slice(0, 4) === today.slice(0, 4);
  return true;
};

export const RevenueDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [items, setItems] = useState<MtopRevenueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('all');
  const [purpose, setPurpose] = useState<'all' | MtopRevenuePurpose>('all');
  const [toda, setToda] = useState<string>(route.params?.toda ?? 'all');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await MtopRevenueService.getRevenue());
    } catch (error: any) {
      void notify('Could not load revenue', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const todas = useMemo(
    () => Array.from(new Set(items.map((i) => i.toda))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  // Period + TODA narrow the totals; the purpose chips show their own share.
  const scoped = useMemo(() => {
    const today = phtDayKey(new Date());
    return items.filter((i) => (toda === 'all' || i.toda === toda) && inPeriod(i.at, period, today));
  }, [items, toda, period]);
  const shown = useMemo(
    () => (purpose === 'all' ? scoped : scoped.filter((i) => i.purpose === purpose)),
    [scoped, purpose]
  );

  // The graph keeps the TODA + purpose filters but shows its own periods.
  const chartItems = useMemo(
    () => items.filter((i) => (toda === 'all' || i.toda === toda) && (purpose === 'all' || i.purpose === purpose)),
    [items, toda, purpose]
  );

  const total = MtopRevenueService.total(shown);
  const byPurpose = (key: MtopRevenuePurpose) => scoped.filter((i) => i.purpose === key);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await ExportService.exportRowsToCSV(
        shown.map((i) => ({
          'Paid on': incomeDayKey(i.at),
          'Revenue from': i.purposeLabel,
          Amount: i.amount.toFixed(2),
          Driver: i.driverName,
          TODA: i.toda,
          'MTOP No.': i.mtopNumber ?? '',
          Plate: i.plateNumber,
          'Statement no.': i.statementNo ?? '',
          Method: i.method ?? '',
          'OR / reference no.': i.reference ?? '',
        })),
        'mtop_revenue'
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
          <Text style={styles.headerTitle}>Revenue</Text>
          <Text style={styles.headerSub}>Every MTOP fee collected by the office</Text>
        </View>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={exportCsv}
          disabled={exporting || shown.length === 0}
          activeOpacity={0.75}
          accessibilityLabel="Export to CSV"
        >
          {exporting
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <MaterialCommunityIcons name="tray-arrow-down" size={22} color={shown.length ? colors.primary : colors.textLight} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />
        }
      >
        {/* ── Filters: period on one row, TODA on its own row ── */}
        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            {PERIODS.map(({ key, label }) => (
              <TouchableOpacity key={key} style={[styles.chip, period === key && styles.chipActive]} onPress={() => setPeriod(key)} activeOpacity={0.75}>
                <Text style={[styles.chipText, period === key && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {todas.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent} style={styles.filterRow2}>
              {['all', ...todas].map((name) => (
                <TouchableOpacity key={name} style={[styles.chip, styles.chipOutline, toda === name && styles.chipOutlineActive]} onPress={() => setToda(name)} activeOpacity={0.75}>
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={13}
                    color={toda === name ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.chipText, toda === name && styles.chipOutlineTextActive]}>{name === 'all' ? 'All TODAs' : name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {/* ── Total + split by purpose ── */}
        <Card variant="elevated" padding="md" style={styles.block}>
          <View style={styles.totalRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.totalLabel} numberOfLines={1}>
                {purpose === 'all' ? 'TOTAL REVENUE' : MTOP_REVENUE_PURPOSE_LABEL[purpose].toUpperCase()}
                {' · '}{PERIODS.find((p) => p.key === period)?.label.toUpperCase()}
              </Text>
              <Text style={[styles.totalAmount, typography.currency]}>{peso(total)}</Text>
            </View>
            <Text style={styles.totalCount}>{shown.length} payment{shown.length === 1 ? '' : 's'}</Text>
          </View>

          <View style={styles.splitRow}>
            {(['new', 'renewal'] as MtopRevenuePurpose[]).map((key) => {
              const rows = byPurpose(key);
              const active = purpose === key;
              const meta = PURPOSE_META[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.split, active && { borderColor: meta.color, backgroundColor: meta.bg }]}
                  onPress={() => setPurpose(active ? 'all' : key)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <MaterialCommunityIcons name={meta.icon as any} size={15} color={meta.color} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.splitLabel, { color: meta.color }]} numberOfLines={1}>{MTOP_REVENUE_PURPOSE_LABEL[key]}</Text>
                    <Text style={styles.splitAmount} numberOfLines={1}>{peso(MtopRevenueService.total(rows))} · {rows.length}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* ── Graph (TODA + purpose; its own daily / monthly / yearly) ── */}
        <IncomeChart entries={chartItems} countNoun="payment" accent={colors.success} compact style={styles.block} />

        <Text style={styles.resultCount}>SHOWING {shown.length} RECORDS</Text>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="cash-remove" size={44} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No revenue here</Text>
            <Text style={styles.emptyText}>Paid MTOP fees show up here once the payment is recorded or verified.</Text>
          </View>
        ) : (
          <Card variant="elevated" padding="none" style={styles.block}>
            {shown.map((item, i) => {
              const meta = PURPOSE_META[item.purpose];
              const extra = [item.method, item.reference ? `OR ${item.reference}` : null, item.statementNo].filter(Boolean).join(' · ');
              return (
                <View key={item.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <View style={[styles.rowIcon, { backgroundColor: meta.bg }]}>
                    <MaterialCommunityIcons name={meta.icon as any} size={16} color={meta.color} />
                  </View>
                  <View style={styles.rowCopy}>
                    <View style={styles.rowTop}>
                      <Text style={[styles.rowPurpose, { color: meta.color }]} numberOfLines={1}>{item.purposeLabel}</Text>
                      <Text style={[styles.rowAmount, typography.currency]}>+{peso(item.amount)}</Text>
                    </View>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.driverName}</Text>
                      <Text style={styles.rowDate}>{paidDate(item.at)}</Text>
                    </View>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[item.toda, item.mtopNumber, item.plateNumber].filter(Boolean).join(' · ')}
                    </Text>
                    {extra ? <Text style={styles.rowExtra} numberOfLines={1}>{extra}</Text> : null}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

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

  block: { marginHorizontal: spacing.screen, marginTop: spacing.sm },

  filters: { paddingTop: spacing.md, paddingBottom: spacing.xs },
  filterContent: { paddingHorizontal: spacing.screen, gap: spacing.sm, alignItems: 'center' },
  filterRow2: { marginTop: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.labelSmall, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  // TODA chips read as a second, lighter filter so they don't blend with the period.
  chipOutline: { backgroundColor: colors.surfaceAlt, borderColor: colors.surfaceAlt },
  chipOutlineActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipOutlineTextActive: { color: colors.primary },

  totalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  totalLabel: { ...typography.labelSmall, color: colors.textMuted, fontSize: 10, letterSpacing: 1.2 },
  totalAmount: { ...typography.h2, fontSize: 24, color: colors.success, marginTop: 2 },
  totalCount: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  splitRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  split: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  splitLabel: { ...typography.labelSmall, fontSize: 11, fontWeight: '700' },
  splitAmount: { ...typography.label, fontSize: 12, color: colors.text },

  resultCount: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
  },

  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowPurpose: { ...typography.labelSmall, fontSize: 11, fontWeight: '800', letterSpacing: 0.3, flexShrink: 1 },
  rowAmount: { ...typography.label, fontSize: 14, color: colors.success },
  rowName: { ...typography.label, fontSize: 14, color: colors.text, flexShrink: 1 },
  rowDate: { ...typography.bodySmall, fontSize: 11, color: colors.textSecondary },
  rowMeta: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  rowExtra: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.screen },
  emptyTitle: { ...typography.h3, marginTop: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
});

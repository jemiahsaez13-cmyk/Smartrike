/**
 * MtopIncomePanel (B8)
 *
 * MTOP fee collections for the admin's MTOP tab: daily / monthly / yearly
 * income graph, narrowed by TODA, with the selected period split by TODA and
 * by purpose (registration vs renewal). Only paid fees count as income.
 * "Details" opens the full list (RevenueDetails).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MtopRevenueItem, MtopRevenueService } from '@/models/services/MtopRevenueService';
import { IncomeBreakdownRow, IncomeChart } from '@/views/components/common/IncomeChart';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const groupBy = (entries: MtopRevenueItem[], key: (e: MtopRevenueItem) => string): IncomeBreakdownRow[] => {
  const map = new Map<string, IncomeBreakdownRow>();
  for (const entry of entries) {
    const label = key(entry);
    const row = map.get(label) ?? { label, amount: 0, count: 0 };
    row.amount += entry.amount;
    row.count += 1;
    map.set(label, row);
  }
  return Array.from(map.values());
};

interface Props {
  /** Reload trigger: changes whenever the application list changes. */
  refreshKey?: unknown;
}

export const MtopIncomePanel = ({ refreshKey }: Props) => {
  const navigation = useNavigation<any>();
  const [entries, setEntries] = useState<MtopRevenueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toda, setToda] = useState('all');

  const load = useCallback(async () => {
    try {
      setEntries(await MtopRevenueService.getRevenue());
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load MTOP income.');
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const todas = useMemo(
    () => Array.from(new Set((entries ?? []).map((e) => e.toda))).sort((a, b) => a.localeCompare(b)),
    [entries]
  );
  const scoped = useMemo(
    () => (toda === 'all' ? entries ?? [] : (entries ?? []).filter((e) => e.toda === toda)),
    [entries, toda]
  );

  const breakdown = useCallback(
    (period: MtopRevenueItem[]) =>
      // All TODAs: which TODA the money came from. One TODA: new vs renewal.
      toda === 'all' ? groupBy(period, (e) => e.toda) : groupBy(period, (e) => e.purposeLabel),
    [toda]
  );

  if (entries === null && !error) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <View>
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <MaterialCommunityIcons name="chart-bar" size={16} color={colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>MTOP Income</Text>
          <Text style={styles.subtitle}>Paid MTOP fees, by the date they were paid</Text>
        </View>
        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() => navigation.navigate('RevenueDetails', toda === 'all' ? undefined : { toda })}
          activeOpacity={0.75}
          accessibilityLabel="See every revenue record"
        >
          <Text style={styles.detailsBtnText}>Details</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {error ? (
        <TouchableOpacity style={styles.errorBox} onPress={() => void load()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error} Tap to retry.</Text>
        </TouchableOpacity>
      ) : null}

      {todas.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.todaRow} style={styles.todaScroll}>
          {['all', ...todas].map((name) => {
            const active = toda === name;
            return (
              <TouchableOpacity key={name} style={[styles.todaChip, active && styles.todaChipActive]} onPress={() => setToda(name)} activeOpacity={0.75}>
                <Text style={[styles.todaChipText, active && styles.todaChipTextActive]}>{name === 'all' ? 'All TODAs' : name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <IncomeChart
        entries={scoped}
        countNoun="payment"
        accent={colors.success}
        breakdown={breakdown}
        breakdownTitle={toda === 'all' ? 'BY TODA' : 'BY PURPOSE'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xxl, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  titleIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.label, fontSize: 15, color: colors.text },
  subtitle: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: spacing.sm },
  detailsBtnText: { ...typography.label, fontSize: 13, color: colors.primary },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
  },
  errorText: { ...typography.bodySmall, fontSize: 12, color: colors.error, flex: 1 },
  todaScroll: { marginBottom: spacing.sm, marginHorizontal: -spacing.md },
  todaRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  todaChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todaChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  todaChipText: { ...typography.labelSmall, fontSize: 12, color: colors.textSecondary },
  todaChipTextActive: { color: '#fff' },
});

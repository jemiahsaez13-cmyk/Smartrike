import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  InventoryCategory,
  ManagementReportDataset,
  ManagementReportFilters,
  ManagementReportType,
} from '@/models/entities/Association';
import { FranchiseRecordStatus, FRANCHISE_RECORD_STATUS_LABEL } from '@/models/entities/Franchise';
import { ManagementReportService } from '@/models/services/ManagementReportService';
import { ExportService } from '@/models/services/ExportService';
import { notify } from '@/utils/confirm';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const service = new ManagementReportService();
const REPORTS: Array<{ key: ManagementReportType; label: string; icon: string }> = [
  { key: 'franchise_status', label: 'Status', icon: 'chart-box-outline' },
  { key: 'active_franchises', label: 'Active', icon: 'shield-check-outline' },
  { key: 'renewals', label: 'Renewals', icon: 'calendar-refresh' },
  { key: 'transfers', label: 'Transfers', icon: 'account-switch-outline' },
  { key: 'terminations', label: 'Terminations', icon: 'file-cancel-outline' },
  { key: 'violations', label: 'Violations', icon: 'alert-outline' },
  { key: 'inventory', label: 'Inventory', icon: 'package-variant-closed' },
];
const STATUSES: Array<FranchiseRecordStatus | 'all'> = ['all', 'active', 'expired', 'pending_renewal', 'terminated', 'transferred'];
const CATEGORIES: Array<InventoryCategory | 'all'> = ['all', 'supplies', 'equipment', 'safety', 'office', 'other'];

const initialFilters: ManagementReportFilters = {
  type: 'franchise_status',
  category: 'all',
  franchiseStatus: 'all',
};

const pretty = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const ManagementReportsScreen = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [filters, setFilters] = useState<ManagementReportFilters>(initialFilters);
  const [dataset, setDataset] = useState<ManagementReportDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const generate = useCallback(async (next = filters) => {
    try {
      setDataset(await service.generate(next));
    } catch (error: any) {
      console.error('Report generation failed:', error);
      await notify('Report unavailable', error?.message || 'Could not load the requested records. Check that migration 035 is applied.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => { generate(initialFilters); }, []);

  const chooseType = (type: ManagementReportType) => {
    const next = { ...filters, type };
    setFilters(next);
    setLoading(true);
    generate(next);
  };

  const exportReport = async () => {
    if (!dataset?.rows.length) {
      await notify('Nothing to export', 'Generate a report with at least one record first.');
      return;
    }
    setExporting(true);
    try {
      await ExportService.exportRowsToCSV(
        dataset.rows.map((row) => ({
          record: row.title,
          summary: row.subtitle,
          status: row.status,
          date: row.date,
          category: row.category || '',
          details: row.details || '',
        })),
        filters.type
      );
    } catch (error: any) {
      await notify('Export failed', error?.message || 'Unable to create the CSV report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Management Reports</Text>
          <Text style={styles.subtitle}>Date-filtered TODA records and CSV exports</Text>
        </View>
        <TouchableOpacity style={[styles.exportBtn, exporting && { opacity: 0.5 }]} onPress={exportReport} disabled={exporting} accessibilityLabel="Export report to CSV">
          {exporting ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="download" size={21} color="#fff" />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); generate(); }} tintColor={colors.primary} />}
      >
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <MaterialCommunityIcons name="shield-check" size={22} color="#fff" />
            <Text style={styles.kpiValue}>{dataset?.activeFranchises ?? '—'}</Text>
            <Text style={styles.kpiLabel}>Active franchises</Text>
          </View>
          <View style={styles.kpiCard}>
            <MaterialCommunityIcons name="calendar-refresh" size={22} color="#fff" />
            <Text style={styles.kpiValue}>{dataset?.renewedThisYear ?? '—'}</Text>
            <Text style={styles.kpiLabel}>Renewed this year</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>REPORT TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {REPORTS.map((report) => (
            <TouchableOpacity key={report.key} style={[styles.typeChip, filters.type === report.key && styles.typeChipActive]} onPress={() => chooseType(report.key)} activeOpacity={0.76}>
              <MaterialCommunityIcons name={report.icon as any} size={17} color={filters.type === report.key ? '#fff' : colors.primary} />
              <Text style={[styles.typeText, filters.type === report.key && styles.typeTextActive]}>{report.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Report filters</Text>
          <View style={[styles.dateRow, compact && styles.dateRowCompact]}>
            <DateField compact={compact} label="From" value={filters.dateFrom || ''} onChangeText={(dateFrom) => setFilters((value) => ({ ...value, dateFrom }))} />
            <DateField compact={compact} label="To" value={filters.dateTo || ''} onChangeText={(dateTo) => setFilters((value) => ({ ...value, dateTo }))} />
          </View>

          {filters.type === 'franchise_status' ? (
            <>
              <Text style={styles.fieldLabel}>Franchise status</Text>
              <View style={styles.optionWrap}>
                {STATUSES.map((status) => (
                  <Choice key={status} label={status === 'all' ? 'All statuses' : FRANCHISE_RECORD_STATUS_LABEL[status]} active={filters.franchiseStatus === status} onPress={() => setFilters((value) => ({ ...value, franchiseStatus: status }))} />
                ))}
              </View>
            </>
          ) : null}

          {filters.type === 'inventory' ? (
            <>
              <Text style={styles.fieldLabel}>Inventory category</Text>
              <View style={styles.optionWrap}>
                {CATEGORIES.map((category) => (
                  <Choice key={category} label={category === 'all' ? 'All categories' : pretty(category)} active={filters.category === category} onPress={() => setFilters((value) => ({ ...value, category }))} />
                ))}
              </View>
            </>
          ) : null}

          <TouchableOpacity style={styles.generateBtn} onPress={() => { setLoading(true); generate(); }} activeOpacity={0.82} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <><MaterialCommunityIcons name="file-chart-outline" size={20} color="#fff" /><Text style={styles.generateText}>Generate report</Text></>}
          </TouchableOpacity>
        </View>

        {filters.type === 'franchise_status' && dataset ? (
          <View style={styles.statusGrid} accessibilityLabel="Franchise status totals">
            {STATUSES.filter((status): status is FranchiseRecordStatus => status !== 'all').map((status) => (
              <View key={status} style={[styles.statusCount, compact && styles.statusCountCompact]}>
                <Text style={styles.statusNumber}>{dataset.statusCounts[status]}</Text>
                <Text style={styles.statusLabel}>{FRANCHISE_RECORD_STATUS_LABEL[status]}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.resultsHeader}>
          <View>
            <Text style={styles.resultsTitle}>{dataset?.title || 'Report results'}</Text>
            <Text style={styles.resultsCount}>{dataset?.rows.length ?? 0} record{dataset?.rows.length === 1 ? '' : 's'}</Text>
          </View>
          <MaterialCommunityIcons name="table" size={22} color={colors.textMuted} />
        </View>

        {loading && !dataset ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
        {!loading && dataset?.rows.map((row) => (
          <View key={row.id} style={styles.resultCard}>
            <View style={styles.resultTop}>
              <Text style={styles.resultTitle} numberOfLines={1}>{row.title}</Text>
              <View style={styles.resultStatus}><Text style={styles.resultStatusText}>{pretty(row.status)}</Text></View>
            </View>
            <Text style={styles.resultSubtitle}>{row.subtitle}</Text>
            {row.details ? <Text style={styles.resultDetails}>{row.details}</Text> : null}
            <View style={styles.resultFooter}>
              {row.category ? <Text style={styles.resultCategory}>{pretty(row.category)}</Text> : <View />}
              <Text style={styles.resultDate}>{new Date(row.date).toLocaleDateString()}</Text>
            </View>
          </View>
        ))}

        {!loading && dataset?.rows.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="file-search-outline" size={44} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No matching records</Text>
            <Text style={styles.emptyText}>Adjust the dates or filters, then generate again.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const DateField = ({ label, value, onChangeText, compact }: { label: string; value: string; onChangeText: (value: string) => void; compact?: boolean }) => (
  <View style={compact ? { width: '100%' } : { flex: 1 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.dateInput} autoCapitalize="none" />
  </View>
);

const Choice = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[styles.choice, active && styles.choiceActive]} onPress={onPress} activeOpacity={0.76}>
    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: layout.headerTop, paddingBottom: spacing.md, paddingHorizontal: spacing.sm, paddingRight: spacing.screen, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { ...typography.h2, fontSize: 22 },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  exportBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.screen, paddingBottom: layout.contentBottom },
  kpiRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  kpiCard: { flex: 1, minHeight: 124, backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, justifyContent: 'center' },
  kpiValue: { ...typography.h1, color: '#fff', fontSize: 30, marginTop: spacing.sm },
  kpiLabel: { ...typography.bodySmall, color: 'rgba(255,255,255,0.82)' },
  sectionLabel: { ...typography.labelSmall, color: colors.textMuted, fontSize: 10, letterSpacing: 1.3, marginBottom: spacing.sm },
  typeRow: { gap: spacing.sm, paddingBottom: spacing.lg },
  typeChip: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { ...typography.label, color: colors.primary, fontSize: 13 },
  typeTextActive: { color: '#fff' },
  filterCard: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, marginBottom: spacing.lg, ...shadows.sm },
  filterTitle: { ...typography.h3, marginBottom: spacing.md },
  dateRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  dateRowCompact: { flexDirection: 'column', gap: spacing.sm },
  fieldLabel: { ...typography.labelSmall, color: colors.textSecondary, marginBottom: spacing.sm },
  dateInput: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, ...typography.body, color: colors.text },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  choice: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, justifyContent: 'center' },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { ...typography.labelSmall, color: colors.textSecondary },
  choiceTextActive: { color: '#fff' },
  generateBtn: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  generateText: { ...typography.button, color: '#fff' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statusCount: { width: '31%', minHeight: 76, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.sm, justifyContent: 'center' },
  statusCountCompact: { width: '47%', flexGrow: 1 },
  statusNumber: { ...typography.number, fontSize: 22, color: colors.primary },
  statusLabel: { ...typography.bodySmall, fontSize: 10, color: colors.textSecondary },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  resultsTitle: { ...typography.h3 },
  resultsCount: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },
  resultCard: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, marginBottom: spacing.md },
  resultTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultTitle: { ...typography.h3, fontSize: 15, flex: 1 },
  resultStatus: { minHeight: 28, borderRadius: radius.pill, paddingHorizontal: 9, justifyContent: 'center', backgroundColor: colors.primaryLight },
  resultStatusText: { ...typography.labelSmall, fontSize: 10, color: colors.primary },
  resultSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  resultDetails: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.xs },
  resultFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  resultCategory: { ...typography.labelSmall, color: colors.primary },
  resultDate: { ...typography.bodySmall, color: colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.h3, marginTop: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
});

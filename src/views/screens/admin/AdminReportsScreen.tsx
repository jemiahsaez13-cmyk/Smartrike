import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ReportService, ReportRow, ReportStatus } from '@/models/services/ReportService';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';
import { confirm, notify } from '@/utils/confirm';
import { formatDate } from '@/utils/dateUtils';

const service = new ReportService();

const STATUS_META: Record<ReportStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: colors.error, bg: colors.errorLight },
  reviewed: { label: 'Reviewed', color: colors.info, bg: colors.infoLight },
  actioned: { label: 'Actioned', color: colors.success, bg: colors.successLight },
  dismissed: { label: 'Dismissed', color: colors.textMuted, bg: colors.surfaceAlt },
};

const FILTERS: { key: 'all' | ReportStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'actioned', label: 'Actioned' },
  { key: 'dismissed', label: 'Dismissed' },
];

export const AdminReportsScreen = () => {
  const navigation = useNavigation<any>();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | ReportStatus>('all');

  const load = useCallback(async () => {
    try {
      setReports(await service.listReports());
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const changeStatus = async (r: ReportRow, status: ReportStatus) => {
    try {
      await service.setStatus(r.id, status);
      setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
    } catch {
      await notify('Update failed', 'Could not update the report. Please try again.');
    }
  };

  const onManage = async (r: ReportRow) => {
    const choice = await confirm(`Report: ${r.reason}`, r.details || 'No additional details provided.', {
      confirmText: 'Mark Actioned',
      cancelText: 'Dismiss',
    });
    // confirm() returns true for the primary action, false for the secondary.
    await changeStatus(r, choice ? 'actioned' : 'dismissed');
  };

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter);
  const openCount = reports.filter((r) => r.status === 'open').length;

  const renderItem = ({ item }: { item: ReportRow }) => {
    const meta = STATUS_META[item.status];
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.reasonChip, { backgroundColor: colors.errorLight }]}>
            <MaterialCommunityIcons name="flag" size={13} color={colors.error} />
            <Text style={styles.reasonText} numberOfLines={1}>{item.reason}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        <Text style={styles.partiesText}>
          <Text style={styles.partyStrong}>{item.reporterName}</Text>
          <Text style={styles.partyMuted}> ({item.reporter_role}) reported </Text>
          <Text style={styles.partyStrong}>{item.reportedName}</Text>
        </Text>

        {item.details ? <Text style={styles.details}>"{item.details}"</Text> : null}

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          {item.status === 'open' ? (
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actBtn, styles.actDismiss]} onPress={() => changeStatus(item, 'dismissed')} activeOpacity={0.8}>
                <Text style={[styles.actText, { color: colors.textSecondary }]}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, styles.actReview]} onPress={() => changeStatus(item, 'reviewed')} activeOpacity={0.8}>
                <Text style={[styles.actText, { color: colors.info }]}>Reviewed</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, styles.actAction]} onPress={() => onManage(item)} activeOpacity={0.8}>
                <Text style={[styles.actText, { color: '#fff' }]}>Action</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => changeStatus(item, 'open')} activeOpacity={0.7}>
              <Text style={styles.reopen}>Reopen</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>User Reports</Text>
          {openCount > 0 && <Text style={styles.subtitle}>{openCount} open</Text>}
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="flag-checkered" size={40} color={colors.textLight} />
              <Text style={styles.emptyText}>No reports{filter !== 'all' ? ` (${filter})` : ''}.</Text>
            </View>
          }
        />
      )}
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
  subtitle: { ...typography.bodySmall, color: colors.error, fontSize: 12, marginTop: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.screen, paddingVertical: spacing.md },
  filterChip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  filterTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: spacing.screen, paddingTop: 0, paddingBottom: layout.contentBottom },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, gap: spacing.sm },
  reasonChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: radius.pill, flex: 1 },
  reasonText: { ...typography.label, fontSize: 12, color: colors.error, flex: 1 },
  statusChip: { paddingHorizontal: 10, height: 24, borderRadius: radius.pill, justifyContent: 'center' },
  statusText: { ...typography.labelSmall, fontSize: 11, fontWeight: '700' },
  partiesText: { ...typography.body, fontSize: 14, color: colors.text },
  partyStrong: { ...typography.label, fontSize: 14, color: colors.text },
  partyMuted: { ...typography.body, fontSize: 13, color: colors.textSecondary },
  details: { ...typography.body, fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', marginTop: 6 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  dateText: { ...typography.bodySmall, fontSize: 12, color: colors.textLight },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actBtn: { paddingHorizontal: 12, height: 32, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  actDismiss: { backgroundColor: colors.surfaceAlt },
  actReview: { backgroundColor: colors.infoLight },
  actAction: { backgroundColor: colors.primary },
  actText: { ...typography.label, fontSize: 12 },
  reopen: { ...typography.label, fontSize: 13, color: colors.primary },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted },
});

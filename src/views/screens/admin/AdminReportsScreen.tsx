import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ReportService, ReportRow, ReportStatus } from '@/models/services/ReportService';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';
import { confirm, notify } from '@/utils/confirm';
import { formatDate } from '@/utils/dateUtils';
import {
  EmptyState, Initials, ListHeading, SummaryTile, SummaryTiles, Toolbar,
  cardStyles, contentFrame, recordStyles, useReportsLayout,
} from '@/views/components/admin/ReportsUi';

const service = new ReportService();

// Same tones as the Violations tab (open = red, in progress = amber, done = green, closed = grey).
const STATUS_META: Record<ReportStatus, { label: string; color: string; bg: string; icon: string }> = {
  open:      { label: 'Open',      color: colors.error,     bg: colors.errorLight,   icon: 'alert-circle-outline' },
  reviewed:  { label: 'Reviewed',  color: '#8A5A00',        bg: colors.warningLight, icon: 'eye-check-outline' },
  actioned:  { label: 'Actioned',  color: colors.success,   bg: colors.successLight, icon: 'check-circle-outline' },
  dismissed: { label: 'Dismissed', color: colors.textMuted, bg: colors.surfaceAlt,   icon: 'close-circle-outline' },
};

const STATUS_ORDER: ReportStatus[] = ['open', 'reviewed', 'actioned', 'dismissed'];

export const AdminReportsScreen = ({ embedded = false, onViolationRecorded }: { embedded?: boolean; onViolationRecorded?: () => void }) => {
  const navigation = useNavigation<any>();
  const { columns, tilesInRow } = useReportsLayout();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | ReportStatus>('all');

  const load = useCallback(async () => {
    try {
      setReports(await service.listReports());
    } catch (e) {
      void notify('Could not load reports', 'Please pull down to retry.');
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
    if (busyId) return;
    setBusyId(r.id);
    try {
      await service.setStatus(r.id, status);
      setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
    } catch {
      await notify('Update failed', 'Could not update the report. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const onManage = async (r: ReportRow) => {
    if (busyId) return;
    const role = r.reporter_role === 'passenger' ? 'Driver' : 'Passenger';
    const okay = await confirm(`Record ${role.toLowerCase()} violation?`,
      `Record "${r.reason}" for ${role.toLowerCase()} ${r.reportedName || 'User'}? This creates a linked violation and marks this report actioned.`,
      { confirmText: `Record ${role} Violation` });
    if (!okay) return;
    setBusyId(r.id);
    try {
      await service.recordViolation(r.id);
      setReports((prev) => prev.map((x) => x.id === r.id ? { ...x, status: 'actioned' } : x));
      onViolationRecorded?.();
    } catch (error: any) {
      await notify('Could not record violation', error?.message || 'Please try again.');
    } finally { setBusyId(null); }
  };

  const counts = STATUS_ORDER.reduce((acc, key) => {
    acc[key] = reports.filter((r) => r.status === key).length;
    return acc;
  }, {} as Record<ReportStatus, number>);
  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter);
  const toggleFilter = (key: ReportStatus) => setFilter((current) => (current === key ? 'all' : key));

  return (
    <View style={styles.container}>
      {embedded ? (
        <Toolbar title="User reports" subtitle="Complaints from passengers and drivers" />
      ) : (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>User Reports</Text>
            {counts.open > 0 && <Text style={styles.subtitle}>{counts.open} open</Text>}
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Summary tiles: each one filters the list; tap again to show all */}
        <SummaryTiles>
          {STATUS_ORDER.map((key) => (
            <SummaryTile
              key={key}
              icon={STATUS_META[key].icon}
              label={STATUS_META[key].label}
              value={counts[key]}
              color={STATUS_META[key].color}
              bg={STATUS_META[key].bg}
              active={filter === key}
              inRow={tilesInRow}
              onPress={() => toggleFilter(key)}
            />
          ))}
        </SummaryTiles>

        <ListHeading
          title={filter === 'all' ? 'All reports' : `${STATUS_META[filter].label} reports`}
          count={filtered.length}
          filtered={filter !== 'all'}
          onClear={() => setFilter('all')}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="flag-checkered"
            title={filter === 'all' ? 'No reports' : `No ${STATUS_META[filter].label.toLowerCase()} reports`}
            body="Reports that passengers and drivers send about a trip show up here."
          />
        ) : (
          <View style={cardStyles.grid}>
            {filtered.map((r) => (
              <View key={r.id} style={columns > 1 ? cardStyles.cell2 : cardStyles.cell1}>
                <ReportCard
                  report={r}
                  busy={busyId === r.id}
                  disabled={!!busyId}
                  onChangeStatus={changeStatus}
                  onRecordViolation={onManage}
                  onViewViolations={onViolationRecorded}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

interface ReportCardProps {
  report: ReportRow;
  busy: boolean;
  disabled: boolean;
  onChangeStatus: (r: ReportRow, status: ReportStatus) => void;
  onRecordViolation: (r: ReportRow) => void;
  onViewViolations?: () => void;
}

/** Laid out exactly like the Violations tab's card. */
const ReportCard = ({ report: r, busy, disabled, onChangeStatus, onRecordViolation, onViewViolations }: ReportCardProps) => {
  const meta = STATUS_META[r.status];
  const reportedIsPassenger = r.reporter_role !== 'passenger';
  const reportedRole = reportedIsPassenger ? 'Passenger' : 'Driver';
  const name = r.reportedName || 'User';
  const pending = r.status === 'open' || r.status === 'reviewed';
  return (
    <View style={[cardStyles.card, recordStyles.cardFill]}>
      <View style={[cardStyles.accent, { backgroundColor: meta.color }]} />
      <View style={cardStyles.body}>
        {/* Who was reported + status */}
        <View style={recordStyles.cardHeader}>
          <Initials
            name={name}
            color={reportedIsPassenger ? '#1D5FA8' : colors.primary}
            bg={reportedIsPassenger ? '#E8F1FC' : colors.primaryLight}
          />
          <View style={recordStyles.cardNames}>
            <Text style={recordStyles.cardDriverName} numberOfLines={1}>{name}</Text>
            <View style={recordStyles.cardMetaRow}>
              <Text style={recordStyles.rolePill}>{reportedRole}</Text>
              <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={colors.textMuted} />
              <Text style={recordStyles.cardDate}>{formatDate(r.created_at)}</Text>
            </View>
          </View>
          <View style={[recordStyles.statusBadge, { backgroundColor: meta.bg }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={12} color={meta.color} />
            <Text style={[recordStyles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {/* What was reported */}
        <View style={recordStyles.violationTypeRow}>
          <MaterialCommunityIcons name="alert-outline" size={16} color={colors.error} />
          <Text style={recordStyles.violationType}>{r.reason}</Text>
        </View>
        {r.details ? <Text style={recordStyles.description}>{r.details}</Text> : null}

        <View style={recordStyles.tagRow}>
          <View style={recordStyles.sourcePill}>
            <MaterialCommunityIcons name="account-voice" size={11} color={colors.textSecondary} />
            <Text style={recordStyles.sourcePillText}>
              Reported by {r.reporterName || 'User'} ({r.reporter_role === 'passenger' ? 'passenger' : 'driver'})
            </Text>
          </View>
          {r.violation ? (
            <View style={recordStyles.flagPill}>
              <MaterialCommunityIcons name="link-variant" size={11} color={colors.error} />
              <Text style={recordStyles.flagPillText}>Violation {r.violation.status}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <View style={recordStyles.cardFooter}>
          {busy ? (
            <View style={recordStyles.busyRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={recordStyles.busyText}>Updating…</Text>
            </View>
          ) : r.violation ? (
            <View style={recordStyles.closedRow}>
              <MaterialCommunityIcons name={meta.icon as any} size={14} color={colors.textMuted} />
              <Text style={recordStyles.closedNote}>Violation recorded</Text>
              <View style={recordStyles.closedSpacer} />
              {onViewViolations ? (
                <TouchableOpacity onPress={onViewViolations} hitSlop={8} activeOpacity={0.7}>
                  <Text style={recordStyles.linkText}>View violations</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : pending ? (
            <>
              <View style={recordStyles.actions}>
                <TouchableOpacity style={recordStyles.resolveBtn} disabled={disabled} onPress={() => onRecordViolation(r)} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="gavel" size={16} color="#fff" />
                  <Text style={recordStyles.resolveBtnText} numberOfLines={1}>Record {reportedRole} Violation</Text>
                </TouchableOpacity>
                <TouchableOpacity style={recordStyles.dismissBtn} disabled={disabled} onPress={() => onChangeStatus(r, 'dismissed')} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="close" size={16} color={colors.error} />
                  <Text style={recordStyles.dismissBtnText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
              {r.status === 'open' ? (
                <TouchableOpacity
                  style={styles.reviewedLink}
                  disabled={disabled}
                  onPress={() => onChangeStatus(r, 'reviewed')}
                  hitSlop={6}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="eye-check-outline" size={14} color={colors.primary} />
                  <Text style={recordStyles.linkText}>Mark as reviewed</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <View style={recordStyles.closedRow}>
              <MaterialCommunityIcons name={meta.icon as any} size={14} color={colors.textMuted} />
              <Text style={recordStyles.closedNote}>{meta.label} · No further action needed</Text>
              <View style={recordStyles.closedSpacer} />
              <TouchableOpacity disabled={disabled} onPress={() => onChangeStatus(r, 'open')} hitSlop={8} activeOpacity={0.7}>
                <Text style={recordStyles.linkText}>Reopen</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
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
  scrollContent: {
    ...contentFrame,
    paddingHorizontal: spacing.md,
    paddingBottom: layout.contentBottom,
  },
  center: { alignItems: 'center', paddingVertical: 60 },
  reviewedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.sm,
    minHeight: 28,
    borderRadius: radius.sm,
  },
});

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { DriverViolation, ViolationStatus } from '@/models/entities/Association';
import { ViolationService } from '@/models/services/AssociationService';
import { AdminService } from '@/models/services/AdminService';
import { ConductService, ConductSummary, InvalidCancellation } from '@/models/services/ConductService';
import { CONDUCT_WINDOW_DAYS } from '@/config/constants';
import { confirm, notify } from '@/utils/confirm';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';
import { User } from '@/models/types';
import {
  EmptyState, Initials, ListHeading, SummaryTile, SummaryTiles,
  Toolbar, cardStyles, contentFrame, recordStyles, useReportsLayout,
} from '@/views/components/admin/ReportsUi';

const violationService = new ViolationService();
const adminService = new AdminService();
const conductService = new ConductService();

// ─── Constants ───────────────────────────────────────────────────────────────

type Filter = 'all' | ViolationStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all',       label: 'All' },
  { key: 'open',      label: 'Open' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'resolved',  label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
];

const STATUS_META: Record<ViolationStatus, { label: string; color: string; bg: string; icon: string }> = {
  open:      { label: 'Open',      color: colors.error,   bg: colors.errorLight,   icon: 'alert-circle-outline' },
  confirmed: { label: 'Confirmed', color: '#8A5A00',      bg: colors.warningLight, icon: 'alert-decagram-outline' },
  resolved:  { label: 'Resolved',  color: colors.success, bg: colors.successLight, icon: 'check-circle-outline' },
  dismissed: { label: 'Dismissed', color: colors.textMuted, bg: colors.surfaceAlt, icon: 'close-circle-outline' },
};

const STATUS_ORDER: ViolationStatus[] = ['open', 'confirmed', 'resolved', 'dismissed'];

const PRESET_VIOLATIONS = [
  'Overcharging passenger',
  'Reckless driving',
  'Refusal to transport',
  'Discourteous conduct',
  'Operating without MTOP',
  'Unauthorized route',
  'Vehicle not roadworthy',
  'Other',
];

const REPEATED_CANCELLATION = 'Repeated cancellation without valid reason';

const PASSENGER_VIOLATIONS = ['No-show at pickup', 'Rude or abusive behavior', 'Unsafe conduct', 'Refused to pay the fare', 'Fake / prank booking', REPEATED_CANCELLATION, 'Other'];

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

// ─── Screen ───────────────────────────────────────────────────────────────────

export const ViolationManagementScreen = ({ embedded = false }: { embedded?: boolean }) => {
  const navigation = useNavigation<any>();
  const actor = useAppSelector((state) => state.auth.user);
  const { columns, compact, tilesInRow } = useReportsLayout();

  const [violations, setViolations] = useState<DriverViolation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [subjectRole, setSubjectRole] = useState<'driver' | 'passenger'>('driver');
  const roleLabel = subjectRole === 'driver' ? 'Driver' : 'Passenger';
  const eligibleUsers = users.filter((user) => user.user_type === subjectRole);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [conduct, setConduct] = useState<Map<string, ConductSummary>>(new Map());
  const [cancellations, setCancellations] = useState<InvalidCancellation[]>([]);

  // Add violation form
  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [violationType, setViolationType] = useState('');
  const [customType, setCustomType] = useState('');
  const [description, setDescription] = useState('');
  const [penalty, setPenalty] = useState('');
  const [incidentDate, setIncidentDate] = useState(today());
  const [userPickerVisible, setUserPickerVisible] = useState(false);

  // Status change busy guard
  const [statusBusy, setStatusBusy] = useState<string | null>(null);

  // ─── Load ────────────────────────────────────────────────────────
  // The weekly tally is advisory: if it cannot load, the list still does.
  const loadConduct = useCallback(async () => {
    try {
      const result = await conductService.getWeeklySummaries();
      setConduct(result.summaries);
      setCancellations(result.cancellations);
    } catch (error) {
      console.warn('weekly conduct tally unavailable:', error);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [v, allUsers] = await Promise.all([
        violationService.list(),
        adminService.getAllUsers(),
        loadConduct(),
      ]);
      setViolations(v);
      setUsers(allUsers as User[]);
    } catch (error: any) {
      void notify('Could not load violations', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadConduct]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  // ─── Derived stats ───────────────────────────────────────────────
  const counts = STATUS_ORDER.reduce((acc, key) => {
    acc[key] = violations.filter((v) => v.status === key).length;
    return acc;
  }, {} as Record<ViolationStatus, number>);
  const toggleFilter = (key: ViolationStatus) => setFilter((current) => (current === key ? 'all' : key));

  const filtered = filter === 'all'
    ? violations
    : violations.filter((v) => v.status === filter);

  const needsReview = Array.from(conduct.values()).filter((c) => c.flagged || c.repeatedCancellations);
  const userById = (id: string) => users.find((u) => u.id === id);

  // ─── Form helpers ────────────────────────────────────────────────
  const openForm = (prefill?: { role: 'driver' | 'passenger'; userId: string; type: string; description: string }) => {
    setSubjectRole(prefill?.role ?? 'driver');
    setSelectedUserId(prefill?.userId ?? '');
    setViolationType(prefill?.type ?? '');
    setCustomType('');
    setDescription(prefill?.description ?? '');
    setPenalty('');
    setIncidentDate(today());
    setFormVisible(true);
  };

  // Pre-fills a violation from the passenger's invalid cancellations this week.
  const recordRepeatedCancellations = (summary: ConductSummary) => {
    const lines = cancellations
      .filter((c) => c.passenger_id === summary.userId)
      .map((c) => `• ${formatDate(c.cancelled_at)}: ${c.cancellation_reason || 'No reason given'}`);
    openForm({
      role: 'passenger',
      userId: summary.userId,
      type: REPEATED_CANCELLATION,
      description: `${summary.invalidCancellations} cancellations without a valid reason in the last ${CONDUCT_WINDOW_DAYS} days:\n${lines.join('\n')}`,
    });
  };

  const selectedUser = eligibleUsers.find((d) => d.id === selectedUserId);
  const finalViolationType = violationType === 'Other' ? customType : violationType;

  const saveViolation = async () => {
    if (!selectedUser) {
      void notify('Missing field', `Select a ${subjectRole}.`);
      return;
    }
    if (!finalViolationType.trim()) {
      void notify('Missing field', 'Enter a violation type.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(incidentDate)) {
      void notify('Invalid date', 'Use YYYY-MM-DD format for the incident date.');
      return;
    }
    setSaving(true);
    try {
      const newViolation = await violationService.record(
        {
          driver_id: subjectRole === 'driver' ? selectedUserId : null,
          passenger_id: subjectRole === 'passenger' ? selectedUserId : null,
          franchise_id: null,
          violation_type: finalViolationType.trim(),
          description: description.trim() || null,
          incident_date: incidentDate,
          penalty: penalty.trim() || null,
        },
        actor?.id
      );
      // Attach the selected user and role immediately for display
      newViolation.subject_name = selectedUser.name || roleLabel;
      newViolation.subject_role = subjectRole;
      newViolation.driver_name = subjectRole === 'driver' ? newViolation.subject_name : undefined;
      setViolations((prev) => [newViolation, ...prev]);
      setFormVisible(false);
      void loadConduct();
      await notify('Violation recorded', `${newViolation.violation_type} has been logged for ${newViolation.subject_name}.`);
    } catch (error: any) {
      await notify('Could not save', error?.message || 'Check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Status change ───────────────────────────────────────────────
  const changeStatus = async (v: DriverViolation, status: ViolationStatus) => {
    if (v.status === status) return;
    const label = STATUS_META[status].label;
    const who = v.subject_name ?? v.driver_name ?? 'this user';
    const okay = await confirm(
      `Mark as ${label}?`,
      status === 'confirmed'
        ? `Confirm that ${who} committed this violation? Confirmed violations count toward the ${CONDUCT_WINDOW_DAYS}-day review flag.`
        : status === 'resolved'
        ? `Confirm that the violation by ${who} has been resolved.`
        : `Dismiss the violation by ${who}? This does not erase the record.`,
      { confirmText: label, destructive: status === 'dismissed' }
    );
    if (!okay) return;
    setStatusBusy(v.id);
    try {
      await violationService.setStatus(v.id, status);
      setViolations((prev) =>
        prev.map((item) => (item.id === v.id ? { ...item, status } : item))
      );
      void loadConduct();
    } catch (error: any) {
      await notify('Update failed', error?.message || 'Please try again.');
    } finally {
      setStatusBusy(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header (embedded: the shared toolbar under the Reports and Violations tabs) */}
      {embedded ? (
        <Toolbar
          title="Violation records"
          subtitle="Driver and passenger records & resolution"
          action={
            <TouchableOpacity style={styles.addBtn} onPress={() => openForm()} activeOpacity={0.85} accessibilityLabel="Record violation">
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={styles.addBtnText}>{compact ? 'Record' : 'Record violation'}</Text>
            </TouchableOpacity>
          }
        />
      ) : (
        <View style={styles.header}>
          <View style={styles.headerInner}>
            <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle} numberOfLines={1}>Violations</Text>
              <Text style={styles.headerSub} numberOfLines={1}>Driver and passenger records & resolution</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => openForm()} activeOpacity={0.85} accessibilityLabel="Record violation">
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={styles.addBtnText}>{compact ? 'Record' : 'Record violation'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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

        {/* Users who crossed the weekly threshold — review only, no auto-restriction */}
        {needsReview.length > 0 && (
          <View style={styles.reviewBox}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewHeaderIcon}>
                <MaterialCommunityIcons name="flag" size={14} color="#fff" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.reviewTitle}>Needs admin review</Text>
                <Text style={styles.reviewHint}>Last {CONDUCT_WINDOW_DAYS} days · flags are for review only, no restriction until you act.</Text>
              </View>
            </View>
            <View style={[styles.reviewGrid, columns > 1 && styles.reviewGridWide]}>
              {needsReview.map((c) => {
                const u = userById(c.userId);
                return (
                  <View key={c.userId} style={[styles.reviewRow, columns > 1 && styles.reviewRowWide]}>
                    <Initials name={u?.name} color={colors.error} bg={colors.errorLight} />
                    <View style={styles.reviewCopy}>
                      <Text style={styles.reviewName} numberOfLines={1}>
                        {u?.name ?? 'User'}{u ? ` · ${u.user_type === 'driver' ? 'Driver' : 'Passenger'}` : ''}
                      </Text>
                      {c.flagged && <Text style={styles.reviewMeta}>{c.confirmedViolations} confirmed violations</Text>}
                      {c.repeatedCancellations && (
                        <Text style={styles.reviewMeta}>{c.invalidCancellations} cancellations without a valid reason</Text>
                      )}
                    </View>
                    <View style={[styles.reviewActions, compact && styles.reviewActionsStacked]}>
                      {c.repeatedCancellations && (
                        <TouchableOpacity style={styles.reviewBtn} onPress={() => recordRepeatedCancellations(c)} activeOpacity={0.8}>
                          <Text style={styles.reviewBtnText}>Record</Text>
                        </TouchableOpacity>
                      )}
                      {c.flagged && (
                        <TouchableOpacity
                          style={styles.reviewBtn}
                          onPress={() => navigation.navigate('UserManagement', { filter: 'flagged' })}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.reviewBtnText}>Review</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <ListHeading
          title={filter === 'all' ? 'All violations' : `${STATUS_META[filter].label} violations`}
          count={filtered.length}
          filtered={filter !== 'all'}
          onClear={() => setFilter('all')}
        />

        {/* List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="shield-check-outline"
            title={`No ${filter === 'all' ? '' : `${STATUS_META[filter].label.toLowerCase()} `}violations`}
            body={<>Tap <Text style={{ color: colors.primary, fontWeight: '700' }}>Record</Text> to log a driver or passenger violation.</>}
          />
        ) : (
          <View style={cardStyles.grid}>
            {filtered.map((v) => (
              <View key={v.id} style={columns > 1 ? cardStyles.cell2 : cardStyles.cell1}>
                <ViolationCard
                  violation={v}
                  flagged={!!conduct.get((v.driver_id || v.passenger_id) ?? '')?.flagged}
                  busy={statusBusy === v.id}
                  onChangeStatus={changeStatus}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Add Violation Modal ── */}
      <Modal
        visible={formVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { if (!saving) setFormVisible(false); }}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Record Violation</Text>
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={() => { if (!saving) setFormVisible(false); }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>RECORD FOR *</Text>
              <View style={styles.roleRow}>
                {(['driver', 'passenger'] as const).map((role) => (
                  <TouchableOpacity key={role} accessibilityRole="radio" accessibilityState={{ checked: subjectRole === role }}
                    disabled={saving} style={[styles.roleOption, subjectRole === role && styles.presetChipActive]}
                    onPress={() => {
                      setSubjectRole(role); setSelectedUserId(''); setUserPickerVisible(false);
                      setViolationType(''); setCustomType('');
                    }}>
                    <Text style={[styles.presetChipText, subjectRole === role && styles.presetChipTextActive]}>
                      {role === 'driver' ? 'Driver' : 'Passenger'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>{roleLabel.toUpperCase()} *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setUserPickerVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="account-outline" size={18} color={colors.primary} />
                <Text style={[styles.pickerText, !selectedUser && { color: colors.textMuted }]}>
                  {selectedUser?.name ?? `Select a ${subjectRole}...`}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textLight} />
              </TouchableOpacity>

              {/* Violation type presets */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>VIOLATION TYPE *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsRow}
              >
                {(subjectRole === 'driver' ? PRESET_VIOLATIONS : PASSENGER_VIOLATIONS).map((preset) => {
                  const active = violationType === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.presetChip, active && styles.presetChipActive]}
                      onPress={() => setViolationType(preset)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                        {preset}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {violationType === 'Other' && (
                <TextInput
                  style={styles.input}
                  placeholder="Describe the violation type…"
                  placeholderTextColor={colors.textMuted}
                  value={customType}
                  onChangeText={setCustomType}
                />
              )}

              {/* Description */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Details about the incident…"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Penalty */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>PENALTY / SANCTION</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Warning, ₱500 fine, Suspension…"
                placeholderTextColor={colors.textMuted}
                value={penalty}
                onChangeText={setPenalty}
              />

              {/* Incident date */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>INCIDENT DATE *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={incidentDate}
                onChangeText={setIncidentDate}
                keyboardType="numeric"
                maxLength={10}
              />
            </ScrollView>

            {/* Save button */}
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={saveViolation}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="alert-plus-outline" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Violation Record</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Driver Picker Modal ── */}
      <Modal
        visible={userPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setUserPickerVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { maxHeight: '70%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select {roleLabel}</Text>
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={() => setUserPickerVisible(false)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.driverList}>
              {eligibleUsers.length === 0 && (
                <Text style={[styles.emptyText, { textAlign: 'center', padding: spacing.lg }]}>
                  No {subjectRole}s found.
                </Text>
              )}
              {eligibleUsers.map((driver) => (
                <TouchableOpacity
                  key={driver.id}
                  style={[
                    styles.driverRow,
                    selectedUserId === driver.id && styles.driverRowActive,
                  ]}
                  onPress={() => {
                    setSelectedUserId(driver.id);
                    setUserPickerVisible(false);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>
                      {(driver.name ?? 'D').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driver.name ?? roleLabel}</Text>
                    <Text style={styles.driverMeta}>{(driver as any).plate_number ?? (driver as any).user_type ?? roleLabel}</Text>
                  </View>
                  {selectedUserId === driver.id && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface ViolationCardProps {
  violation: DriverViolation;
  flagged: boolean;
  busy: boolean;
  onChangeStatus: (v: DriverViolation, status: ViolationStatus) => void;
}

const ViolationCard = ({ violation: v, flagged, busy, onChangeStatus }: ViolationCardProps) => {
  const meta = STATUS_META[v.status];
  const isPassenger = !!v.passenger_id;
  const name = v.subject_name ?? v.driver_name ?? 'User';
  return (
    <View style={[cardStyles.card, recordStyles.cardFill]}>
      <View style={[cardStyles.accent, { backgroundColor: meta.color }]} />
      <View style={cardStyles.body}>
        {/* Who + status */}
        <View style={recordStyles.cardHeader}>
          <Initials
            name={name}
            color={isPassenger ? '#1D5FA8' : colors.primary}
            bg={isPassenger ? '#E8F1FC' : colors.primaryLight}
          />
          <View style={recordStyles.cardNames}>
            <Text style={recordStyles.cardDriverName} numberOfLines={1}>{name}</Text>
            <View style={recordStyles.cardMetaRow}>
              <Text style={recordStyles.rolePill}>{isPassenger ? 'Passenger' : 'Driver'}</Text>
              <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={colors.textMuted} />
              <Text style={recordStyles.cardDate}>{formatDate(v.incident_date)}</Text>
            </View>
          </View>
          <View style={[recordStyles.statusBadge, { backgroundColor: meta.bg }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={12} color={meta.color} />
            <Text style={[recordStyles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {/* What happened */}
        <View style={recordStyles.violationTypeRow}>
          <MaterialCommunityIcons name="alert-outline" size={16} color={colors.error} />
          <Text style={recordStyles.violationType}>{v.violation_type}</Text>
        </View>
        {v.description ? <Text style={recordStyles.description}>{v.description}</Text> : null}

        {(v.penalty || flagged || v.report_id) ? (
          <View style={recordStyles.tagRow}>
            {v.penalty ? (
              <View style={recordStyles.penaltyBox}>
                <MaterialCommunityIcons name="gavel" size={13} color="#8A5A00" />
                <Text style={recordStyles.penaltyText}>{v.penalty}</Text>
              </View>
            ) : null}
            {flagged ? (
              <View style={recordStyles.flagPill}>
                <MaterialCommunityIcons name="flag" size={11} color={colors.error} />
                <Text style={recordStyles.flagPillText}>Flagged this week</Text>
              </View>
            ) : null}
            {v.report_id ? (
              <View style={recordStyles.sourcePill}>
                <MaterialCommunityIcons name="link-variant" size={11} color={colors.textSecondary} />
                <Text style={recordStyles.sourcePillText}>From user report</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Status actions */}
        <View style={recordStyles.cardFooter}>
          {busy ? (
            <View style={recordStyles.busyRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={recordStyles.busyText}>Updating…</Text>
            </View>
          ) : v.status === 'open' ? (
            <View style={recordStyles.actions}>
              <TouchableOpacity style={recordStyles.resolveBtn} onPress={() => onChangeStatus(v, 'confirmed')} activeOpacity={0.85}>
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
                <Text style={recordStyles.resolveBtnText}>Confirm Violation</Text>
              </TouchableOpacity>
              <TouchableOpacity style={recordStyles.dismissBtn} onPress={() => onChangeStatus(v, 'dismissed')} activeOpacity={0.8}>
                <MaterialCommunityIcons name="close" size={16} color={colors.error} />
                <Text style={recordStyles.dismissBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ) : v.status === 'confirmed' ? (
            <View style={recordStyles.actions}>
              <TouchableOpacity style={recordStyles.resolveBtn} onPress={() => onChangeStatus(v, 'resolved')} activeOpacity={0.85}>
                <MaterialCommunityIcons name="check-all" size={16} color="#fff" />
                <Text style={recordStyles.resolveBtnText}>Mark Resolved</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={recordStyles.closedRow}>
              <MaterialCommunityIcons name={meta.icon as any} size={14} color={colors.textMuted} />
              <Text style={recordStyles.closedNote}>
                {v.status === 'resolved' ? 'Resolved' : 'Dismissed'} · No further action needed
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  roleOption: { flex: 1, minHeight: 44, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },

  // Header
  header: {
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerInner: {
    ...contentFrame,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { ...typography.h2, fontSize: 22 },
  headerSub: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
  },
  addBtnText: { ...typography.label, color: '#fff', fontSize: 13 },

  // Scroll
  scrollContent: {
    ...contentFrame,
    paddingHorizontal: spacing.md,
    paddingBottom: layout.contentBottom,
  },

  // Weekly review flags
  reviewBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: '#FFD6D1',
    gap: spacing.sm,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewHeaderIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  reviewTitle: { ...typography.label, fontSize: 14, color: colors.error },
  reviewHint: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  reviewGrid: { gap: spacing.sm },
  reviewGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm,
  },
  reviewRowWide: { flexBasis: '48%', flexGrow: 1, minWidth: 0 },
  reviewCopy: { flex: 1, minWidth: 0 },
  reviewName: { ...typography.label, fontSize: 14, color: colors.text },
  reviewMeta: { ...typography.bodySmall, fontSize: 12, color: colors.error, marginTop: 1 },
  reviewActions: { flexDirection: 'row', gap: spacing.xs },
  reviewActionsStacked: { flexDirection: 'column' },
  reviewBtn: {
    minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
  },
  reviewBtnText: { ...typography.label, fontSize: 12, color: '#fff' },

  // States
  center: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },

  // Add violation sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    paddingBottom: spacing.lg,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm, marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
  },
  sheetTitle: { ...typography.h2, fontSize: 20, flex: 1 },
  sheetClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetScroll: { flexGrow: 0 },
  sheetContent: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
  },
  sheetFooter: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },

  // Form fields
  fieldLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: 48,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  pickerText: { ...typography.label, flex: 1, fontSize: 14, color: colors.text },
  presetsRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  presetChip: {
    paddingHorizontal: spacing.md, minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surface,
  },
  presetChipActive: { backgroundColor: colors.error, borderColor: colors.error },
  presetChipText: { ...typography.label, fontSize: 12, color: colors.textSecondary },
  presetChipTextActive: { color: '#fff' },
  input: {
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  textarea: { minHeight: 80, paddingTop: 12 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.error,
  },
  saveBtnText: { ...typography.button, fontSize: 15, color: '#fff' },

  // Driver picker
  driverList: { paddingHorizontal: spacing.screen, paddingBottom: spacing.lg },
  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  driverRowActive: { backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  driverAvatar: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { ...typography.h3, color: '#fff', fontSize: 16 },
  driverInfo: { flex: 1 },
  driverName: { ...typography.label, fontSize: 15, color: colors.text },
  driverMeta: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
});

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
import { Card } from '@/views/components/common/Card';
import { User } from '@/models/types';

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
  const countOpen      = violations.filter((v) => v.status === 'open').length;
  const countConfirmed = violations.filter((v) => v.status === 'confirmed').length;
  const countResolved  = violations.filter((v) => v.status === 'resolved').length;
  const countDismissed = violations.filter((v) => v.status === 'dismissed').length;

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
      {/* Header */}
      <View style={[styles.header, embedded && { paddingTop: spacing.md, paddingLeft: spacing.screen, gap: spacing.sm }]}>
        {!embedded && <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>}
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Violations</Text>
          <Text style={styles.headerSub}>Driver and passenger records & resolution</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => openForm()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Record</Text>
        </TouchableOpacity>
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
        {/* Summary stats */}
        <View style={styles.statsRow}>
          <StatCard icon="alert-circle" label="Open" value={countOpen} color={colors.error} bg={colors.errorLight} />
          <StatCard icon="alert-decagram" label="Confirmed" value={countConfirmed} color="#8A5A00" bg={colors.warningLight} />
          <StatCard icon="check-circle" label="Resolved" value={countResolved} color={colors.success} bg={colors.successLight} />
          <StatCard icon="close-circle" label="Dismissed" value={countDismissed} color={colors.textMuted} bg={colors.surfaceAlt} />
        </View>

        {/* Users who crossed the weekly threshold — review only, no auto-restriction */}
        {needsReview.length > 0 && (
          <View style={styles.reviewBox}>
            <View style={styles.reviewHeader}>
              <MaterialCommunityIcons name="flag" size={16} color={colors.error} />
              <Text style={styles.reviewTitle}>NEEDS ADMIN REVIEW · LAST {CONDUCT_WINDOW_DAYS} DAYS</Text>
            </View>
            {needsReview.map((c) => {
              const u = userById(c.userId);
              return (
                <View key={c.userId} style={styles.reviewRow}>
                  <View style={styles.reviewCopy}>
                    <Text style={styles.reviewName} numberOfLines={1}>
                      {u?.name ?? 'User'}{u ? ` · ${u.user_type === 'driver' ? 'Driver' : 'Passenger'}` : ''}
                    </Text>
                    {c.flagged && <Text style={styles.reviewMeta}>{c.confirmedViolations} confirmed violations</Text>}
                    {c.repeatedCancellations && (
                      <Text style={styles.reviewMeta}>{c.invalidCancellations} cancellations without a valid reason</Text>
                    )}
                  </View>
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
              );
            })}
            <Text style={styles.reviewHint}>
              Flags are for review only. No restriction is applied until you act on the account.
            </Text>
          </View>
        )}

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            const count =
              key === 'all' ? violations.length
              : key === 'open' ? countOpen
              : key === 'confirmed' ? countConfirmed
              : key === 'resolved' ? countResolved
              : countDismissed;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.resultCount}>SHOWING {filtered.length} RECORDS</Text>

        {/* List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="shield-check-outline" size={52} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No {filter === 'all' ? '' : filter} violations</Text>
            <Text style={styles.emptyText}>
              Tap <Text style={{ color: colors.primary, fontWeight: '700' }}>Record</Text> to log a driver or passenger violation.
            </Text>
          </View>
        ) : (
          filtered.map((v) => (
            <ViolationCard
              key={v.id}
              violation={v}
              flagged={!!conduct.get((v.driver_id || v.passenger_id) ?? '')?.flagged}
              busy={statusBusy === v.id}
              onChangeStatus={changeStatus}
            />
          ))
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

interface ViolationCardProps {
  violation: DriverViolation;
  flagged: boolean;
  busy: boolean;
  onChangeStatus: (v: DriverViolation, status: ViolationStatus) => void;
}

const ViolationCard = ({ violation: v, flagged, busy, onChangeStatus }: ViolationCardProps) => {
  const meta = STATUS_META[v.status];
  return (
    <Card variant="elevated" padding="md" style={styles.card}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardAvatar}>
          <MaterialCommunityIcons name="account-alert-outline" size={22} color={colors.error} />
        </View>
        <View style={styles.cardNames}>
          <Text style={styles.cardDriverName}>
            {v.subject_name ?? v.driver_name ?? 'User'}
          </Text>
          <Text style={styles.cardDate}>{v.passenger_id ? 'Passenger' : 'Driver'} / {formatDate(v.incident_date)}</Text>
          {flagged && (
            <View style={styles.flagPill}>
              <MaterialCommunityIcons name="flag" size={10} color={colors.error} />
              <Text style={styles.flagPillText}>FLAGGED THIS WEEK</Text>
            </View>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <MaterialCommunityIcons name={meta.icon as any} size={12} color={meta.color} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
        </View>
      </View>

      {v.report_id && <Text style={styles.description}>Source: user report {v.report_id.slice(0, 8)}</Text>}

      {/* Violation type */}
      <View style={styles.violationTypeRow}>
        <MaterialCommunityIcons name="alert-outline" size={16} color={colors.error} />
        <Text style={styles.violationType}>{v.violation_type}</Text>
      </View>

      {/* Description */}
      {v.description ? (
        <Text style={styles.description}>{v.description}</Text>
      ) : null}

      {/* Penalty */}
      {v.penalty ? (
        <View style={styles.penaltyBox}>
          <MaterialCommunityIcons name="gavel" size={14} color={colors.textSecondary} />
          <Text style={styles.penaltyText}>{v.penalty}</Text>
        </View>
      ) : null}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Status actions */}
      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.busyText}>Updating…</Text>
        </View>
      ) : v.status === 'open' ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => onChangeStatus(v, 'dismissed')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="close" size={15} color="#fff" />
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resolveBtn}
            onPress={() => onChangeStatus(v, 'confirmed')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="check" size={15} color="#fff" />
            <Text style={styles.resolveBtnText}>Confirm Violation</Text>
          </TouchableOpacity>
        </View>
      ) : v.status === 'confirmed' ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.resolveBtn}
            onPress={() => onChangeStatus(v, 'resolved')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="check-all" size={15} color="#fff" />
            <Text style={styles.resolveBtnText}>Mark Resolved</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.closedNote}>
          {v.status === 'resolved' ? '✓ Resolved' : '— Dismissed'} · No further action needed
        </Text>
      )}
    </Card>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    minHeight: 38,
    borderRadius: radius.md,
  },
  addBtnText: { ...typography.label, color: '#fff', fontSize: 13 },

  // Scroll
  scrollContent: { paddingBottom: 100 },

  // Stats
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
  statValue: { fontSize: 24, fontWeight: '800', fontFamily: 'Poppins_700Bold' },
  statLabel: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Weekly review flags
  reviewBox: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.errorLight,
    gap: spacing.sm,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewTitle: { ...typography.labelSmall, fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.error },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm,
  },
  reviewCopy: { flex: 1, minWidth: 0 },
  reviewName: { ...typography.label, fontSize: 14, color: colors.text },
  reviewMeta: { ...typography.bodySmall, fontSize: 12, color: colors.error, marginTop: 1 },
  reviewBtn: {
    minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
  },
  reviewBtnText: { ...typography.label, fontSize: 12, color: '#fff' },
  reviewHint: { ...typography.bodySmall, fontSize: 11, color: colors.textSecondary },
  flagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
    marginTop: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.sm, backgroundColor: colors.errorLight,
  },
  flagPillText: { ...typography.labelSmall, fontSize: 9, fontWeight: '800', color: colors.error, letterSpacing: 0.5 },

  // Filter chips
  filterScroll: { marginTop: spacing.sm },
  filterContent: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
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
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipBadgeText: { ...typography.labelSmall, fontSize: 10, fontWeight: '800', color: colors.textSecondary },
  chipBadgeTextActive: { color: '#fff' },

  resultCount: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  // Violation card
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
  cardAvatar: {
    width: 40, height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cardNames: { flex: 1, minWidth: 0 },
  cardDriverName: { ...typography.label, fontSize: 15, color: colors.text },
  cardDate: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: radius.sm,
  },
  statusText: { ...typography.labelSmall, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  violationTypeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginBottom: spacing.sm,
  },
  violationType: { ...typography.label, fontSize: 14, color: colors.text, flex: 1 },

  description: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },

  penaltyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  penaltyText: { flex: 1, ...typography.labelSmall, fontSize: 12, color: '#8A5A00' },

  divider: { height: 1, backgroundColor: colors.borderLight, marginBottom: spacing.sm },

  actions: { flexDirection: 'row', gap: spacing.sm },
  dismissBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: colors.error,
    borderRadius: radius.md,
  },
  dismissBtnText: { ...typography.label, fontSize: 13, color: '#fff', flexShrink: 1, textAlign: 'center' },
  resolveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  resolveBtnText: { ...typography.label, fontSize: 13, color: '#fff', flexShrink: 1, textAlign: 'center' },
  busyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, minHeight: 44,
  },
  busyText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  closedNote: {
    ...typography.bodySmall, fontSize: 12,
    color: colors.textMuted, fontStyle: 'italic',
    textAlign: 'center', paddingVertical: 6,
  },

  // States
  center: { alignItems: 'center', paddingVertical: 60 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.screen },
  emptyTitle: { ...typography.h3, marginTop: spacing.md },
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

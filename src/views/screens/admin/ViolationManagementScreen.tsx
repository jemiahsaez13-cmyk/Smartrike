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
import { confirm, notify } from '@/utils/confirm';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';
import { User } from '@/models/types';

const violationService = new ViolationService();
const adminService = new AdminService();

// ─── Constants ───────────────────────────────────────────────────────────────

type Filter = 'all' | ViolationStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all',       label: 'All' },
  { key: 'open',      label: 'Open' },
  { key: 'resolved',  label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
];

const STATUS_META: Record<ViolationStatus, { label: string; color: string; bg: string; icon: string }> = {
  open:      { label: 'Open',      color: colors.error,   bg: colors.errorLight,   icon: 'alert-circle-outline' },
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

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

// ─── Screen ───────────────────────────────────────────────────────────────────

export const ViolationManagementScreen = () => {
  const navigation = useNavigation<any>();
  const actor = useAppSelector((state) => state.auth.user);

  const [violations, setViolations] = useState<DriverViolation[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');

  // Add violation form
  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [violationType, setViolationType] = useState('');
  const [customType, setCustomType] = useState('');
  const [description, setDescription] = useState('');
  const [penalty, setPenalty] = useState('');
  const [incidentDate, setIncidentDate] = useState(today());
  const [driverPickerVisible, setDriverPickerVisible] = useState(false);

  // Status change busy guard
  const [statusBusy, setStatusBusy] = useState<string | null>(null);

  // ─── Load ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [v, allUsers] = await Promise.all([
        violationService.list(),
        adminService.getAllUsers(),
      ]);
      setViolations(v);
      setDrivers((allUsers as User[]).filter((u: any) => u.user_type === 'driver'));
    } catch (error: any) {
      void notify('Could not load violations', error?.message || 'Please try again.');
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

  // ─── Derived stats ───────────────────────────────────────────────
  const countOpen      = violations.filter((v) => v.status === 'open').length;
  const countResolved  = violations.filter((v) => v.status === 'resolved').length;
  const countDismissed = violations.filter((v) => v.status === 'dismissed').length;

  const filtered = filter === 'all'
    ? violations
    : violations.filter((v) => v.status === filter);

  // ─── Form helpers ────────────────────────────────────────────────
  const openForm = () => {
    setSelectedDriverId('');
    setViolationType('');
    setCustomType('');
    setDescription('');
    setPenalty('');
    setIncidentDate(today());
    setFormVisible(true);
  };

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);
  const finalViolationType = violationType === 'Other' ? customType : violationType;

  const saveViolation = async () => {
    if (!selectedDriverId) {
      void notify('Missing field', 'Select a driver.');
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
          driver_id: selectedDriverId,
          franchise_id: null,
          violation_type: finalViolationType.trim(),
          description: description.trim() || null,
          incident_date: incidentDate,
          penalty: penalty.trim() || null,
        },
        actor?.id
      );
      // Attach driver name immediately for display
      newViolation.driver_name = selectedDriver?.name ?? 'Driver';
      setViolations((prev) => [newViolation, ...prev]);
      setFormVisible(false);
      await notify('Violation recorded', `${newViolation.violation_type} has been logged for ${newViolation.driver_name}.`);
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
    const okay = await confirm(
      `Mark as ${label}?`,
      status === 'resolved'
        ? `Confirm that the violation by ${v.driver_name ?? 'this driver'} has been resolved.`
        : `Dismiss the violation by ${v.driver_name ?? 'this driver'}? This does not erase the record.`,
      { confirmText: label, destructive: status === 'dismissed' }
    );
    if (!okay) return;
    setStatusBusy(v.id);
    try {
      await violationService.setStatus(v.id, status);
      setViolations((prev) =>
        prev.map((item) => (item.id === v.id ? { ...item, status } : item))
      );
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Violations</Text>
          <Text style={styles.headerSub}>Driver violation records & resolution</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openForm} activeOpacity={0.8}>
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
          <StatCard icon="check-circle" label="Resolved" value={countResolved} color={colors.success} bg={colors.successLight} />
          <StatCard icon="close-circle" label="Dismissed" value={countDismissed} color={colors.textMuted} bg={colors.surfaceAlt} />
        </View>

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
              Tap <Text style={{ color: colors.primary, fontWeight: '700' }}>Record</Text> to log a new driver violation.
            </Text>
          </View>
        ) : (
          filtered.map((v) => (
            <ViolationCard
              key={v.id}
              violation={v}
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
              {/* Driver picker */}
              <Text style={styles.fieldLabel}>DRIVER *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setDriverPickerVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="account-outline" size={18} color={colors.primary} />
                <Text style={[styles.pickerText, !selectedDriver && { color: colors.textMuted }]}>
                  {selectedDriver?.name ?? 'Select a driver…'}
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
                {PRESET_VIOLATIONS.map((preset) => {
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
        visible={driverPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDriverPickerVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { maxHeight: '70%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Driver</Text>
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={() => setDriverPickerVisible(false)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.driverList}>
              {drivers.length === 0 && (
                <Text style={[styles.emptyText, { textAlign: 'center', padding: spacing.lg }]}>
                  No drivers found.
                </Text>
              )}
              {drivers.map((driver) => (
                <TouchableOpacity
                  key={driver.id}
                  style={[
                    styles.driverRow,
                    selectedDriverId === driver.id && styles.driverRowActive,
                  ]}
                  onPress={() => {
                    setSelectedDriverId(driver.id);
                    setDriverPickerVisible(false);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>
                      {(driver.name ?? 'D').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driver.name ?? 'Driver'}</Text>
                    <Text style={styles.driverMeta}>{(driver as any).plate_number ?? (driver as any).user_type ?? 'Driver'}</Text>
                  </View>
                  {selectedDriverId === driver.id && (
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
  busy: boolean;
  onChangeStatus: (v: DriverViolation, status: ViolationStatus) => void;
}

const ViolationCard = ({ violation: v, busy, onChangeStatus }: ViolationCardProps) => {
  const meta = STATUS_META[v.status];
  return (
    <Card variant="elevated" padding="md" style={styles.card}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardAvatar}>
          <MaterialCommunityIcons name="account-alert-outline" size={22} color={colors.error} />
        </View>
        <View style={styles.cardNames}>
          <Text style={styles.cardDriverName} numberOfLines={1}>
            {v.driver_name ?? 'Driver'}
          </Text>
          <Text style={styles.cardDate}>{formatDate(v.incident_date)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <MaterialCommunityIcons name={meta.icon as any} size={12} color={meta.color} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
        </View>
      </View>

      {/* Violation type */}
      <View style={styles.violationTypeRow}>
        <MaterialCommunityIcons name="alert-outline" size={16} color={colors.error} />
        <Text style={styles.violationType}>{v.violation_type}</Text>
      </View>

      {/* Description */}
      {v.description ? (
        <Text style={styles.description} numberOfLines={3}>{v.description}</Text>
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
            <MaterialCommunityIcons name="close" size={15} color={colors.textSecondary} />
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resolveBtn}
            onPress={() => onChangeStatus(v, 'resolved')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="check" size={15} color="#fff" />
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
    height: 38,
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
    height: 36,
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
  penaltyText: { ...typography.labelSmall, fontSize: 12, color: '#8A5A00' },

  divider: { height: 1, backgroundColor: colors.borderLight, marginBottom: spacing.sm },

  actions: { flexDirection: 'row', gap: spacing.sm },
  dismissBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, minHeight: 44,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md,
  },
  dismissBtnText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  resolveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, minHeight: 44,
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  resolveBtnText: { ...typography.label, fontSize: 13, color: '#fff' },
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
    paddingHorizontal: spacing.md, height: 34,
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
    gap: 8, height: 50,
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

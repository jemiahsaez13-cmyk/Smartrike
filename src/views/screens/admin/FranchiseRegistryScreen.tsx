import React, { useCallback, useMemo, useState } from 'react';
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
import {
  FranchiseApplication,
  FranchiseEvent,
  FranchiseRecordStatus,
  FRANCHISE_RECORD_STATUS_LABEL,
  SuccessorRelationship,
} from '@/models/entities/Franchise';
import { FranchiseService } from '@/models/services/FranchiseService';
import { FranchiseAgreementService } from '@/models/services/FranchiseAgreementService';
import { ViolationService } from '@/models/services/AssociationService';
import { confirm, notify } from '@/utils/confirm';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const franchiseService = new FranchiseService();
const violationService = new ViolationService();

type RegistryAction =
  | 'details'
  | 'renewal'
  | 'succession_transfer'
  | 'third_party_transfer'
  | 'termination'
  | 'violation';

const STATUS_COLOR: Record<FranchiseRecordStatus, { fg: string; bg: string }> = {
  active: { fg: colors.success, bg: colors.successLight },
  expired: { fg: colors.error, bg: colors.errorLight },
  pending_renewal: { fg: '#8A5A00', bg: colors.warningLight },
  terminated: { fg: colors.error, bg: colors.errorLight },
  transferred: { fg: colors.primary, bg: colors.primaryLight },
};

const today = () => new Date().toISOString().slice(0, 10);
const nextYear = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
};

const ActionChip = ({ label, icon, onPress, danger = false }: {
  label: string;
  icon: string;
  onPress: () => void;
  danger?: boolean;
}) => (
  <TouchableOpacity style={[styles.actionChip, danger && styles.actionChipDanger]} onPress={onPress} activeOpacity={0.76}>
    <MaterialCommunityIcons name={icon as any} size={16} color={danger ? colors.error : colors.primary} />
    <Text style={[styles.actionChipText, danger && { color: colors.error }]}>{label}</Text>
  </TouchableOpacity>
);

export const FranchiseRegistryScreen = () => {
  const navigation = useNavigation<any>();
  const actor = useAppSelector((state) => state.auth.user);
  const [records, setRecords] = useState<FranchiseApplication[]>([]);
  const [events, setEvents] = useState<FranchiseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | FranchiseRecordStatus>('all');
  const [selected, setSelected] = useState<FranchiseApplication | null>(null);
  const [action, setAction] = useState<RegistryAction | null>(null);
  const [saving, setSaving] = useState(false);

  const [bodyNumber, setBodyNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [recordStatus, setRecordStatus] = useState<FranchiseRecordStatus>('active');
  const [expiryDate, setExpiryDate] = useState(nextYear());
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [recipientName, setRecipientName] = useState('');
  const [relationship, setRelationship] = useState<SuccessorRelationship>('spouse');
  const [qualified, setQualified] = useState(false);
  const [reason, setReason] = useState('');
  const [violationType, setViolationType] = useState('');
  const [description, setDescription] = useState('');
  const [penalty, setPenalty] = useState('');

  const load = useCallback(async () => {
    try {
      const [registry, lifecycleEvents] = await Promise.all([
        franchiseService.getRegistry(),
        franchiseService.getEvents(),
      ]);
      setRecords(registry);
      setEvents(lifecycleEvents);
    } catch (error) {
      console.error('Registry load failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAction = (record: FranchiseApplication, nextAction: RegistryAction) => {
    setSelected(record);
    setAction(nextAction);
    setBodyNumber(record.body_number || '');
    setHolderName(record.current_holder_name || record.driver_name);
    setRecordStatus(record.franchise_status || 'active');
    setExpiryDate(record.expiry_date || nextYear());
    setEffectiveDate(today());
    setRecipientName('');
    setRelationship('spouse');
    setQualified(false);
    setReason('');
    setViolationType('');
    setDescription('');
    setPenalty('');
  };

  const closeModal = () => {
    if (saving) return;
    setAction(null);
    setSelected(null);
  };

  const save = async () => {
    if (!selected || !action) return;
    setSaving(true);
    try {
      if (action === 'details') {
        await franchiseService.updateRegistryDetails(selected.id, {
          bodyNumber,
          expiryDate,
          currentHolderName: holderName,
          franchiseStatus: recordStatus,
        });
      } else if (action === 'violation') {
        await violationService.record({
          driver_id: selected.driver_id,
          franchise_id: selected.id,
          violation_type: violationType,
          description,
          incident_date: effectiveDate,
          penalty,
        }, actor?.id);
      } else {
        const isAgreementAction = action === 'succession_transfer'
          || action === 'third_party_transfer'
          || action === 'termination';
        const agreementNumber = isAgreementAction
          ? FranchiseAgreementService.agreementNumber(selected.id)
          : undefined;
        const agreementText = isAgreementAction
          ? FranchiseAgreementService.buildText(selected, {
              eventType: action,
              effectiveDate,
              fromHolder: selected.current_holder_name || selected.driver_name,
              toHolder: recipientName || undefined,
              relationship: action === 'succession_transfer' ? relationship : action === 'third_party_transfer' ? 'third_party' : undefined,
              reason: reason || undefined,
            }, agreementNumber!)
          : undefined;

        const result = await franchiseService.recordEvent(selected, {
          eventType: action,
          effectiveDate,
          newExpiryDate: action === 'renewal' ? expiryDate : undefined,
          toHolder: recipientName || undefined,
          relationship: action === 'succession_transfer' ? relationship : action === 'third_party_transfer' ? 'third_party' : undefined,
          qualifiedRecipient: qualified,
          reason: reason || undefined,
          agreementNumber,
          agreementText,
          createdBy: actor?.id,
        });

        if (agreementText && agreementNumber) {
          await FranchiseAgreementService.shareAgreement(agreementText, agreementNumber);
        }
        if (result.event) setEvents((previous) => [result.event, ...previous]);
      }
      setAction(null);
      setSelected(null);
      await load();
      await notify('Record saved', action === 'violation'
        ? 'The driver violation is now included in reports.'
        : 'The franchise registry has been updated.');
    } catch (error: any) {
      await notify('Unable to save', error?.message || 'Check the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(
    () => filter === 'all' ? records : records.filter((record) => (record.franchise_status || 'active') === filter),
    [records, filter]
  );
  const activeCount = records.filter((record) => (record.franchise_status || 'active') === 'active').length;
  const renewedThisYear = events.filter((event) =>
    event.event_type === 'renewal' && new Date(event.effective_date).getFullYear() === new Date().getFullYear()
  ).length;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Franchise Registry</Text>
          <Text style={styles.subtitle}>Issued MTOP lifecycle and compliance records</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{activeCount}</Text>
            <Text style={styles.summaryLabel}>Active franchises</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{renewedThisYear}</Text>
            <Text style={styles.summaryLabel}>Renewed this year</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['all', 'active', 'expired', 'pending_renewal', 'transferred', 'terminated'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, filter === status && styles.filterChipActive]}
              onPress={() => setFilter(status)}
              activeOpacity={0.76}
            >
              <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
                {status === 'all' ? 'All' : FRANCHISE_RECORD_STATUS_LABEL[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.map((record) => {
          const status = record.franchise_status || 'active';
          const meta = STATUS_COLOR[status];
          const recent = events.find((event) => event.franchise_id === record.id);
          return (
            <View key={record.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.holder}>{record.current_holder_name || record.driver_name}</Text>
                  <Text style={styles.mtop}>{record.mtop_number || 'MTOP not assigned'} · {record.toda}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusText, { color: meta.fg }]}>{FRANCHISE_RECORD_STATUS_LABEL[status]}</Text>
                </View>
              </View>

              <View style={styles.identifierRow}>
                <View style={styles.identifier}>
                  <Text style={styles.identifierLabel}>BODY NO.</Text>
                  <Text style={styles.identifierValue}>{record.body_number || 'Unassigned'}</Text>
                </View>
                <View style={styles.identifier}>
                  <Text style={styles.identifierLabel}>PLATE</Text>
                  <Text style={styles.identifierValue}>{record.plate_number}</Text>
                </View>
                <View style={styles.identifier}>
                  <Text style={styles.identifierLabel}>EXPIRY</Text>
                  <Text style={styles.identifierValue}>{record.expiry_date || 'Not set'}</Text>
                </View>
              </View>

              {recent ? (
                <Text style={styles.recentEvent}>Latest: {recent.event_type.replace(/_/g, ' ')} · {recent.effective_date}</Text>
              ) : null}

              <View style={styles.actionWrap}>
                <ActionChip label="Details" icon="pencil-outline" onPress={() => openAction(record, 'details')} />
                <ActionChip label="Renew" icon="calendar-refresh" onPress={() => openAction(record, 'renewal')} />
                <ActionChip label="Succession" icon="account-switch-outline" onPress={() => openAction(record, 'succession_transfer')} />
                <ActionChip label="Third party" icon="handshake-outline" onPress={() => openAction(record, 'third_party_transfer')} />
                <ActionChip label="Violation" icon="alert-outline" onPress={() => openAction(record, 'violation')} />
                <ActionChip label="Terminate" icon="file-cancel-outline" onPress={async () => {
                  const ok = await confirm('Terminate franchise', 'This records a formal termination and generates a Kasunduan. Continue?', { confirmText: 'Continue', destructive: true });
                  if (ok) openAction(record, 'termination');
                }} danger />
              </View>
            </View>
          );
        })}

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="book-search-outline" size={44} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No franchise records</Text>
            <Text style={styles.emptyText}>Issued applications will appear here.</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={!!action && !!selected} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{action ? actionTitle(action) : ''}</Text>
                <Text style={styles.sheetSubtitle}>{selected?.mtop_number} · {selected?.plate_number}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={closeModal} accessibilityLabel="Close form">
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {action === 'details' ? (
                <>
                  <Field label="Tricycle body number" value={bodyNumber} onChangeText={setBodyNumber} placeholder="e.g. B-042" />
                  <Field label="Current franchise holder" value={holderName} onChangeText={setHolderName} />
                  <Field label="Expiry date (YYYY-MM-DD)" value={expiryDate} onChangeText={setExpiryDate} />
                  <Text style={styles.fieldLabel}>Operational status</Text>
                  <View style={styles.choiceRow}>
                    {(['active', 'pending_renewal', 'expired'] as const).map((status) => (
                      <Choice key={status} label={FRANCHISE_RECORD_STATUS_LABEL[status]} active={recordStatus === status} onPress={() => setRecordStatus(status)} />
                    ))}
                  </View>
                </>
              ) : null}

              {action === 'renewal' ? (
                <>
                  <Field label="Renewal date (YYYY-MM-DD)" value={effectiveDate} onChangeText={setEffectiveDate} />
                  <Field label="New expiry date (YYYY-MM-DD)" value={expiryDate} onChangeText={setExpiryDate} />
                  <Text style={styles.helper}>Saving this record marks the franchise Active and counts it in the current-year renewal report.</Text>
                </>
              ) : null}

              {action === 'succession_transfer' ? (
                <>
                  <Field label="Eligible successor’s full name" value={recipientName} onChangeText={setRecipientName} />
                  <Text style={styles.fieldLabel}>Relationship</Text>
                  <View style={styles.choiceRow}>
                    <Choice label="Spouse" active={relationship === 'spouse'} onPress={() => setRelationship('spouse')} />
                    <Choice label="Unmarried eldest child" active={relationship === 'unmarried_eldest_child'} onPress={() => setRelationship('unmarried_eldest_child')} />
                  </View>
                  <Field label="Effective date (YYYY-MM-DD)" value={effectiveDate} onChangeText={setEffectiveDate} />
                  <Text style={styles.helper}>Eligibility documents remain subject to TODA/LGU verification.</Text>
                </>
              ) : null}

              {action === 'third_party_transfer' ? (
                <>
                  <Field label="Qualified transferee / buyer" value={recipientName} onChangeText={setRecipientName} />
                  <Field label="Effective date (YYYY-MM-DD)" value={effectiveDate} onChangeText={setEffectiveDate} />
                  <TouchableOpacity style={styles.checkRow} onPress={() => setQualified((value) => !value)} activeOpacity={0.76}>
                    <MaterialCommunityIcons name={qualified ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={qualified ? colors.primary : colors.textMuted} />
                    <Text style={styles.checkText}>TODA/LGU qualifications have been verified</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {action === 'termination' ? (
                <>
                  <Field label="Termination date (YYYY-MM-DD)" value={effectiveDate} onChangeText={setEffectiveDate} />
                  <Field label="Reason for termination" value={reason} onChangeText={setReason} multiline />
                </>
              ) : null}

              {action === 'violation' ? (
                <>
                  <Field label="Violation type" value={violationType} onChangeText={setViolationType} placeholder="e.g. Overcharging" />
                  <Field label="Incident date (YYYY-MM-DD)" value={effectiveDate} onChangeText={setEffectiveDate} />
                  <Field label="Details" value={description} onChangeText={setDescription} multiline />
                  <Field label="Penalty / action (optional)" value={penalty} onChangeText={setPenalty} />
                </>
              ) : null}

              {(action === 'succession_transfer' || action === 'third_party_transfer' || action === 'termination') ? (
                <View style={styles.agreementNote}>
                  <MaterialCommunityIcons name="file-sign" size={20} color={colors.primary} />
                  <Text style={styles.agreementText}>A printable Kasunduan/Agreement will be generated and attached to this lifecycle record.</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving} activeOpacity={0.82}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{action === 'violation' ? 'Record violation' : 'Save record'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const actionTitle = (action: RegistryAction): string => ({
  details: 'Franchise details',
  renewal: 'Record renewal',
  succession_transfer: 'Franchise succession',
  third_party_transfer: 'Third-party transfer',
  termination: 'Terminate franchise',
  violation: 'Record driver violation',
})[action];

const Field = ({ label, multiline = false, ...props }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      {...props}
      style={[styles.input, multiline && styles.multiline]}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
    />
  </View>
);

const Choice = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[styles.choice, active && styles.choiceActive]} onPress={onPress} activeOpacity={0.76}>
    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: layout.headerTop, paddingBottom: spacing.md, paddingHorizontal: spacing.sm, paddingRight: spacing.screen, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, fontSize: 22, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  content: { padding: spacing.screen, paddingBottom: layout.contentBottom },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  summaryCard: { flex: 1, borderRadius: radius.lg, backgroundColor: colors.primary, padding: spacing.md, minHeight: 96, justifyContent: 'center' },
  summaryValue: { ...typography.h1, color: '#fff', fontSize: 30 },
  summaryLabel: { ...typography.bodySmall, color: 'rgba(255,255,255,0.82)' },
  filters: { gap: spacing.sm, paddingBottom: spacing.lg },
  filterChip: { height: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  filterTextActive: { color: '#fff' },
  card: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface, marginBottom: spacing.md, ...shadows.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  holder: { ...typography.h3, color: colors.text },
  mtop: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { borderRadius: radius.pill, paddingHorizontal: 10, minHeight: 28, justifyContent: 'center' },
  statusText: { ...typography.labelSmall, fontSize: 11 },
  identifierRow: { flexDirection: 'row', marginTop: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderLight },
  identifier: { flex: 1 },
  identifierLabel: { ...typography.labelSmall, fontSize: 9, color: colors.textMuted, letterSpacing: 0.8 },
  identifierValue: { ...typography.label, fontSize: 12, color: colors.text, marginTop: 3 },
  recentEvent: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, textTransform: 'capitalize' },
  actionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.md, paddingHorizontal: 11, backgroundColor: colors.surfaceAlt },
  actionChipDanger: { backgroundColor: colors.errorLight },
  actionChipText: { ...typography.labelSmall, color: colors.primary, fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.h3, marginTop: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  sheetTitle: { ...typography.h2, fontSize: 21 },
  sheetSubtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: spacing.md },
  fieldLabel: { ...typography.label, fontSize: 13, color: colors.text, marginBottom: spacing.sm },
  input: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, ...typography.body, color: colors.text },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  helper: { ...typography.bodySmall, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.md },
  choiceRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  choice: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { ...typography.labelSmall, color: colors.textSecondary, textAlign: 'center' },
  choiceTextActive: { color: '#fff' },
  checkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  checkText: { ...typography.body, color: colors.text, flex: 1 },
  agreementNote: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  agreementText: { ...typography.bodySmall, color: colors.primaryDark, flex: 1 },
  saveBtn: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  saveText: { ...typography.button, color: '#fff' },
});

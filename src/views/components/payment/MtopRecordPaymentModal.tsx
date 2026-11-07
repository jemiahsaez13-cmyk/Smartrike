/**
 * MtopRecordPaymentModal
 *
 * B2: the admin records an MTOP payment received by the office (migration
 * 086): amount, payment date, method and OR / reference number. Recording it
 * marks the fee paid and moves the application to Approved. The driver no
 * longer uploads proof.
 *
 * Same bottom-sheet design as MtopBillingModal.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  FranchiseApplication,
  MTOP_PAYMENT_METHOD_LABEL,
  MtopPaymentMethodKind,
  mtopDueDate,
} from '@/models/entities/Franchise';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

export interface RecordPaymentInput {
  amount: number;
  paidOn: string;
  method: MtopPaymentMethodKind;
  reference: string;
}

interface Props {
  visible: boolean;
  application: FranchiseApplication | null;
  onConfirm: (app: FranchiseApplication, input: RecordPaymentInput) => Promise<void>;
  onClose: () => void;
}

const METHODS: Array<{ key: MtopPaymentMethodKind; icon: string }> = [
  { key: 'cash', icon: 'cash' },
  { key: 'gcash', icon: 'cellphone' },
  { key: 'bank', icon: 'bank-outline' },
  { key: 'check', icon: 'checkbook' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const validDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());
const longDate = (v?: string | null) =>
  v ? new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const MtopRecordPaymentModal = ({ visible, application, onConfirm, onClose }: Props) => {
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(isoDate(new Date()));
  const [method, setMethod] = useState<MtopPaymentMethodKind>('cash');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !application) return;
    setAmount(Number(application.fees ?? 0).toFixed(2));
    setPaidOn(isoDate(new Date()));
    setMethod('cash');
    setReference('');
  }, [visible, application]);

  const fees = Number(application?.fees ?? 0);
  const amountValue = Number(amount.replace(/,/g, ''));
  const today = isoDate(new Date());
  const yesterday = isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const ref = reference.trim().toUpperCase();

  const amountError = !amount.trim() || !Number.isFinite(amountValue)
    ? 'Enter the amount paid.'
    : amountValue < fees
    ? `Partial payments are not accepted. Record the full ₱${fees.toFixed(2)}.`
    : null;
  const dateError = !validDate(paidOn)
    ? 'Use the format YYYY-MM-DD.'
    : paidOn > today
    ? 'The payment date cannot be in the future.'
    : null;
  const refError = ref && !/^[A-Z0-9][A-Z0-9 /_-]{2,63}$/.test(ref)
    ? '3 to 64 letters or digits.'
    : null;
  const canSave = !amountError && !dateError && !!ref && !refError && !saving;

  const handleConfirm = async () => {
    if (!application || !canSave) return;
    setSaving(true);
    try {
      await onConfirm(application, { amount: amountValue, paidOn, method, reference: ref });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View style={styles.headCopy}>
              <Text style={styles.headTitle}>Record Payment</Text>
              {application ? (
                <Text style={styles.headSub} numberOfLines={1}>
                  {application.driver_name} · {application.plate_number}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={saving}>
              <MaterialCommunityIcons name="close" size={23} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {application ? (
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="file-document-outline" size={18} color={colors.primary} />
                  <Text style={styles.summaryLabel}>Statement</Text>
                  <Text style={styles.summaryValue}>{application.billing_statement_no || '—'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="calendar-alert" size={18} color={colors.primary} />
                  <Text style={styles.summaryLabel}>Due</Text>
                  <Text style={styles.summaryValue}>{longDate(mtopDueDate(application))}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="cash" size={18} color={colors.primary} />
                  <Text style={styles.summaryLabel}>Amount Due</Text>
                  <Text style={styles.summaryFee}>₱{fees.toFixed(2)}</Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>AMOUNT PAID (₱)</Text>
            <TextInput
              style={[styles.input, !!amountError && amount.trim() !== '' && styles.inputError]}
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="1500.00"
              placeholderTextColor={colors.textMuted}
              editable={!saving}
            />
            {amountError && amount.trim() !== '' ? <Text style={styles.errorText}>{amountError}</Text> : null}

            <Text style={styles.sectionLabel}>PAYMENT DATE</Text>
            <View style={styles.chipRow}>
              {[{ label: 'Today', value: today }, { label: 'Yesterday', value: yesterday }].map((d) => (
                <TouchableOpacity
                  key={d.label}
                  style={[styles.chip, paidOn === d.value && styles.chipActive]}
                  onPress={() => setPaidOn(d.value)}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, paidOn === d.value && styles.chipTextActive]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, !!dateError && styles.inputError]}
              value={paidOn}
              onChangeText={(v) => setPaidOn(v.replace(/[^0-9-]/g, '').slice(0, 10))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              editable={!saving}
            />
            {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}

            <Text style={styles.sectionLabel}>PAID VIA</Text>
            <View style={styles.chipRow}>
              {METHODS.map((m) => {
                const active = method === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setMethod(m.key)}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name={m.icon as any} size={15} color={active ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{MTOP_PAYMENT_METHOD_LABEL[m.key]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>OFFICIAL RECEIPT (OR) / REFERENCE NO.</Text>
            <TextInput
              style={[styles.input, !!refError && styles.inputError]}
              value={reference}
              onChangeText={setReference}
              placeholder={method === 'cash' || method === 'check' ? 'e.g. OR 0012345' : 'e.g. GCash ref. 1029384756'}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={64}
              editable={!saving}
            />
            {refError ? <Text style={styles.errorText}>{refError}</Text> : null}

            <Text style={styles.note}>
              Recording the payment marks the fee paid and approves the application. The driver is notified and sees the
              receipt details in their Franchise tab.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !canSave && styles.disabled]}
                onPress={handleConfirm}
                disabled={!canSave}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-decagram-outline" size={18} color="#fff" />
                    <Text style={styles.confirmText}>Record Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headCopy: { flex: 1, minWidth: 0 },
  headTitle: { ...typography.h2, fontSize: 20 },
  headSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, paddingBottom: 48 },
  summary: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryLabel: { ...typography.bodySmall, color: colors.textSecondary, width: 90 },
  summaryValue: { ...typography.label, color: colors.text, flex: 1 },
  summaryFee: { ...typography.h3, color: colors.primary, flex: 1 },
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.error },
  errorText: { ...typography.bodySmall, fontSize: 12, color: colors.error, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  note: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { ...typography.button, color: colors.textSecondary },
  confirmBtn: {
    flex: 2,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  confirmText: { ...typography.button, color: '#fff' },
  disabled: { opacity: 0.45 },
});

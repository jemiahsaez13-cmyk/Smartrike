/**
 * MtopBillingModal
 *
 * Confirmation popup the admin opens when they want to send a billing
 * notification to an MTOP applicant. Shows all enabled payment methods so the
 * admin can pick ONE OR MORE options to include in the billing, then confirms.
 *
 * Face-to-face methods display the venue address.
 * GCash / Bank methods display account details and an optional QR code.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminMtopPaymentMethod } from '@/models/entities/AdminMtopPaymentMethod';
import { AdminMtopPaymentService } from '@/models/services/AdminMtopPaymentService';
import { FranchiseApplication } from '@/models/entities/Franchise';
import { notify } from '@/utils/confirm';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const service = new AdminMtopPaymentService();

interface Props {
  visible: boolean;
  application: FranchiseApplication | null;
  /** Called with ALL selected payment methods once the admin confirms. */
  onConfirm: (app: FranchiseApplication, methods: AdminMtopPaymentMethod[]) => Promise<void>;
  onClose: () => void;
}

const METHOD_ICON: Record<string, string> = {
  gcash: 'cellphone',
  bank: 'bank-outline',
  face_to_face: 'map-marker-outline',
};

const METHOD_LABEL: Record<string, string> = {
  gcash: 'GCash',
  bank: 'Bank Transfer',
  face_to_face: 'Face-to-Face',
};

const METHOD_COLOR: Record<string, string> = {
  gcash: '#0066FF',
  bank: '#2E7D32',
  face_to_face: '#E65100',
};

export const MtopBillingModal = ({ visible, application, onConfirm, onClose }: Props) => {
  const [methods, setMethods] = useState<AdminMtopPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  // Fetch enabled payment methods whenever the modal opens.
  useEffect(() => {
    if (!visible) return;
    setSelectedIds(new Set());
    setLoadingMethods(true);
    service
      .listEnabledMethods()
      .then(setMethods)
      .catch((err: any) =>
        notify('Could not load methods', err?.message || 'Please try again.')
      )
      .finally(() => setLoadingMethods(false));
  }, [visible]);

  const toggleMethod = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(methods.map((m) => m.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = async () => {
    if (!application || selectedIds.size === 0) return;
    const chosen = methods.filter((m) => selectedIds.has(m.id));
    setConfirming(true);
    try {
      await onConfirm(application, chosen);
    } finally {
      setConfirming(false);
    }
  };

  const selectedMethods = methods.filter((m) => selectedIds.has(m.id));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !confirming && onClose()}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.head}>
            <View style={styles.headCopy}>
              <Text style={styles.headTitle}>Send Billing</Text>
              {application ? (
                <Text style={styles.headSub} numberOfLines={1}>
                  {application.driver_name} · {application.plate_number}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              disabled={confirming}
            >
              <MaterialCommunityIcons name="close" size={23} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Applicant & fee summary */}
            {application ? (
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons
                    name="card-account-details-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.summaryLabel}>Applicant</Text>
                  <Text style={styles.summaryValue}>{application.driver_name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="car" size={18} color={colors.primary} />
                  <Text style={styles.summaryLabel}>Plate</Text>
                  <Text style={styles.summaryValue}>{application.plate_number}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="cash" size={18} color={colors.primary} />
                  <Text style={styles.summaryLabel}>Amount Due</Text>
                  <Text style={styles.summaryFee}>
                    ₱{Number(application.fees ?? 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Payment method picker */}
            <View style={styles.sectionRow}>
              <View style={styles.sectionLeft}>
                <Text style={styles.sectionLabel}>PAYMENT METHODS</Text>
                <Text style={styles.sectionHint}>
                  Select one or more methods the applicant can use to pay.
                </Text>
              </View>
              {methods.length > 0 && !loadingMethods && (
                <View style={styles.selectAllRow}>
                  <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn} activeOpacity={0.7}>
                    <Text style={styles.selectAllText}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={clearAll} style={styles.selectAllBtn} activeOpacity={0.7}>
                    <Text style={styles.selectAllText}>None</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {loadingMethods ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Loading payment methods…</Text>
              </View>
            ) : methods.length === 0 ? (
              <View style={styles.emptyMethods}>
                <MaterialCommunityIcons name="alert-circle-outline" size={36} color={colors.warning} />
                <Text style={styles.emptyTitle}>No payment methods configured</Text>
                <Text style={styles.emptyText}>
                  Go to Account → MTOP Billing Methods to add at least one option first.
                </Text>
              </View>
            ) : (
              methods.map((method) => {
                const active = selectedIds.has(method.id);
                const methodColor = METHOD_COLOR[method.method_type] || colors.primary;
                return (
                  <TouchableOpacity
                    key={method.id}
                    style={[styles.methodCard, active && styles.methodCardActive]}
                    onPress={() => toggleMethod(method.id)}
                    activeOpacity={0.8}
                  >
                    {/* Checkbox */}
                    <View style={[styles.checkbox, active && styles.checkboxActive, { borderColor: active ? methodColor : colors.border }]}>
                      {active && (
                        <MaterialCommunityIcons name="check" size={14} color="#fff" />
                      )}
                    </View>

                    {/* QR thumb / icon */}
                    {method.qr_code_url ? (
                      <Image
                        source={{ uri: method.qr_code_url }}
                        style={styles.qrThumb}
                      />
                    ) : (
                      <View style={[styles.iconBox, { backgroundColor: active ? methodColor + '22' : colors.primaryLight }]}>
                        <MaterialCommunityIcons
                          name={METHOD_ICON[method.method_type] as any}
                          size={24}
                          color={active ? methodColor : colors.primary}
                        />
                      </View>
                    )}

                    {/* Details */}
                    <View style={styles.methodDetails}>
                      <View style={styles.methodTitleRow}>
                        <Text style={[styles.methodName, active && { color: colors.text }]}>
                          {method.display_name}
                        </Text>
                        <View
                          style={[
                            styles.typeBadge,
                            active && { backgroundColor: methodColor + '18' },
                          ]}
                        >
                          <Text style={[styles.typeBadgeText, active && { color: methodColor }]}>
                            {METHOD_LABEL[method.method_type]}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.methodHolder}>
                        {method.account_name}
                      </Text>

                      {method.method_type !== 'face_to_face' && method.account_number ? (
                        <Text style={[styles.methodNumber, active && { color: methodColor }]}>
                          {method.account_number}
                        </Text>
                      ) : null}

                      {method.method_type === 'face_to_face' && method.address ? (
                        <View style={styles.addressRow}>
                          <MaterialCommunityIcons
                            name="map-marker"
                            size={14}
                            color={active ? methodColor : colors.textMuted}
                          />
                          <Text style={styles.methodAddress} numberOfLines={2}>
                            {method.address}
                          </Text>
                        </View>
                      ) : null}

                      {method.instructions ? (
                        <Text style={styles.methodNote} numberOfLines={2}>
                          {method.instructions}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {/* Selected count summary */}
            {selectedIds.size > 0 && (
              <View style={styles.selectedSummary}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.selectedSummaryText}>
                  {selectedIds.size} method{selectedIds.size !== 1 ? 's' : ''} selected:{' '}
                  {selectedMethods.map((m) => m.display_name).join(', ')}
                </Text>
              </View>
            )}

            {/* Confirm / cancel */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={confirming}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  (selectedIds.size === 0 || confirming) && styles.disabled,
                ]}
                onPress={handleConfirm}
                disabled={selectedIds.size === 0 || confirming}
              >
                {confirming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send-outline" size={18} color="#fff" />
                    <Text style={styles.confirmText}>
                      Send Billing{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
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
  // Summary
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
  // Section header
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionLeft: { flex: 1 },
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sectionHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  selectAllRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: 2,
  },
  selectAllBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  selectAllText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  // Loading / empty states
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingText: { ...typography.body, color: colors.textSecondary },
  emptyMethods: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.h3, fontSize: 16 },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  // Method cards
  methodCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  methodCardActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  // Checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  qrThumb: { width: 48, height: 48, borderRadius: radius.sm, flexShrink: 0 },
  methodDetails: { flex: 1, minWidth: 0 },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  methodName: { ...typography.label, fontSize: 15, color: colors.text },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  typeBadgeText: { ...typography.labelSmall, color: colors.primary, fontSize: 10 },
  methodHolder: { ...typography.bodySmall, color: colors.textSecondary },
  methodNumber: { ...typography.label, color: colors.primary, marginTop: 3 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 3 },
  methodAddress: { ...typography.bodySmall, color: colors.textMuted, flex: 1 },
  methodNote: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Selected summary pill
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  selectedSummaryText: {
    ...typography.bodySmall,
    color: colors.success,
    flex: 1,
    lineHeight: 18,
  },
  // Actions row
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
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

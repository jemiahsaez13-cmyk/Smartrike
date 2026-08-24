/**
 * MtopBillingModal
 *
 * Confirmation popup the admin opens when they want to send a billing
 * notification to an MTOP applicant. Shows all enabled payment methods so the
 * admin can choose which option to include in the billing, then confirms.
 *
 * Face-to-face methods display the venue address and a read-only map pin.
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
import MapView, { Marker } from '@/config/maps';
import { AdminMtopPaymentMethod } from '@/models/entities/AdminMtopPaymentMethod';
import { AdminMtopPaymentService } from '@/models/services/AdminMtopPaymentService';
import { FranchiseApplication } from '@/models/entities/Franchise';
import { notify } from '@/utils/confirm';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const service = new AdminMtopPaymentService();

interface Props {
  visible: boolean;
  application: FranchiseApplication | null;
  /** Called with the selected payment method once the admin confirms. */
  onConfirm: (app: FranchiseApplication, method: AdminMtopPaymentMethod) => Promise<void>;
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

export const MtopBillingModal = ({ visible, application, onConfirm, onClose }: Props) => {
  const [methods, setMethods] = useState<AdminMtopPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [selected, setSelected] = useState<AdminMtopPaymentMethod | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Fetch enabled payment methods whenever the modal opens.
  useEffect(() => {
    if (!visible) return;
    setSelected(null);
    setLoadingMethods(true);
    service
      .listEnabledMethods()
      .then(setMethods)
      .catch((err: any) =>
        notify('Could not load methods', err?.message || 'Please try again.')
      )
      .finally(() => setLoadingMethods(false));
  }, [visible]);

  const handleConfirm = async () => {
    if (!application || !selected) return;
    setConfirming(true);
    try {
      await onConfirm(application, selected);
    } finally {
      setConfirming(false);
    }
  };

  const isFaceToFace = selected?.method_type === 'face_to_face';
  const hasPin =
    isFaceToFace &&
    selected?.location_lat != null &&
    selected?.location_lng != null;

  const pinCoord =
    hasPin
      ? { latitude: selected!.location_lat!, longitude: selected!.location_lng! }
      : null;

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
            <Text style={styles.sectionLabel}>SELECT PAYMENT METHOD</Text>
            <Text style={styles.sectionHint}>
              Choose how the applicant should pay the MTOP fee.
            </Text>

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
                const active = selected?.id === method.id;
                return (
                  <TouchableOpacity
                    key={method.id}
                    style={[styles.methodCard, active && styles.methodCardActive]}
                    onPress={() => setSelected(method)}
                    activeOpacity={0.8}
                  >
                    {/* Selection indicator */}
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && (
                        <View style={styles.radioDot} />
                      )}
                    </View>

                    {/* QR / icon */}
                    {method.qr_code_url ? (
                      <Image
                        source={{ uri: method.qr_code_url }}
                        style={styles.qrThumb}
                      />
                    ) : (
                      <View style={styles.iconBox}>
                        <MaterialCommunityIcons
                          name={METHOD_ICON[method.method_type] as any}
                          size={24}
                          color={active ? '#fff' : colors.primary}
                        />
                      </View>
                    )}

                    {/* Details */}
                    <View style={styles.methodDetails}>
                      <View style={styles.methodTitleRow}>
                        <Text style={[styles.methodName, active && styles.methodNameActive]}>
                          {method.display_name}
                        </Text>
                        <View
                          style={[
                            styles.typeBadge,
                            active && styles.typeBadgeActive,
                          ]}
                        >
                          <Text style={[styles.typeBadgeText, active && styles.typeBadgeTextActive]}>
                            {METHOD_LABEL[method.method_type]}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.methodHolder, active && styles.methodHolderActive]}>
                        {method.account_name}
                      </Text>

                      {method.method_type !== 'face_to_face' && method.account_number ? (
                        <Text style={[styles.methodNumber, active && styles.methodNumberActive]}>
                          {method.account_number}
                        </Text>
                      ) : null}

                      {method.method_type === 'face_to_face' && method.address ? (
                        <View style={styles.addressRow}>
                          <MaterialCommunityIcons
                            name="map-marker"
                            size={14}
                            color={active ? 'rgba(255,255,255,0.8)' : colors.textMuted}
                          />
                          <Text
                            style={[styles.methodAddress, active && styles.methodAddressActive]}
                            numberOfLines={2}
                          >
                            {method.address}
                          </Text>
                        </View>
                      ) : null}

                      {method.instructions ? (
                        <Text
                          style={[styles.methodNote, active && styles.methodNoteActive]}
                          numberOfLines={2}
                        >
                          {method.instructions}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {/* Selected method detail: map pin (face_to_face) or full QR */}
            {selected && isFaceToFace && (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>Payment Location</Text>
                {selected.address ? (
                  <View style={styles.addressDetail}>
                    <MaterialCommunityIcons
                      name="map-marker-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.addressDetailText}>{selected.address}</Text>
                  </View>
                ) : null}
                {hasPin && pinCoord ? (
                  <View style={styles.mapContainer}>
                    <MapView
                      style={styles.map}
                      initialRegion={{
                        ...pinCoord,
                        latitudeDelta: 0.015,
                        longitudeDelta: 0.015,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                    >
                      <Marker coordinate={pinCoord} title="Payment location" />
                    </MapView>
                    <Text style={styles.mapCaption}>
                      {pinCoord.latitude.toFixed(6)}, {pinCoord.longitude.toFixed(6)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.noPinNote}>
                    <MaterialCommunityIcons
                      name="map-marker-off-outline"
                      size={18}
                      color={colors.textMuted}
                    />
                    <Text style={styles.noPinText}>No map pin set for this location.</Text>
                  </View>
                )}
              </View>
            )}

            {selected && !isFaceToFace && selected.qr_code_url ? (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>QR Code</Text>
                <Image
                  source={{ uri: selected.qr_code_url }}
                  style={styles.qrFull}
                  resizeMode="contain"
                />
              </View>
            ) : null}

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
                  (!selected || confirming) && styles.disabled,
                ]}
                onPress={handleConfirm}
                disabled={!selected || confirming}
              >
                {confirming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send-outline" size={18} color="#fff" />
                    <Text style={styles.confirmText}>Send Billing</Text>
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
  // Section labels
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.md,
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
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioActive: {
    borderColor: '#fff',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrThumb: { width: 48, height: 48, borderRadius: radius.sm },
  methodDetails: { flex: 1, minWidth: 0 },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  methodName: { ...typography.label, fontSize: 15, color: colors.text },
  methodNameActive: { color: '#fff' },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  typeBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  typeBadgeText: { ...typography.labelSmall, color: colors.primary, fontSize: 10 },
  typeBadgeTextActive: { color: '#fff' },
  methodHolder: { ...typography.bodySmall, color: colors.textSecondary },
  methodHolderActive: { color: 'rgba(255,255,255,0.85)' },
  methodNumber: { ...typography.label, color: colors.primary, marginTop: 3 },
  methodNumberActive: { color: '#fff' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 3 },
  methodAddress: { ...typography.bodySmall, color: colors.textMuted, flex: 1 },
  methodAddressActive: { color: 'rgba(255,255,255,0.8)' },
  methodNote: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  methodNoteActive: { color: 'rgba(255,255,255,0.7)' },
  // Detail cards (map / full QR)
  detailCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  detailTitle: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
  addressDetail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  addressDetailText: { ...typography.body, color: colors.text, flex: 1 },
  mapContainer: { overflow: 'hidden', borderRadius: radius.md },
  map: { width: '100%', height: 200, borderRadius: radius.md },
  mapCaption: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  noPinNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  noPinText: { ...typography.bodySmall, color: colors.textMuted },
  qrFull: { width: '100%', height: 220, borderRadius: radius.md },
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
  disabled: { opacity: 0.5 },
});

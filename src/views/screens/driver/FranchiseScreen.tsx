import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, ScrollView, TextInput, TouchableOpacity, View, Modal } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { fetchMyApplication, submitApplication, submitFranchisePayment, submitFaceToFaceAppointment, patchApplication } from '@/controllers/slices/franchiseSlice';
import {
  REQUIRED_DOCUMENTS,
  FRANCHISE_FLOW,
  FRANCHISE_STATUS_LABEL,
  DOCUMENT_REVIEW_LABEL,
  FranchiseType,
  FranchiseDocument,
  docReviewStatus,
  anyDocumentRejected,
  FRANCHISE_RECORD_STATUS_LABEL,
} from '@/models/entities/Franchise';
import { AdminMtopPaymentMethod } from '@/models/entities/AdminMtopPaymentMethod';
import { AdminMtopPaymentService } from '@/models/services/AdminMtopPaymentService';
import { supabase, isSupabaseConfigured } from '@/config/supabase';
import { colors, spacing, shadows, typography, radius, layout } from '@/views/styles/theme';
import { confirm, notify } from '@/utils/confirm';
import { Loading } from '@/views/components/common/Loading';
import { Button } from '@/views/components/common/Button';
import { Card } from '@/views/components/common/Card';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { pickImageDataUri } from '@/utils/pickImageDataUri';
import { SUPPORT } from '@/config/constants';

// ─────────────────────────────────────────────────────────────────────────────
// Inline date picker — renders a modal with a scrollable 30-day calendar strip
// ─────────────────────────────────────────────────────────────────────────────
const InlineDatePicker = ({
  visible,
  currentDate,
  minDate,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  currentDate: Date;
  minDate: Date;
  onConfirm: (d: Date) => void;
  onClose: () => void;
}) => {
  // Build a list of the next 30 days from minDate
  const days: Date[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(minDate);
    d.setDate(d.getDate() + i);
    d.setHours(currentDate.getHours(), currentDate.getMinutes(), 0, 0);
    return d;
  });
  const [selected, setSelected] = useState<Date>(days[0]);
  useEffect(() => {
    if (visible) setSelected(days[0]);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.head}>
            <Text style={pickerStyles.headTitle}>Select Date</Text>
            <TouchableOpacity onPress={onClose} style={pickerStyles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={pickerStyles.listContent} showsVerticalScrollIndicator={false}>
            {days.map((day, i) => {
              const isSelected =
                day.toDateString() === selected.toDateString();
              return (
                <TouchableOpacity
                  key={i}
                  style={[pickerStyles.item, isSelected && pickerStyles.itemActive]}
                  onPress={() => setSelected(day)}
                  activeOpacity={0.8}
                >
                  <Text style={[pickerStyles.itemText, isSelected && pickerStyles.itemTextActive]}>
                    {day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  {isSelected && <MaterialCommunityIcons name="check" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={pickerStyles.footer}>
            <TouchableOpacity style={pickerStyles.confirmBtn} onPress={() => onConfirm(selected)} activeOpacity={0.85}>
              <Text style={pickerStyles.confirmText}>Confirm Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Inline time picker — renders a modal with office-hour slots (7am – 5pm)
// ─────────────────────────────────────────────────────────────────────────────
const HOUR_SLOTS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const MINUTE_OPTS = [0, 30];

const InlineTimePicker = ({
  visible,
  currentDate,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  currentDate: Date;
  onConfirm: (d: Date) => void;
  onClose: () => void;
}) => {
  const [selHour, setSelHour] = useState(9);
  const [selMinute, setSelMinute] = useState(0);
  useEffect(() => {
    if (visible) {
      setSelHour(Math.min(17, Math.max(7, currentDate.getHours())));
      setSelMinute(currentDate.getMinutes() < 30 ? 0 : 30);
    }
  }, [visible]);

  const fmtTime = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.head}>
            <Text style={pickerStyles.headTitle}>Select Time</Text>
            <TouchableOpacity onPress={onClose} style={pickerStyles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={pickerStyles.listContent} showsVerticalScrollIndicator={false}>
            {HOUR_SLOTS.flatMap((h) =>
              MINUTE_OPTS.map((m) => {
                const isSelected = h === selHour && m === selMinute;
                return (
                  <TouchableOpacity
                    key={`${h}-${m}`}
                    style={[pickerStyles.item, isSelected && pickerStyles.itemActive]}
                    onPress={() => { setSelHour(h); setSelMinute(m); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[pickerStyles.itemText, isSelected && pickerStyles.itemTextActive]}>
                      {fmtTime(h, m)}
                    </Text>
                    {isSelected && <MaterialCommunityIcons name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          <View style={pickerStyles.footer}>
            <TouchableOpacity
              style={pickerStyles.confirmBtn}
              onPress={() => {
                const merged = new Date(currentDate);
                merged.setHours(selHour, selMinute, 0, 0);
                onConfirm(merged);
              }}
              activeOpacity={0.85}
            >
              <Text style={pickerStyles.confirmText}>Confirm Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const pickerStyles = StyleSheet.create({
  // ── Loading state ──
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headTitle: { ...typography.h2, fontSize: 18 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginVertical: 2,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  itemText: { ...typography.label, color: colors.textSecondary, fontSize: 15 },
  itemTextActive: { color: colors.primary },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  confirmBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { ...typography.button, color: '#fff' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Payment Method Detail Card — shown when the driver taps a method in Pay Now
// ─────────────────────────────────────────────────────────────────────────────
const METHOD_ICON: Record<string, string> = {
  gcash: 'cellphone',
  bank: 'bank-outline',
  face_to_face: 'map-marker-outline',
};
const METHOD_LABEL: Record<string, string> = {
  gcash: 'GCash',
  bank: 'Bank Transfer',
  face_to_face: 'Pay in Person',
};
const METHOD_COLOR: Record<string, string> = {
  gcash: '#0066FF',
  bank: '#2E7D32',
  face_to_face: '#E65100',
};

interface PayNowModalProps {
  visible: boolean;
  fees: number;
  paymentProof: string;
  paymentReference: string;
  submitting: boolean;
  paymentReviewStatus?: string | null;
  paymentRejectionReason?: string | null;
  onPickProof: () => void;
  onChangeReference: (v: string) => void;
  onSubmit: (method: AdminMtopPaymentMethod) => void;
  /** Called when driver picks a face-to-face date — sends the appointment */
  onSubmitAppointment: (method: AdminMtopPaymentMethod, date: Date) => void;
  onClose: () => void;
}

// Format a Date to a human-readable local string
const formatApptDate = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) +
  ' ' +
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const paymentService = new AdminMtopPaymentService();

const PayNowModal = ({
  visible,
  fees,
  paymentProof,
  paymentReference,
  submitting,
  paymentReviewStatus,
  paymentRejectionReason,
  onPickProof,
  onChangeReference,
  onSubmit,
  onSubmitAppointment,
  onClose,
}: PayNowModalProps) => {
  // Self-fetched enabled methods — driver always sees the live admin configuration
  const [methods, setMethods] = useState<AdminMtopPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);

  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  // Date-picker state (face-to-face flow)
  const minDate = new Date(Date.now() + 60 * 60 * 1000); // min = 1 hr from now
  const buildDefault = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  };
  const [appointmentDate, setAppointmentDate] = useState<Date>(buildDefault);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);

  // Fetch enabled methods every time the modal opens
  useEffect(() => {
    if (!visible) return;
    setSelectedMethodId(null);
    setAppointmentDate(buildDefault());
    setLoadingMethods(true);
    paymentService
      .listEnabledMethods()
      .then((list) => {
        setMethods(list);
        // Auto-select when there's only one option
        if (list.length === 1) setSelectedMethodId(list[0].id);
      })
      .catch(() => setMethods([]))
      .finally(() => setLoadingMethods(false));
  }, [visible]);

  const selectedMethod = methods.find((m) => m.id === selectedMethodId) ?? null;
  const isFaceToFace = selectedMethod?.method_type === 'face_to_face';

  const canSubmitProof =
    !!paymentProof && paymentReference.trim().length >= 6 && !submitting;
  const canSubmitAppt =
    isFaceToFace && !!selectedMethodId && !submitting && appointmentDate >= minDate;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          {/* Header */}
          <View style={modalStyles.head}>
            <View style={modalStyles.headIconBox}>
              <MaterialCommunityIcons name="cash-multiple" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.headTitle}>MTOP Payment</Text>
              <Text style={modalStyles.headSub}>
                Amount due: <Text style={modalStyles.headFee}>₱{Number(fees).toFixed(2)}</Text>
              </Text>
            </View>
            <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose} disabled={submitting}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={modalStyles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Rejection notice */}
            {paymentReviewStatus === 'rejected' && (
              <View style={modalStyles.rejectedBanner}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={colors.error} />
                <Text style={modalStyles.rejectedText}>
                  {paymentRejectionReason || 'Your previous proof was rejected. Please re-submit.'}
                </Text>
              </View>
            )}

            {/* Loading methods */}
            {loadingMethods ? (
              <View style={modalStyles.loadingBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={modalStyles.loadingText}>Loading payment methods…</Text>
              </View>
            ) : (

            /* ── CASE A: Admin configured billed methods ── */
            methods.length > 0 ? (
              <>
                <Text style={modalStyles.sectionLabel}>
                  {methods.length === 1 ? 'PAYMENT METHOD' : 'SELECT PAYMENT METHOD'}
                </Text>
                {methods.length > 1 && (
                  <Text style={modalStyles.sectionHint}>
                    Tap the method you want to use. The payment instructions will expand below it.
                  </Text>
                )}

                {methods.map((method) => {
                  const active = selectedMethodId === method.id;
                  const mColor = METHOD_COLOR[method.method_type] || colors.primary;
                  const isF2F = method.method_type === 'face_to_face';

                  return (
                    <View key={method.id}>
                      {/* ── Tap-to-select card ── */}
                      <TouchableOpacity
                        style={[
                          modalStyles.methodCard,
                          active && { borderColor: mColor, backgroundColor: mColor + '08', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
                        ]}
                        onPress={() => setSelectedMethodId(active ? null : method.id)}
                        activeOpacity={0.8}
                      >
                        <View style={[modalStyles.radio, active && { borderColor: mColor }]}>
                          {active && <View style={[modalStyles.radioDot, { backgroundColor: mColor }]} />}
                        </View>
                        <View style={[modalStyles.methodIcon, { backgroundColor: mColor + '15' }]}>
                          <MaterialCommunityIcons
                            name={METHOD_ICON[method.method_type] as any}
                            size={22}
                            color={mColor}
                          />
                        </View>
                        <View style={modalStyles.methodInfo}>
                          <View style={modalStyles.methodTitleRow}>
                            <Text style={[modalStyles.methodName, active && { color: mColor }]}>
                              {method.display_name}
                            </Text>
                            <View style={[modalStyles.methodBadge, { backgroundColor: mColor + '15' }]}>
                              <Text style={[modalStyles.methodBadgeText, { color: mColor }]}>
                                {METHOD_LABEL[method.method_type]}
                              </Text>
                            </View>
                          </View>
                          <Text style={modalStyles.methodHolder}>{method.account_name}</Text>
                          {!isF2F && method.account_number ? (
                            <Text style={[modalStyles.methodNumber, { color: mColor }]}>
                              {method.account_number}
                            </Text>
                          ) : null}
                          {isF2F && method.address ? (
                            <View style={modalStyles.methodAddressRow}>
                              <MaterialCommunityIcons name="map-marker" size={13} color={colors.textMuted} />
                              <Text style={modalStyles.methodAddress}>{method.address}</Text>
                            </View>
                          ) : null}
                          {method.instructions ? (
                            <Text style={modalStyles.methodNote}>{method.instructions}</Text>
                          ) : null}
                          {active && method.qr_code_url ? (
                            <Image source={{ uri: method.qr_code_url }} style={modalStyles.qrCode} resizeMode="contain" />
                          ) : null}
                        </View>
                      </TouchableOpacity>

                      {/* ── Expanded action — only under the selected card ── */}
                      {active && (
                        <View style={[modalStyles.expandedAction, { borderColor: mColor + '30' }]}>
                          {isF2F ? (
                            /* ── Face-to-face: date + time picker ── */
                            <>
                              <Text style={[modalStyles.expandedTitle, { color: mColor }]}>
                                📅  Schedule Your Visit
                              </Text>
                              <Text style={modalStyles.expandedHint}>
                                Choose when you'll bring your payment to the office. The admin will be notified.
                              </Text>

                              <TouchableOpacity style={modalStyles.datePickerBtn} onPress={() => setShowDateModal(true)} activeOpacity={0.8}>
                                <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.primary} />
                                <View style={{ flex: 1 }}>
                                  <Text style={modalStyles.datePickerLabel}>Date</Text>
                                  <Text style={modalStyles.datePickerValue}>
                                    {appointmentDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                  </Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
                              </TouchableOpacity>

                              <TouchableOpacity style={modalStyles.datePickerBtn} onPress={() => setShowTimeModal(true)} activeOpacity={0.8}>
                                <MaterialCommunityIcons name="clock-time-four-outline" size={20} color={colors.primary} />
                                <View style={{ flex: 1 }}>
                                  <Text style={modalStyles.datePickerLabel}>Time</Text>
                                  <Text style={modalStyles.datePickerValue}>
                                    {appointmentDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
                              </TouchableOpacity>

                              <InlineDatePicker
                                visible={showDateModal}
                                currentDate={appointmentDate}
                                minDate={minDate}
                                onConfirm={(d) => { setShowDateModal(false); setAppointmentDate(d); }}
                                onClose={() => setShowDateModal(false)}
                              />
                              <InlineTimePicker
                                visible={showTimeModal}
                                currentDate={appointmentDate}
                                onConfirm={(d) => { setShowTimeModal(false); setAppointmentDate(d); }}
                                onClose={() => setShowTimeModal(false)}
                              />

                              <View style={modalStyles.apptSummary}>
                                <MaterialCommunityIcons name="calendar-check-outline" size={16} color={colors.primary} />
                                <Text style={modalStyles.apptSummaryText}>
                                  {formatApptDate(appointmentDate)}
                                </Text>
                              </View>

                              <Button
                                variant="primary"
                                onPress={() => onSubmitAppointment(method, appointmentDate)}
                                loading={submitting}
                                disabled={!canSubmitAppt}
                                style={modalStyles.submitBtn}
                              >
                                Notify Admin — Confirm Visit
                              </Button>
                            </>
                          ) : (
                            /* ── GCash / Bank: screenshot + reference ── */
                            <>
                              <Text style={[modalStyles.expandedTitle, { color: mColor }]}>
                                📤  Upload Payment Screenshot
                              </Text>
                              <Text style={modalStyles.expandedHint}>
                                Send payment to the account above, then upload your screenshot and enter the reference number.
                              </Text>

                              <TouchableOpacity style={modalStyles.proofPicker} onPress={onPickProof} activeOpacity={0.8}>
                                {paymentProof ? (
                                  <Image source={{ uri: paymentProof }} style={modalStyles.proofImage} resizeMode="contain" />
                                ) : (
                                  <>
                                    <MaterialCommunityIcons name="image-plus" size={36} color={colors.primary} />
                                    <Text style={modalStyles.proofPickerText}>Tap to upload receipt screenshot</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                              {paymentProof ? (
                                <TouchableOpacity onPress={onPickProof} style={modalStyles.replaceProof}>
                                  <MaterialCommunityIcons name="image-edit-outline" size={15} color={colors.accent} />
                                  <Text style={modalStyles.replaceProofText}>Replace screenshot</Text>
                                </TouchableOpacity>
                              ) : null}

                              <Text style={modalStyles.sectionLabel}>REFERENCE / RECEIPT NUMBER</Text>
                              <TextInput
                                style={modalStyles.refInput}
                                value={paymentReference}
                                onChangeText={onChangeReference}
                                placeholder="e.g. GCash ref 123456789 or OR No. 001"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="characters"
                                maxLength={64}
                              />

                              <Button
                                variant="primary"
                                onPress={() => onSubmit(method)}
                                loading={submitting}
                                disabled={!canSubmitProof}
                                style={modalStyles.submitBtn}
                              >
                                Submit Payment for Verification
                              </Button>
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            ) : (
              /* ── CASE B: No billed methods saved — default face-to-face ── */
              <>
                <View style={modalStyles.fallbackBox}>
                  <MaterialCommunityIcons name="map-marker-outline" size={32} color={METHOD_COLOR.face_to_face} />
                  <Text style={modalStyles.fallbackTitle}>Pay in Person</Text>
                  <Text style={modalStyles.fallbackText}>{SUPPORT.office}</Text>
                  <Text style={modalStyles.fallbackAddress}>{SUPPORT.address}</Text>
                </View>

                <Text style={modalStyles.sectionLabel}>SCHEDULE YOUR VISIT</Text>
                <Text style={modalStyles.sectionHint}>
                  Choose when you'll bring your payment to the office. The admin will be notified.
                </Text>

                <TouchableOpacity style={modalStyles.datePickerBtn} onPress={() => setShowDateModal(true)} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={modalStyles.datePickerLabel}>Date</Text>
                    <Text style={modalStyles.datePickerValue}>
                      {appointmentDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity style={modalStyles.datePickerBtn} onPress={() => setShowTimeModal(true)} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="clock-time-four-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={modalStyles.datePickerLabel}>Time</Text>
                    <Text style={modalStyles.datePickerValue}>
                      {appointmentDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <InlineDatePicker
                  visible={showDateModal}
                  currentDate={appointmentDate}
                  minDate={minDate}
                  onConfirm={(d) => { setShowDateModal(false); setAppointmentDate(d); }}
                  onClose={() => setShowDateModal(false)}
                />
                <InlineTimePicker
                  visible={showTimeModal}
                  currentDate={appointmentDate}
                  onConfirm={(d) => { setShowTimeModal(false); setAppointmentDate(d); }}
                  onClose={() => setShowTimeModal(false)}
                />

                <View style={modalStyles.apptSummary}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={16} color={colors.primary} />
                  <Text style={modalStyles.apptSummaryText}>{formatApptDate(appointmentDate)}</Text>
                </View>

                <Button
                  variant="primary"
                  onPress={() => onSubmitAppointment(
                    { id: 'face_to_face_default', admin_id: '', method_type: 'face_to_face', display_name: 'Pay in Person', account_name: '', account_number: null, address: SUPPORT.address, location_lat: null, location_lng: null, instructions: null, qr_code_url: null, is_enabled: true, created_at: '', updated_at: '' } as AdminMtopPaymentMethod,
                    appointmentDate
                  )}
                  loading={submitting}
                  disabled={submitting || appointmentDate < minDate}
                  style={modalStyles.submitBtn}
                >
                  Notify Admin — Confirm Visit
                </Button>
              </>
            )
            /* close loadingMethods ternary */
            )}
          </ScrollView>
        </View>
      </View>

      {/* Pickers rendered outside ScrollView to avoid nesting issues */}
    </Modal>
  );
};

export const FranchiseScreen = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { myApplication, loading } = useAppSelector((state) => state.franchise);
  const driver = user as any;

  const [docs, setDocs] = useState<FranchiseDocument[]>(
    REQUIRED_DOCUMENTS.map((name) => ({
      name,
      uploaded: false,
      file_url: null,
      uploaded_at: null,
      review_status: 'pending' as const,
      review_remarks: null,
    }))
  );
  const [plate, setPlate] = useState<string>(driver?.vehicle_details?.plate_number || 'ABC-1234');
  const [submitting, setSubmitting] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProof, setPaymentProof] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showPayNow, setShowPayNow] = useState(false);

  // Live payment methods — used by the payment summary card when
  // selected_payment_methods was not saved on the application yet.
  const [livePaymentMethods, setLivePaymentMethods] = useState<AdminMtopPaymentMethod[]>([]);
  const [loadingLiveMethods, setLoadingLiveMethods] = useState(false);

  useEffect(() => {
    if (myApplication?.status !== 'payment') return;
    const stored: AdminMtopPaymentMethod[] =
      (myApplication.selected_payment_methods as AdminMtopPaymentMethod[] | null | undefined) ?? [];
    if (stored.length > 0) {
      setLivePaymentMethods(stored);
      return;
    }
    // selected_payment_methods is empty — fetch the admin's live configuration
    setLoadingLiveMethods(true);
    paymentService
      .listEnabledMethods()
      .then((list) => setLivePaymentMethods(list))
      .catch(() => setLivePaymentMethods([]))
      .finally(() => setLoadingLiveMethods(false));
  }, [myApplication?.status, myApplication?.selected_payment_methods]);

  useEffect(() => {
    if (user?.id) dispatch(fetchMyApplication(user.id));
  }, [user?.id]);

  // Live sync: the moment the admin approves/rejects a document or advances
  // the application, this screen updates — no refresh needed.
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    let channel: any;
    try {
      channel = supabase
        .channel(`franchise_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'franchise_applications', filter: `driver_id=eq.${user.id}` },
          () => dispatch(fetchMyApplication(user.id))
        )
        .subscribe();
    } catch {
      /* realtime unavailable — screen still refreshes on focus */
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [user?.id, dispatch]);

  // Pick a real file (image or PDF) and attach it as a data URI so the admin
  // can actually view what was submitted. Re-tapping a row replaces the file.
  const pickDoc = async (idx: number) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      if ((asset.size ?? 0) > 2_500_000) {
        void notify('File too large', 'Please choose a file under 2.5 MB — a clear photo or a compressed PDF.');
        return;
      }
      const mime =
        asset.mimeType || (asset.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      let dataUri: string;
      if (asset.uri.startsWith('data:')) {
        dataUri = asset.uri;
      } else if (Platform.OS === 'web') {
        const blob = await (await fetch(asset.uri)).blob();
        dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        dataUri = `data:${mime};base64,${base64}`;
      }
      setDocs((prev) =>
        prev.map((d, i) =>
          i === idx
            ? {
                ...d,
                uploaded: true,
                uploaded_at: new Date().toISOString(),
                file_url: dataUri,
                file_name: asset.name ?? null,
                review_status: 'pending' as const,
                review_remarks: null,
              }
            : d
        )
      );
    } catch {
      void notify('Could not attach file', 'Please try again.');
    }
  };

  const allUploaded = docs.every((d) => d.uploaded);

  const pickPaymentProof = async () => {
    try { const image = await pickImageDataUri(); if (image) setPaymentProof(image); }
    catch (error: any) { void notify('Could not use image', error?.message || 'Choose another screenshot.'); }
  };

  const handlePaymentSubmit = async (method: AdminMtopPaymentMethod) => {
    if (!myApplication) return;
    setSubmittingPayment(true);
    try {
      await dispatch(submitFranchisePayment({ id: myApplication.id, method: 'in_person', method_id: method.id, reference: paymentReference, proofUrl: paymentProof })).unwrap();
      // Store the chosen method so the driver card and admin card show the right details.
      void dispatch(patchApplication({ id: myApplication.id, patch: { chosen_payment_method_snapshot: method } as any }));
      setPaymentReference(''); setPaymentProof('');
      setShowPayNow(false);
      await notify('Payment proof submitted', 'An administrator will verify the screenshot and reference before approving your MTOP.');
    } catch (error: any) { await notify('Could not submit payment', typeof error === 'string' ? error : error?.message || 'Check the proof and reference.'); }
    finally { setSubmittingPayment(false); }
  };

  const handleAppointmentSubmit = async (method: AdminMtopPaymentMethod, date: Date) => {
    if (!myApplication) return;
    setSubmittingPayment(true);
    try {
      await dispatch(
        submitFaceToFaceAppointment({
          id: myApplication.id,
          appointmentDate: date.toISOString(),
          driverName: myApplication.driver_name,
          plate: myApplication.plate_number,
        })
      ).unwrap();
      // Store the chosen method so the driver card and admin card show the right details.
      void dispatch(patchApplication({ id: myApplication.id, patch: { chosen_payment_method_snapshot: method } as any }));
      setShowPayNow(false);
      await notify(
        'Visit scheduled',
        `Your appointment on ${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} has been sent to the administrator.\n\nHead to ${SUPPORT.office}, ${SUPPORT.address} at the scheduled time with your payment ready.`
      );
    } catch (error: any) {
      await notify('Could not schedule appointment', typeof error === 'string' ? error : error?.message || 'Please try again.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleSubmit = async (type: FranchiseType) => {
    if (!allUploaded) {
      void notify('Incomplete', 'Please upload all required documents first.');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(
        submitApplication({
          driver_id: user!.id,
          driver_name: user!.name,
          toda: driver?.toda_membership || 'FEDTODAB',
          plate_number: plate,
          type,
          documents: docs,
          fees: type === 'renewal' ? 1000 : 1500,
          remarks: null,
        })
      ).unwrap();
      await notify('Submitted', 'Your franchise application has been submitted for review.');
    } catch {
      await notify('Error', 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenew = async () => {
    const yes = await confirm('Renew Franchise', 'Submit a renewal application for your MTOP?', {
      confirmText: 'Renew',
      cancelText: 'Cancel',
    });
    if (yes) handleSubmit('renewal');
  };

  if (loading && !myApplication) return <Loading message="Loading franchise records..." />;

  const isActive = myApplication?.status === 'issued';
  const recordStatus = myApplication?.franchise_status || 'active';
  const recordStatusLabel = FRANCHISE_RECORD_STATUS_LABEL[recordStatus];
  const inProgress =
    myApplication &&
    myApplication.status !== 'issued' &&
    myApplication.status !== 'rejected';

  const Header = ({ subtitle }: { subtitle: string }) => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Franchise (MTOP)</Text>
      <Text style={styles.headerSubtitle}>{subtitle}</Text>
    </View>
  );

  // --- Active MTOP ---
  if (isActive) {
    return (
      <View style={styles.container}>
        <Header subtitle={`Operational status: ${recordStatusLabel}`} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Surface style={styles.mtopCard} elevation={0}>
            <View style={styles.mtopHeader}>
              <View style={styles.mtopBrand}>
                <View style={styles.mtopLogo}>
                  <TricycleIcon size={24} color="#fff" />
                </View>
                <Text style={styles.mtopBrandText}>FEDTODAB MTOP</Text>
              </View>
              <View style={[styles.activeBadge, recordStatus !== 'active' && { backgroundColor: recordStatus === 'expired' || recordStatus === 'terminated' ? colors.error : colors.warning }]}>
                <Text style={styles.activeBadgeText}>{recordStatusLabel.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.mtopBody}>
              <Text style={styles.mtopLabel}>MTOP NUMBER</Text>
              <Text style={styles.mtopNumber}>{myApplication?.mtop_number}</Text>

              <View style={styles.mtopGrid}>
                <View style={styles.mtopItem}>
                  <Text style={styles.mtopLabel}>OPERATOR</Text>
                  <Text style={styles.mtopValue}>{myApplication?.current_holder_name || myApplication?.driver_name}</Text>
                </View>
                <View style={styles.mtopItem}>
                  <Text style={styles.mtopLabel}>PLATE</Text>
                  <Text style={styles.mtopValue}>{myApplication?.plate_number}</Text>
                </View>
              </View>

              <View style={styles.mtopDivider} />

              <View style={styles.mtopFooter}>
                <View>
                  <Text style={styles.mtopLabel}>TODA</Text>
                  <Text style={styles.mtopValue}>{myApplication?.toda}</Text>
                </View>
                <View>
                  <Text style={styles.mtopLabel}>BODY NO.</Text>
                  <Text style={styles.mtopValue}>{myApplication?.body_number || 'Unassigned'}</Text>
                </View>
                <MaterialCommunityIcons name="shield-check" size={24} color={colors.secondary} />
              </View>
            </View>
          </Surface>

          {recordStatus !== 'terminated' && recordStatus !== 'transferred' ? (
            <Button
              variant="outline"
              onPress={handleRenew}
              style={styles.renewBtn}
            >
              <MaterialCommunityIcons name="autorenew" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              Renew Franchise
            </Button>
          ) : null}

          <Text style={styles.note}>
            Keep your OR/CR and TODA membership updated. Renew before expiry to avoid penalties.
          </Text>
        </ScrollView>
      </View>
    );
  }

  // --- In-progress application: stepper ---
  if (inProgress) {
    const currentIdx = FRANCHISE_FLOW.indexOf(myApplication!.status);
    // Prefer stored methods; fall back to live-fetched ones (never hardcoded).
    const storedMethods: AdminMtopPaymentMethod[] =
      (myApplication!.selected_payment_methods as AdminMtopPaymentMethod[] | null | undefined) ?? [];
    const billedMethods: AdminMtopPaymentMethod[] =
      storedMethods.length > 0 ? storedMethods : livePaymentMethods;
    const isPaymentStep = myApplication!.status === 'payment';

    return (
      <View style={styles.container}>
        <Header subtitle={`Application ${myApplication!.type === 'renewal' ? '(Renewal)' : '(New)'} in review`} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card variant="elevated" padding="lg" style={styles.statusCard}>
            <Text style={styles.statusBig}>{FRANCHISE_STATUS_LABEL[myApplication!.status]}</Text>
            <Text style={styles.statusSub}>Plate {myApplication!.plate_number} • ₱{myApplication!.fees} fees</Text>
          </Card>

          <View style={styles.stepper}>
            {FRANCHISE_FLOW.map((step, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              const isPaymentNode = step === 'payment';
              const pendingReview = myApplication!.payment_review_status === 'pending_review';
              return (
                <View key={step} style={styles.step}>
                  <View style={styles.stepIndicatorCol}>
                    <View
                      style={[
                        styles.stepDot,
                        done && styles.stepDotDone,
                        active && styles.stepDotActive,
                      ]}
                    >
                      {done ? (
                        <MaterialCommunityIcons name="check" size={14} color="#fff" />
                      ) : (
                        <Text style={[styles.stepNum, active && { color: '#fff' }]}>{idx + 1}</Text>
                      )}
                    </View>
                    {idx < FRANCHISE_FLOW.length - 1 && (
                      <View style={[styles.stepLine, done && styles.stepLineDone]} />
                    )}
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepLabel, (done || active) && { color: colors.text }]}>
                      {FRANCHISE_STATUS_LABEL[step]}
                    </Text>
                    {active && !isPaymentNode && (
                      <Text style={styles.stepHint}>In progress with FEDTODAB / LGU</Text>
                    )}
                    {/* Pay Now button inline with step 3 */}
                    {active && isPaymentNode && (
                      <View style={styles.payNowRow}>
                        {pendingReview ? (
                          <View style={styles.payNowPendingChip}>
                            <MaterialCommunityIcons name="clock-check-outline" size={14} color={colors.warning} />
                            <Text style={styles.payNowPendingText}>Proof under review</Text>
                          </View>
                        ) : (
                          <>
                            <Text style={styles.stepHint}>
                              {myApplication!.payment_review_status === 'rejected'
                                ? 'Proof was rejected — re-submit below.'
                                : billedMethods.length > 0
                                ? `${billedMethods.length} payment method${billedMethods.length !== 1 ? 's' : ''} available`
                                : 'Pay at the FEDTODAB office.'}
                            </Text>
                            <TouchableOpacity
                              style={styles.payNowBtn}
                              onPress={() => setShowPayNow(true)}
                              activeOpacity={0.85}
                            >
                              <MaterialCommunityIcons name="cash-fast" size={15} color="#fff" />
                              <Text style={styles.payNowBtnText}>Pay Now</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Document Review</Text>
          <Card variant="outlined" padding="none" style={styles.docReviewCard}>
            {myApplication!.documents.map((doc, idx) => {
              const status = docReviewStatus(doc);
              const color =
                status === 'approved' ? colors.success : status === 'rejected' ? colors.error : colors.warning;
              return (
                <View
                  key={doc.name}
                  style={[styles.docReviewRow, idx === myApplication!.documents.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <MaterialCommunityIcons
                    name={status === 'approved' ? 'check-circle' : status === 'rejected' ? 'close-circle' : 'clock-outline'}
                    size={18}
                    color={color}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docReviewName}>{doc.name}</Text>
                    {status === 'rejected' && doc.review_remarks ? (
                      <Text style={styles.docReviewRemark}>{doc.review_remarks}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.docReviewStatus, { color }]}>{DOCUMENT_REVIEW_LABEL[status]}</Text>
                </View>
              );
            })}
          </Card>

          {anyDocumentRejected(myApplication!.documents) ? (
            <Card variant="outlined" padding="md" style={[styles.remarkCard, { borderColor: colors.error }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.remarkText}>
                Some documents were rejected. Please re-upload clear, valid copies to continue.
              </Text>
            </Card>
          ) : null}

          {myApplication!.remarks ? (
            <Card variant="outlined" padding="md" style={styles.remarkCard}>
              <MaterialCommunityIcons name="information-outline" size={18} color={colors.info} />
              <Text style={styles.remarkText}>{myApplication!.remarks}</Text>
            </Card>
          ) : null}

          {/* Payment summary card — only shows once the status is 'payment' */}
          {isPaymentStep ? (
            <View style={styles.paymentSummaryCard}>
              <View style={styles.paymentSummaryHead}>
                <View style={styles.paymentSummaryIcon}>
                  <MaterialCommunityIcons name="cash-multiple" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentSummaryTitle}>Payment of Fees</Text>
                  <Text style={styles.paymentSummaryAmount}>
                    ₱{Number(myApplication!.fees).toFixed(2)} due
                  </Text>
                </View>
                {myApplication!.payment_review_status === 'pending_review' ? (
                  <View style={styles.pendingChip}>
                    <MaterialCommunityIcons name="clock-outline" size={13} color={colors.warning} />
                    <Text style={styles.pendingChipText}>Under Review</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.payNowCardBtn}
                    onPress={() => setShowPayNow(true)}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="cash-fast" size={16} color="#fff" />
                    <Text style={styles.payNowCardBtnText}>Pay Now</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ── After proof submitted: show only the chosen method ── */}
              {myApplication!.payment_review_status === 'pending_review' && myApplication!.chosen_payment_method_snapshot ? (() => {
                const cm = myApplication!.chosen_payment_method_snapshot!;
                const mColor = METHOD_COLOR[cm.method_type] || colors.primary;
                return (
                  <>
                    <View style={styles.billedMethodsDivider} />
                    <Text style={styles.billedMethodsLabel}>PAID VIA</Text>
                    <View style={styles.billedMethodRow}>
                      <View style={[styles.billedMethodDot, { backgroundColor: mColor + '20' }]}>
                        <MaterialCommunityIcons name={METHOD_ICON[cm.method_type] as any} size={16} color={mColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.billedMethodName}>{cm.display_name}</Text>
                        {cm.method_type !== 'face_to_face' && cm.account_number ? (
                          <Text style={[styles.billedMethodDetail, { color: mColor }]}>
                            {cm.account_name} · {cm.account_number}
                          </Text>
                        ) : cm.address ? (
                          <Text style={styles.billedMethodDetail}>{cm.address}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.methodTypeBadge, { backgroundColor: mColor + '15' }]}>
                        <Text style={[styles.methodTypeBadgeText, { color: mColor }]}>
                          {METHOD_LABEL[cm.method_type]}
                        </Text>
                      </View>
                    </View>
                  </>
                );
              })() : null}

              {/* ── Before submission: show the billed methods the admin picked ── */}
              {(!myApplication!.payment_review_status || myApplication!.payment_review_status === 'awaiting_submission' || myApplication!.payment_review_status === 'rejected') ? (
                loadingLiveMethods ? (
                  <>
                    <View style={styles.billedMethodsDivider} />
                    <View style={[styles.billedMethodRow, { justifyContent: 'center' }]}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.billedMethodDetail, { marginLeft: 8 }]}>Loading payment methods…</Text>
                    </View>
                  </>
                ) : billedMethods.length > 0 ? (
                  <>
                    <View style={styles.billedMethodsDivider} />
                    <Text style={styles.billedMethodsLabel}>AVAILABLE PAYMENT METHODS</Text>
                    {billedMethods.map((method) => {
                      const mColor = METHOD_COLOR[method.method_type] || colors.primary;
                      return (
                        <View key={method.id} style={styles.billedMethodRow}>
                          <View style={[styles.billedMethodDot, { backgroundColor: mColor + '20' }]}>
                            <MaterialCommunityIcons name={METHOD_ICON[method.method_type] as any} size={16} color={mColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.billedMethodName}>{method.display_name}</Text>
                            {method.method_type !== 'face_to_face' && method.account_number ? (
                              <Text style={[styles.billedMethodDetail, { color: mColor }]}>
                                {method.account_name} · {method.account_number}
                              </Text>
                            ) : method.address ? (
                              <Text style={styles.billedMethodDetail}>{method.address}</Text>
                            ) : null}
                          </View>
                          <View style={[styles.methodTypeBadge, { backgroundColor: mColor + '15' }]}>
                            <Text style={[styles.methodTypeBadgeText, { color: mColor }]}>
                              {METHOD_LABEL[method.method_type]}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </>
                ) : null
              ) : null}

              {myApplication!.payment_review_status === 'pending_review' ? (
                <View style={styles.pendingPaymentRow}>
                  <MaterialCommunityIcons name="clock-check-outline" size={18} color={colors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingPaymentTitle}>Proof submitted — awaiting admin verification</Text>
                    {myApplication!.payment_reference ? (
                      <Text style={styles.pendingPaymentRef}>Ref: {myApplication!.payment_reference}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* Pay Now Modal */}
        <PayNowModal
          visible={showPayNow}
          fees={myApplication!.fees}
          paymentProof={paymentProof}
          paymentReference={paymentReference}
          submitting={submittingPayment}
          paymentReviewStatus={myApplication!.payment_review_status}
          paymentRejectionReason={myApplication!.payment_rejection_reason}
          onPickProof={pickPaymentProof}
          onChangeReference={setPaymentReference}
          onSubmit={handlePaymentSubmit}
          onSubmitAppointment={handleAppointmentSubmit}
          onClose={() => setShowPayNow(false)}
        />
      </View>
    );
  }

  // --- Apply form (no application or rejected) ---
  return (
    <View style={styles.container}>
      <Header subtitle="Apply for a tricycle franchise" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {myApplication?.status === 'rejected' && (
          <Card variant="outlined" padding="md" style={[styles.remarkCard, { borderColor: colors.error, flexDirection: 'column', gap: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.remarkText, { fontWeight: '700', color: colors.error, marginBottom: 4 }]}>
                  Application Rejected
                </Text>
                <Text style={styles.remarkText}>
                  {myApplication.remarks || 'Your previous application was rejected by the administrator.'}
                </Text>
              </View>
            </View>
            <View style={[styles.reapplyNote, { backgroundColor: colors.warningLight, borderRadius: radius.sm, padding: spacing.sm }]}>
              <MaterialCommunityIcons name="refresh" size={15} color={colors.warning} />
              <Text style={{ ...typography.bodySmall, color: colors.textSecondary, flex: 1 }}>
                Review the reason above, update your documents if needed, and re-submit below.
              </Text>
            </View>
          </Card>
        )}

        <Text style={styles.sectionTitle}>Unit Details</Text>
        <Card variant="elevated" padding="md" style={styles.infoCard}>
          <MaterialCommunityIcons name="rickshaw" size={24} color={colors.primary} />
          <View>
            <Text style={styles.infoLabel}>PLATE NUMBER</Text>
            <Text style={styles.infoValue}>{plate}</Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Required Documents</Text>
        <Card variant="outlined" padding="none" style={styles.docCard}>
          {docs.map((doc, idx) => (
            <TouchableOpacity key={doc.name} style={[styles.docRow, idx === docs.length - 1 && { borderBottomWidth: 0 }]} onPress={() => pickDoc(idx)} activeOpacity={0.7}>
              {doc.uploaded && doc.file_url?.startsWith('data:image') ? (
                <Image source={{ uri: doc.file_url }} style={styles.docThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.docIcon, doc.uploaded && { backgroundColor: colors.successLight }]}>
                  <MaterialCommunityIcons
                    name={doc.uploaded ? 'file-check' : 'plus'}
                    size={18}
                    color={doc.uploaded ? colors.success : colors.textMuted}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.docName, doc.uploaded && { color: colors.text }]}>{doc.name}</Text>
                {doc.uploaded && (doc as any).file_name ? (
                  <Text style={styles.docFileName} numberOfLines={1}>{(doc as any).file_name}</Text>
                ) : null}
              </View>
              <Text style={[styles.docAction, doc.uploaded && { color: colors.success }]}>
                {doc.uploaded ? 'Replace' : 'Add'}
              </Text>
            </TouchableOpacity>
          ))}
        </Card>

        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Filing & Franchise Fees</Text>
          <Text style={[styles.feeValue, typography.currency]}>₱1,500.00</Text>
        </View>

        <Button
          variant="primary"
          onPress={() => handleSubmit('new')}
          disabled={!allUploaded || submitting}
          loading={submitting}
        >
          {myApplication?.status === 'rejected' ? 'Re-submit Application' : 'Submit Application'}
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.surface 
  },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.screen,
  },
  headerTitle: { 
    ...typography.h1,
    fontSize: 28,
  },
  headerSubtitle: { 
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: layout.contentBottom
  },
  mtopCard: { 
    backgroundColor: colors.primary,
    borderRadius: radius.xl, 
    overflow: 'hidden',
    ...shadows.lg,
    marginBottom: spacing.xl,
  },
  mtopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mtopBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mtopLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mtopBrandText: {
    ...typography.label,
    color: '#fff',
    fontSize: 11,
    letterSpacing: 1,
  },
  activeBadge: { 
    backgroundColor: colors.secondary, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: radius.pill 
  },
  activeBadgeText: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 1 
  },
  mtopBody: {
    padding: spacing.lg,
  },
  mtopLabel: { 
    ...typography.labelSmall,
    color: 'rgba(255,255,255,0.5)', 
    fontSize: 9,
    letterSpacing: 1.5,
  },
  mtopNumber: { 
    ...typography.h1,
    color: '#fff', 
    fontSize: 32, 
    marginTop: 4, 
    marginBottom: spacing.xl,
  },
  mtopGrid: { 
    flexDirection: 'row', 
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  mtopItem: {
    flex: 1,
  },
  mtopValue: { 
    ...typography.subtitle,
    color: '#fff', 
    fontSize: 15,
    marginTop: 2,
  },
  mtopDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: spacing.md,
  },
  mtopFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  renewBtn: {
    height: 52,
    marginBottom: spacing.lg,
  },
  note: { 
    ...typography.bodySmall,
    color: colors.textMuted, 
    textAlign: 'center',
    lineHeight: 18,
  },
  statusCard: { 
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  statusBig: { 
    ...typography.h2,
    color: colors.primary 
  },
  statusSub: { 
    ...typography.bodySmall,
    color: colors.textSecondary, 
    marginTop: 4 
  },
  stepper: { 
    backgroundColor: colors.surfaceAlt, 
    borderRadius: radius.lg, 
    padding: spacing.lg, 
    marginBottom: spacing.xl,
  },
  step: { flexDirection: 'row' },
  stepIndicatorCol: { alignItems: 'center', marginRight: spacing.md },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotDone: { backgroundColor: colors.secondary },
  stepDotActive: { backgroundColor: colors.primary },
  stepNum: { 
    ...typography.labelSmall,
    color: colors.textMuted 
  },
  stepLine: { 
    width: 2, 
    flex: 1, 
    minHeight: 24, 
    backgroundColor: colors.border, 
    marginVertical: 4 
  },
  stepLineDone: { backgroundColor: colors.secondary },
  stepBody: { flex: 1, paddingBottom: spacing.lg },
  stepLabel: { 
    ...typography.label,
    color: colors.textMuted,
  },
  stepHint: { 
    ...typography.bodySmall,
    color: colors.textSecondary, 
    marginTop: 2 
  },
  docReviewCard: {
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  docReviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  docReviewName: {
    ...typography.label,
    fontSize: 13,
    color: colors.text,
  },
  docReviewRemark: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.error,
    marginTop: 2,
  },
  docReviewStatus: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  remarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.xl,
  },
  remarkText: { 
    flex: 1, 
    ...typography.bodySmall,
    color: colors.textSecondary, 
  },
  reapplyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sectionTitle: { 
    ...typography.label,
    color: colors.textMuted, 
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: spacing.md, 
    marginTop: spacing.md 
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  infoLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 1,
  },
  infoValue: { 
    ...typography.subtitle,
    fontSize: 16,
    color: colors.text 
  },
  docCard: { 
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  docRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: spacing.md, 
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  docIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docName: {
    ...typography.label,
    color: colors.textSecondary
  },
  docFileName: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  docThumb: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  docAction: { 
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '700',
  },
  feeRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.xl,
  },
  feeLabel: { 
    ...typography.body,
    color: colors.textSecondary,
  },
  feeValue: { 
    ...typography.h2,
    color: colors.text 
  },
  // ── Stepper: Pay Now row ──
  payNowRow: {
    marginTop: 4,
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  payNowBtnText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  payNowPendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.warningLight,
  },
  payNowPendingText: {
    ...typography.labelSmall,
    color: colors.warning,
    fontSize: 11,
    fontWeight: '700',
  },
  // ── Payment summary card ──
  paymentSummaryCard: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    overflow: 'hidden',
  },
  paymentSummaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
  },
  paymentSummaryIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentSummaryTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 15,
  },
  paymentSummaryAmount: {
    ...typography.h3,
    color: colors.primary,
    fontSize: 17,
    marginTop: 2,
  },
  payNowCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  payNowCardBtnText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.warningLight,
    flexShrink: 0,
  },
  pendingChipText: {
    ...typography.labelSmall,
    color: colors.warning,
    fontSize: 10,
    fontWeight: '800',
  },
  billedMethodsDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.md,
  },
  billedMethodsLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 1,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  billedMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  billedMethodDot: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  billedMethodName: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
  },
  billedMethodDetail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  methodTypeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  methodTypeBadgeText: {
    ...typography.labelSmall,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pendingPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningLight,
  },
  pendingPaymentTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
  },
  pendingPaymentRef: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles for the Pay Now bottom-sheet modal
// ─────────────────────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headTitle: { ...typography.h2, fontSize: 19 },
  headSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  headFee: { ...typography.label, color: colors.primary },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacing.lg,
    paddingBottom: 56,
  },
  // Rejection banner
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  rejectedText: {
    ...typography.bodySmall,
    color: colors.error,
    flex: 1,
    lineHeight: 18,
  },
  // Section labels
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.md,
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
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
    flexShrink: 0,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  methodInfo: { flex: 1, minWidth: 0 },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  methodName: { ...typography.label, fontSize: 15, color: colors.text },
  methodBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  methodBadgeText: { ...typography.labelSmall, fontSize: 10 },
  methodHolder: { ...typography.bodySmall, color: colors.textSecondary },
  methodNumber: { ...typography.label, marginTop: 3 },
  methodAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 3,
  },
  methodAddress: { ...typography.bodySmall, color: colors.textMuted, flex: 1 },
  methodNote: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  qrCode: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  // Fallback when no billing methods set
  fallbackBox: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  fallbackTitle: { ...typography.label, color: colors.text, fontSize: 15 },
  fallbackText: { ...typography.label, color: colors.textSecondary },
  fallbackAddress: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },
  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.lg,
  },
  // Proof picker
  proofPicker: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  proofImage: {
    width: '100%',
    height: 170,
  },
  proofPickerText: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  replaceProof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  replaceProofText: { ...typography.labelSmall, color: colors.accent, fontWeight: '700' },
  // Reference input
  refInput: {
    ...typography.body,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  // ── Inline expanded action panel (renders under selected method card) ──
  expandedAction: {
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  expandedTitle: {
    ...typography.label,
    fontSize: 14,
    marginBottom: 4,
  },
  expandedHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  // ── Method detail box (shown after selection) ──
  methodDetailBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  methodDetailIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  methodDetailName: {
    ...typography.label,
    fontSize: 15,
    marginBottom: 2,
  },
  methodDetailHolder: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  methodDetailNumber: {
    ...typography.label,
    marginTop: 3,
    fontSize: 15,
  },
  methodDetailAddress: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  methodDetailNote: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  // ── QR full block ──
  qrFullBox: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  qrLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  qrFull: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
  },
  // ── Date/time picker buttons ──
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  datePickerLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  datePickerValue: {
    ...typography.label,
    color: colors.text,
    fontSize: 15,
    marginTop: 1,
  },
  // ── Appointment confirmation summary ──
  apptSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  apptSummaryText: {
    ...typography.label,
    color: colors.primary,
    flex: 1,
  },
  // ── "Select a method first" prompt ──
  selectPrompt: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  selectPromptText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

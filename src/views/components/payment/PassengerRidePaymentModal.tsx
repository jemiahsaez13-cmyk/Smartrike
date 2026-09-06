import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Booking } from '@/models/types';
import { DriverPaymentMethod, RidePaymentStatus, RidePaymentSubmission } from '@/models/entities/RidePayment';
import { RidePaymentService } from '@/models/services/RidePaymentService';
import { watchRidePayment } from '@/models/services/RidePaymentSyncService';
import { pickImageDataUri } from '@/utils/pickImageDataUri';
import { notify } from '@/utils/confirm';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const service = new RidePaymentService();

export const PassengerRidePaymentModal = ({
  booking,
  driverName,
  visible,
  onClose,
  onStatus,
  onBookingChanged,
}: {
  booking: Booking;
  driverName: string;
  visible: boolean;
  onClose: () => void;
  onStatus: (status: RidePaymentStatus | null) => void;
  onBookingChanged: (booking: Booking) => void;
}) => {
  const [methods, setMethods] = useState<DriverPaymentMethod[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [submission, setSubmission] = useState<RidePaymentSubmission | null>(null);
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Keep observing while the sheet is closed so the trip's payment banner
  // updates too. Callback refs avoid reconnecting on every parent render.
  const callbacks = useRef({ onStatus, onBookingChanged, onClose });
  callbacks.current = { onStatus, onBookingChanged, onClose };
  const sync = useRef<ReturnType<typeof watchRidePayment> | null>(null);
  useEffect(() => {
    setSubmission(null);
    setSelectedId('');
    setReference('');
    setProof('');
    const observer = watchRidePayment(booking.id, (current, freshBooking) => {
      setSubmission(current);
      callbacks.current.onStatus(current?.status ?? null);
      if (freshBooking) callbacks.current.onBookingChanged(freshBooking);
    });
    sync.current = observer;
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void observer.refresh();
    });
    return () => { observer.stop(); appState.remove(); sync.current = null; };
  }, [booking.id]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    void sync.current?.refresh();
    service.getMethodsForRide(booking.id).then(available => {
      if (!active) return;
      setMethods(available);
      setSelectedId(value => available.some(method => method.id === value) ? value : available[0]?.id || '');
    }).catch((error: any) => {
      if (!active) return;
      setMethods([]);
      void notify('Payment details unavailable', error?.message || 'Please ask your driver to check their payment profile.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [booking.id, visible]);

  const chooseProof = async () => {
    try { const image = await pickImageDataUri(); if (image) setProof(image); }
    catch (error: any) { void notify('Could not use image', error?.message || 'Choose another screenshot.'); }
  };
  const submit = async () => {
    setSubmitting(true);
    try {
      const row = await service.submit(booking.id, selectedId, reference, proof);
      setSubmission(row); onStatus(row.status); setReference(''); setProof('');
      void sync.current?.refresh();
      // The pending state is shown inline; no extra modal keeps Close disabled.
    } catch (error: any) { await notify('Could not submit payment', error?.message || 'Check the proof and reference, then try again.'); }
    finally { setSubmitting(false); }
  };
  const useCash = async () => {
    try {
      const changed = await service.switchToCash(booking.id);
      onBookingChanged(changed as Booking);
      onClose();
      await notify('Changed to cash', 'Please pay the fare directly to your assigned driver.');
    } catch (error: any) { await notify('Could not change payment', error?.message || 'Please try again.'); }
  };
  const selected = methods.find((method) => method.id === selectedId);
  const verified = booking.payment_status === 'completed' || submission?.status === 'verified';
  const pending = !verified && submission?.status === 'pending';

  useEffect(() => {
    if (visible && verified) callbacks.current.onClose();
  }, [visible, verified]);

  return <Modal visible={visible && !verified} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}><Surface style={styles.card} elevation={5}>
      <View style={styles.head}><View style={styles.headCopy}><Text style={styles.title}>Online Payment</Text><Text style={styles.subtitle}>Pay the assigned driver, then submit proof</Text></View><TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close payment" hitSlop={8}><MaterialCommunityIcons name="close" size={23} color={colors.text} /></TouchableOpacity></View>
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading {driverName}’s payment details…</Text></View> : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={styles.amountRow}><Text style={styles.amountLabel}>TRIP FARE</Text><Text style={styles.amount}>₱{Number(booking.total_fare).toFixed(2)}</Text></View>
          {verified || pending ? <View style={[styles.stateCard, verified ? styles.verified : styles.pending]}><MaterialCommunityIcons name={verified ? 'check-decagram' : 'clock-check-outline'} size={30} color={verified ? colors.success : colors.warning} /><View style={styles.stateCopy}><Text style={styles.stateTitle}>{verified ? 'Payment verified' : 'Waiting for driver verification'}</Text><Text style={styles.stateText}>Reference {submission?.payment_reference}</Text>{submission?.reviewed_at ? <Text style={styles.stateText}>Reviewed {new Date(submission.reviewed_at).toLocaleString()}</Text> : null}</View></View> : (
            <>
              {submission?.status === 'rejected' && <View style={styles.rejected}><Text style={styles.rejectedTitle}>Previous proof was rejected</Text><Text style={styles.rejectedText}>{submission.rejection_reason || 'Upload clearer proof and check the reference.'}</Text></View>}
              {!methods.length ? <View style={styles.empty}><MaterialCommunityIcons name="credit-card-off-outline" size={42} color={colors.textLight} /><Text style={styles.emptyTitle}>Driver has no payment method</Text><Text style={styles.emptyText}>Ask {driverName} to configure and enable Online Payment, or switch this ride to cash.</Text><TouchableOpacity style={styles.cashBtn} onPress={useCash}><MaterialCommunityIcons name="cash" size={19} color={colors.primary} /><Text style={styles.cashBtnText}>Use Cash Instead</Text></TouchableOpacity></View> : <>
                <Text style={styles.sectionLabel}>1. CHOOSE WHERE TO PAY</Text>
                {methods.map((method) => <TouchableOpacity key={method.id} style={[styles.method, selectedId === method.id && styles.methodActive]} onPress={() => setSelectedId(method.id)} activeOpacity={0.8}><MaterialCommunityIcons name={method.method_type === 'gcash' ? 'cellphone' : method.method_type === 'bank' ? 'bank-outline' : 'wallet-outline'} size={22} color={colors.primary} /><View style={styles.methodCopy}><Text style={styles.methodName}>{method.display_name}</Text><Text style={styles.methodDetail}>{method.account_name} · {method.account_number}</Text></View><MaterialCommunityIcons name={selectedId === method.id ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={colors.primary} /></TouchableOpacity>)}
                {selected && <View style={styles.credentials}>{selected.qr_code_url ? <Image source={{ uri: selected.qr_code_url }} style={styles.qr} resizeMode="contain" /> : <View style={styles.noQr}><MaterialCommunityIcons name="account-credit-card-outline" size={32} color={colors.primary} /><Text style={styles.noQrText}>Use the account details below</Text></View>}<Text style={styles.credentialName}>{selected.account_name}</Text><Text selectable style={styles.credentialNumber}>{selected.account_number}</Text>{selected.instructions ? <Text style={styles.instructions}>{selected.instructions}</Text> : null}<Text style={styles.externalNote}>Complete the transfer in your bank or e-wallet app. Smart Trike does not process the funds directly.</Text></View>}
                <Text style={styles.sectionLabel}>2. UPLOAD PAYMENT SCREENSHOT</Text>
                <TouchableOpacity style={styles.proofPicker} onPress={chooseProof}>{proof ? <Image source={{ uri: proof }} style={styles.proofPreview} resizeMode="contain" /> : <MaterialCommunityIcons name="image-plus" size={36} color={colors.primary} />}<Text style={styles.proofPickerText}>{proof ? 'Replace screenshot' : 'Choose payment screenshot'}</Text></TouchableOpacity>
                <Text style={styles.sectionLabel}>3. PAYMENT REFERENCE</Text>
                <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="Enter receipt/reference number" placeholderTextColor={colors.textMuted} autoCapitalize="characters" maxLength={64} />
                <TouchableOpacity style={[styles.submit, submitting && styles.disabled]} onPress={submit} disabled={submitting}>{submitting ? <ActivityIndicator color="#fff" /> : <><MaterialCommunityIcons name="send-check-outline" size={20} color="#fff" /><Text style={styles.submitText}>Submit for Verification</Text></>}</TouchableOpacity>
              </>}
            </>
          )}
        </ScrollView>
      )}
    </Surface></View>
  </Modal>;
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' }, card: { width: '100%', maxWidth: 640, alignSelf: 'center', maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' }, head: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight }, headCopy: { flex: 1, minWidth: 0 }, title: { ...typography.h2, fontSize: 21 }, subtitle: { ...typography.bodySmall, color: colors.textSecondary }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.md }, loadingText: { ...typography.body, color: colors.textSecondary }, content: { padding: spacing.lg, paddingBottom: 48 }, amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primaryLight, marginBottom: spacing.lg }, amountLabel: { ...typography.labelSmall, color: colors.primary }, amount: { ...typography.h1, fontSize: 27, color: colors.primary }, sectionLabel: { ...typography.labelSmall, color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.sm }, method: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }, methodActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight }, methodCopy: { flex: 1, minWidth: 0 }, methodName: { ...typography.label, color: colors.text }, methodDetail: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 }, credentials: { alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, marginVertical: spacing.md }, qr: { width: 176, height: 176, backgroundColor: '#fff', borderRadius: radius.sm }, noQr: { minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }, noQrText: { ...typography.bodySmall, color: colors.textSecondary }, credentialName: { ...typography.h3, marginTop: spacing.md }, credentialNumber: { ...typography.h2, fontSize: 20, color: colors.primary, marginTop: spacing.xs }, instructions: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }, externalNote: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }, proofPicker: { minHeight: 130, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primaryLight, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.lg }, proofPreview: { width: '100%', height: 170 }, proofPickerText: { ...typography.label, color: colors.primary, marginVertical: spacing.sm }, input: { ...typography.body, minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, color: colors.text, marginBottom: spacing.lg }, submit: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md }, submitText: { ...typography.button, color: '#fff' }, disabled: { opacity: 0.6 }, empty: { alignItems: 'center', paddingVertical: spacing.xxl }, emptyTitle: { ...typography.h3, marginTop: spacing.md }, emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }, stateCard: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg }, verified: { backgroundColor: colors.successLight }, pending: { backgroundColor: colors.warningLight }, stateCopy: { flex: 1 }, stateTitle: { ...typography.h3 }, stateText: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 3 }, rejected: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.errorLight, marginBottom: spacing.md }, rejectedTitle: { ...typography.label, color: colors.error }, rejectedText: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 3 },
  cashBtn: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg }, cashBtnText: { ...typography.button, color: colors.primary },
});

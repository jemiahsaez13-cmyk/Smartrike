import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PASSENGER_TYPE_LABEL } from '@/config/constants';
import { Booking } from '@/models/types';
import { DiscountIdService } from '@/models/services/DiscountIdService';
import { confirm, notify } from '@/utils/confirm';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const REVERT_REASONS = ['No ID shown', 'ID expired', 'Not the passenger\'s ID', 'Not a valid ID'];

interface Props {
  booking: Pick<Booking, 'id' | 'status' | 'passenger_type' | 'discount_amount' | 'total_fare'> | null | undefined;
  /** Assigned driver during the ride: may remove the discount. */
  canRevert?: boolean;
  onReverted?: (booking: Booking) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Driver's ID check for a discounted booking (D5): opens the ID photo the
 * passenger uploaded and, during the ride, lets the driver charge the regular
 * fare when the ID is missing or not valid. Renders nothing for a regular fare.
 */
export const DiscountIdCheck = ({ booking, canRevert, onReverted, style }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const type = booking?.passenger_type;
  const discount = Number(booking?.discount_amount ?? 0);
  if (!booking || !type || type === 'regular' || discount <= 0) return null;
  const revertable = !!canRevert && (booking.status === 'accepted' || booking.status === 'in-transit');

  const show = async () => {
    setOpen(true);
    setReason(null);
    setLoading(true);
    try {
      setPhoto(await DiscountIdService.get(booking.id));
    } catch (error: any) {
      setPhoto(null);
      void notify('ID photo', error?.message || 'The ID photo could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const revert = async () => {
    if (!reason) return;
    const regular = Number(booking.total_fare ?? 0) + discount;
    const ok = await confirm(
      'Charge regular fare?',
      `The ${PASSENGER_TYPE_LABEL[type]} discount will be removed (${reason}). The fare becomes ₱${regular.toFixed(2)} and the passenger is notified.`,
      { confirmText: 'Charge regular fare', destructive: true }
    );
    if (!ok) return;
    setBusy(true);
    try {
      const updated = await DiscountIdService.revert(booking.id, reason);
      setOpen(false);
      onReverted?.(updated);
    } catch (error: any) {
      void notify('Fare not changed', error?.message || 'The fare could not be changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={[styles.link, style]} onPress={show} activeOpacity={0.7} accessibilityRole="button">
        <MaterialCommunityIcons name="card-account-details-outline" size={16} color={colors.primary} />
        <Text style={styles.linkText}>{revertable ? 'Check ID' : 'View ID photo'}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>{PASSENGER_TYPE_LABEL[type]} ID</Text>
              <TouchableOpacity onPress={() => setOpen(false)} accessibilityLabel="Close" hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.sm }}>
              {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
              ) : photo ? (
                <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />
              ) : (
                <Text style={styles.empty}>No ID photo was uploaded. Check the physical ID at pickup.</Text>
              )}

              {revertable && (
                <>
                  <Text style={styles.label}>ID not valid? Charge the regular fare</Text>
                  <View style={styles.reasons}>
                    {REVERT_REASONS.map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.reason, reason === r && styles.reasonActive]}
                        onPress={() => setReason(r)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.revertBtn, (!reason || busy) && { opacity: 0.5 }]}
                    onPress={revert}
                    disabled={!reason || busy}
                    activeOpacity={0.8}
                  >
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.revertText}>Charge regular fare</Text>}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, paddingVertical: 6, minHeight: 32 },
  linkText: { ...typography.label, fontSize: 12, color: colors.primary, textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.md },
  sheet: { maxHeight: '90%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { ...typography.subtitle, color: colors.text },
  photo: { width: '100%', height: 280, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.lg },
  label: { ...typography.labelSmall, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reason: { paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  reasonActive: { borderColor: colors.error, backgroundColor: colors.errorLight },
  reasonText: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  reasonTextActive: { color: colors.error },
  revertBtn: { marginTop: spacing.md, height: 44, borderRadius: radius.md, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  revertText: { ...typography.button, color: '#fff' },
});

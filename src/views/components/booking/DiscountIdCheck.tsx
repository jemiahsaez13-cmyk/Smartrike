import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DISCOUNT_ID_NAME, PASSENGER_TYPE_LABEL } from '@/config/constants';
import { Booking } from '@/models/types';
import { DiscountIdService } from '@/models/services/DiscountIdService';
import { pendingDiscount } from '@/views/components/booking/FareDiscountNote';
import { notify } from '@/utils/confirm';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const REJECT_REASONS = ['No ID shown', 'ID expired', 'Not the passenger\'s ID', 'Not a valid ID'];
// Amber text on a light fill needs a darker shade than the theme's amber.
const AMBER_TEXT = '#9A6700';

interface Props {
  booking: Pick<
    Booking,
    'id' | 'status' | 'passenger_type' | 'discount_amount' | 'total_fare' | 'passenger_count' | 'discount_status'
  > | null | undefined;
  /** Assigned driver during the ride. */
  canRevert?: boolean;
  /** Called with the updated booking after the approval or rejection. */
  onChanged?: (booking: Booking) => void;
  style?: StyleProp<ViewStyle>;
}

const peso = (n: number) => `₱${n.toFixed(2)}`;

/**
 * The accepting driver's check of the passenger's physical ID (migration 089).
 * One tap decides: Approve → the discount comes off; tap a reason → the
 * regular fare stays. The popup closes by itself and the decision is final,
 * so the box disappears once the ID is decided.
 */
export const DiscountIdCheck = ({ booking, canRevert, onChanged, style }: Props) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // 'approve' or the reason

  const type = booking?.passenger_type;
  const duringRide = !!canRevert && (booking?.status === 'accepted' || booking?.status === 'in-transit');
  if (!booking || !type || type === 'regular' || booking.discount_status !== 'pending' || !duringRide) return null;

  const regular = Number(booking.total_fare ?? 0);
  const off = pendingDiscount(booking);
  const discounted = Math.max(0, regular - off);
  const label = PASSENGER_TYPE_LABEL[type];

  const decide = async (approve: boolean, reason?: string) => {
    if (busy) return;
    setBusy(approve ? 'approve' : reason ?? 'reject');
    try {
      const updated = await DiscountIdService.review(booking.id, approve, reason);
      setOpen(false);
      onChanged?.(updated);
    } catch (error: any) {
      void notify(approve ? 'Discount not approved' : 'Fare not changed', error?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <TouchableOpacity style={[styles.box, style]} onPress={() => setOpen(true)} activeOpacity={0.8} accessibilityRole="button">
        <MaterialCommunityIcons name="card-account-details-star-outline" size={20} color={AMBER_TEXT} />
        <View style={{ flex: 1 }}>
          <Text style={styles.boxTitle}>Check {label} ID</Text>
          <Text style={styles.boxSub}>Ask to see it at pickup · {peso(off)} off if valid</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={AMBER_TEXT} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => !busy && setOpen(false)}>
        <View style={styles.overlay}>
          <Surface style={styles.card} elevation={5}>
            <TouchableOpacity
              style={styles.close}
              onPress={() => setOpen(false)}
              disabled={!!busy}
              hitSlop={10}
              accessibilityLabel="Close"
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.icon}>
              <MaterialCommunityIcons name="card-account-details-outline" size={34} color={AMBER_TEXT} />
            </View>
            <Text style={styles.title}>Check {label} ID</Text>
            <Text style={styles.subtitle}>
              Ask to see the {DISCOUNT_ID_NAME[type]}. The name and picture should match the passenger, and it should not be expired.
            </Text>

            {/* Regular vs discounted */}
            <View style={styles.fareRow}>
              <View style={styles.fareCol}>
                <Text style={styles.fareLabel}>REGULAR</Text>
                <Text style={styles.fareValue}>{peso(regular)}</Text>
              </View>
              <MaterialCommunityIcons name="arrow-right" size={18} color={colors.textLight} />
              <View style={styles.fareCol}>
                <Text style={styles.fareLabel}>WITH DISCOUNT</Text>
                <Text style={[styles.fareValue, { color: colors.success }]}>{peso(discounted)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.approveBtn, !!busy && busy !== 'approve' && { opacity: 0.5 }]}
              onPress={() => decide(true)}
              disabled={!!busy}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <LinearGradient colors={[colors.success, '#2C4A3A']} style={styles.approveGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {busy === 'approve' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                    <Text style={styles.approveText}>Valid · Approve {peso(off)} off</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.label}>NOT VALID? TAP THE REASON · REGULAR FARE STAYS</Text>
            <View style={styles.reasonWrap}>
              {REJECT_REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => decide(false, r)}
                  disabled={!!busy}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  style={[styles.reasonChip, busy === r && styles.reasonChipBusy, !!busy && busy !== r && { opacity: 0.5 }]}
                >
                  {busy === r
                    ? <ActivityIndicator size="small" color={colors.error} />
                    : <Text style={styles.reasonChipText}>{r}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </Surface>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: '#E9C46A',
  },
  boxTitle: { ...typography.label, fontSize: 14, color: AMBER_TEXT },
  boxSub: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.xl, alignItems: 'center' },
  close: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 1 },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.title, fontSize: 21, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center', lineHeight: 19 },

  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  fareCol: { flex: 1, alignItems: 'center' },
  fareLabel: { ...typography.labelSmall, fontSize: 9, letterSpacing: 1, color: colors.textMuted },
  fareValue: { ...typography.label, fontSize: 17, color: colors.text, marginTop: 2 },

  approveBtn: { alignSelf: 'stretch', height: 52, borderRadius: 14, overflow: 'hidden', marginTop: spacing.md },
  approveGradient: { flex: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', alignItems: 'center' },
  approveText: { ...typography.label, color: '#fff', fontSize: 15 },

  label: { ...typography.labelSmall, fontSize: 9, color: colors.textMuted, letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm, textAlign: 'center' },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  reasonChip: {
    minWidth: 96,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonChipBusy: { backgroundColor: colors.errorLight },
  reasonChipText: { ...typography.label, fontSize: 12, color: colors.error },
});

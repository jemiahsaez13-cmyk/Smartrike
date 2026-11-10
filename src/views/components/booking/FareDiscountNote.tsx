import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { PASSENGER_DISCOUNT_PCT, PASSENGER_TYPE_LABEL, BookingPassengerType, discountNeedsApproval } from '@/config/constants';
import { colors, typography } from '@/views/styles/theme';

interface Props {
  booking: {
    passenger_type?: BookingPassengerType | null;
    discount_pct?: number | null;
    discount_amount?: number | null;
    total_fare?: number | null;
    discount_revoked_at?: Date | string | null;
    discount_revoked_reason?: string | null;
    discount_status?: 'pending' | 'approved' | 'rejected' | null;
    passenger_count?: number | null;
  } | null | undefined;
  /** Driver screens remind the driver to check the ID at pickup. */
  forDriver?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * One-line fare breakdown for a discounted booking (D6): regular fare,
 * the discount and what is paid, or that the driver removed it. Renders
 * nothing for a regular fare.
 */
export const FareDiscountNote = ({ booking, forDriver, style }: Props) => {
  const type = booking?.passenger_type;
  const discount = Number(booking?.discount_amount ?? 0);
  // 089: PWD / student discount waits for the accepting driver to approve the ID.
  if (type && type !== 'regular' && booking?.discount_status === 'pending') {
    const off = pendingDiscount(booking);
    return (
      <Text style={[styles.note, styles.pending, style]}>
        {forDriver
          ? `${PASSENGER_TYPE_LABEL[type]} ID to check at pickup · ₱${off.toFixed(2)} off if you approve it`
          : `${PASSENGER_TYPE_LABEL[type]} discount (₱${off.toFixed(2)} off) once your driver checks your ID at pickup · Regular fare for now`}
      </Text>
    );
  }
  // D5 / 089: the driver did not accept or removed the discount (ID missing or not valid).
  if (type && type !== 'regular' && booking?.discount_revoked_at) {
    return (
      <Text style={[styles.note, styles.revoked, style]}>
        {PASSENGER_TYPE_LABEL[type]} discount {booking.discount_status === 'rejected' ? 'not approved' : 'removed'}
        {booking.discount_revoked_reason ? `: ${booking.discount_revoked_reason}` : ''} · Regular fare
      </Text>
    );
  }
  if (!type || type === 'regular' || discount <= 0) return null;
  const total = Number(booking?.total_fare ?? 0);
  return (
    <Text style={[styles.note, style]}>
      Regular ₱{(total + discount).toFixed(2)} · {PASSENGER_TYPE_LABEL[type]} −₱{discount.toFixed(2)}
      {booking?.discount_pct ? ` (${booking.discount_pct}% on 1 passenger)` : ''}
      {forDriver && booking?.discount_status !== 'approved' ? ' · Check the ID at pickup' : ''}
      {booking?.discount_status === 'approved' && discountNeedsApproval(type) ? ' · ID approved' : ''}
    </Text>
  );
};

/**
 * What comes off a pending PWD / student booking if the driver approves:
 * 20% of one passenger's share of the regular fare (same rule as the server).
 */
export const pendingDiscount = (booking: { passenger_type?: BookingPassengerType | null; total_fare?: number | null; passenger_count?: number | null }) => {
  const count = Math.max(1, Math.floor(Number(booking.passenger_count ?? 1)));
  const share = Number(booking.total_fare ?? 0) / count;
  const pct = booking.passenger_type ? PASSENGER_DISCOUNT_PCT[booking.passenger_type] : 0;
  return Math.round(Math.round(share * 100) / 100 * pct) / 100;
};

const styles = StyleSheet.create({
  note: { ...typography.bodySmall, fontSize: 11, color: colors.success, marginTop: 2 },
  pending: { color: '#9A6700' },
  revoked: { color: colors.error },
});

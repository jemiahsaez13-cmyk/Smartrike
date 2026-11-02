import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { PASSENGER_TYPE_LABEL, BookingPassengerType } from '@/config/constants';
import { colors, typography } from '@/views/styles/theme';

interface Props {
  booking: {
    passenger_type?: BookingPassengerType | null;
    discount_pct?: number | null;
    discount_amount?: number | null;
    total_fare?: number | null;
    discount_revoked_at?: Date | string | null;
    discount_revoked_reason?: string | null;
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
  // D5: the driver removed the discount (ID missing or not valid).
  if (type && type !== 'regular' && booking?.discount_revoked_at) {
    return (
      <Text style={[styles.note, styles.revoked, style]}>
        {PASSENGER_TYPE_LABEL[type]} discount removed{booking.discount_revoked_reason ? `: ${booking.discount_revoked_reason}` : ''} · Regular fare
      </Text>
    );
  }
  if (!type || type === 'regular' || discount <= 0) return null;
  const total = Number(booking?.total_fare ?? 0);
  return (
    <Text style={[styles.note, style]}>
      Regular ₱{(total + discount).toFixed(2)} · {PASSENGER_TYPE_LABEL[type]} −₱{discount.toFixed(2)}
      {booking?.discount_pct ? ` (${booking.discount_pct}% on 1 passenger)` : ''}
      {forDriver ? ' · Check the ID at pickup' : ''}
    </Text>
  );
};

const styles = StyleSheet.create({
  note: { ...typography.bodySmall, fontSize: 11, color: colors.success, marginTop: 2 },
  revoked: { color: colors.error },
});

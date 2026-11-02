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
  } | null | undefined;
  /** Driver screens remind the driver to check the ID at pickup. */
  forDriver?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * One-line fare breakdown for a discounted booking (D6): regular fare,
 * the discount and what is paid. Renders nothing for a regular fare.
 */
export const FareDiscountNote = ({ booking, forDriver, style }: Props) => {
  const type = booking?.passenger_type;
  const discount = Number(booking?.discount_amount ?? 0);
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
});

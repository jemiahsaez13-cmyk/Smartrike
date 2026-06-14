import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { Booking } from '@/models/types';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

interface BookingCardProps {
  booking: Booking;
  onPress?: () => void;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onPress }) => {
  const statusColors: Record<string, string> = {
    pending: colors.warning,
    accepted: colors.info,
    'in-transit': colors.success,
    completed: colors.textSecondary,
    cancelled: colors.error,
  };

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="labelSmall" style={styles.date}>
            {new Date(booking.created_at).toLocaleDateString()}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColors[booking.status]}18` }]}>
            <Text variant="labelMedium" style={[styles.status, { color: statusColors[booking.status] }]}>
              {booking.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text variant="bodyMedium" style={styles.routeText}>From: {booking.pickup_location.address}</Text>
        <Text variant="bodyMedium" style={styles.routeText}>To: {booking.dropoff_location.address}</Text>
        <Text style={[styles.fare, typography.currency]}>₱{booking.total_fare.toFixed(2)}</Text>
      </Card.Content>
      {onPress && <Card.Actions><Button onPress={onPress}>View Details</Button></Card.Actions>}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  date: {
    color: colors.textLight,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  status: {
    fontWeight: '800',
  },
  routeText: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  fare: {
    marginTop: spacing.sm,
    fontWeight: '800',
    color: colors.success,
  }
});

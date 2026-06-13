import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { Booking } from '@/models/types';

interface BookingCardProps {
  booking: Booking;
  onPress?: () => void;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onPress }) => {
  const statusColors: Record<string, string> = {
    pending: '#FFA500', accepted: '#2196F3', 'in-transit': '#4CAF50',
    completed: '#757575', cancelled: '#F44336'
  };

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <Text variant="labelSmall" style={styles.date}>
          {new Date(booking.created_at).toLocaleDateString()}
        </Text>
        <Text variant="labelMedium" style={[styles.status, { color: statusColors[booking.status] }]}>
          {booking.status.toUpperCase()}
        </Text>
        <Text variant="bodyMedium">From: {booking.pickup_location.address}</Text>
        <Text variant="bodyMedium">To: {booking.dropoff_location.address}</Text>
        <Text variant="titleMedium" style={styles.fare}>₱{booking.total_fare.toFixed(2)}</Text>
      </Card.Content>
      {onPress && <Card.Actions><Button onPress={onPress}>View Details</Button></Card.Actions>}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  date: { color: '#999', marginBottom: 5 },
  status: { fontWeight: 'bold', marginBottom: 10 },
  fare: { marginTop: 10, fontWeight: 'bold', color: '#4CAF50' }
});

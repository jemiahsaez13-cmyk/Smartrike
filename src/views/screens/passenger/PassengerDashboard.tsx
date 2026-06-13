import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';

export const PassengerDashboard = () => {
  const { user } = useAuth();
  const { currentBooking, loading } = useBooking();
  const navigation = useNavigation<any>();

  if (loading) return <Loading message="Loading dashboard..." />;

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.greeting}>Hello, {user?.name}</Text>
      {currentBooking ? (
        <Card style={styles.card}>
          <Card.Title title="Active Booking" />
          <Card.Content>
            <Text>Status: {currentBooking.status}</Text>
            <Text>Pickup: {currentBooking.pickup_location.address}</Text>
            <Text>Dropoff: {currentBooking.dropoff_location.address}</Text>
            <Text>Fare: ₱{currentBooking.total_fare}</Text>
          </Card.Content>
          <Card.Actions><Button onPress={() => navigation.navigate('ActiveTrip')}>View Details</Button></Card.Actions>
        </Card>
      ) : (
        <Card style={styles.card}>
          <Card.Title title="Book a Ride" />
          <Card.Content><Text>Where do you want to go?</Text></Card.Content>
          <Card.Actions><Button mode="contained" onPress={() => navigation.navigate('BookRide')}>Book Now</Button></Card.Actions>
        </Card>
      )}
      <View style={styles.quickActions}>
        <Button mode="outlined" onPress={() => navigation.navigate('TripHistory')} style={styles.actionButton}>Trip History</Button>
        <Button mode="outlined" onPress={() => navigation.navigate('Profile')} style={styles.actionButton}>Profile</Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  greeting: { marginBottom: 20, fontWeight: 'bold' },
  card: { marginBottom: 20 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: { flex: 1, marginHorizontal: 5 }
});

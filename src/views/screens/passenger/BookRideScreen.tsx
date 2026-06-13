import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useLocation } from '@/controllers/hooks/useLocation';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';

export const BookRideScreen = () => {
  const { user } = useAuth();
  const { bookRide, loading } = useBooking();
  const { currentLocation, getLocation } = useLocation();
  const navigation = useNavigation<any>();
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(true);

  useEffect(() => {
    getLocation().then(() => setLoadingLocation(false));
  }, []);

  useEffect(() => {
    if (currentLocation) setPickupAddress(currentLocation.address || 'Current Location');
  }, [currentLocation]);

  const handleBooking = async () => {
    if (!currentLocation || !dropoffAddress) {
      Alert.alert('Error', 'Please enter destination');
      return;
    }
    try {
      await bookRide(user!.id, currentLocation, {
        latitude: 13.45, longitude: 121.85, address: dropoffAddress
      });
      navigation.navigate('ConfirmBooking');
    } catch (error) {
      Alert.alert('Failed', 'Unable to create booking');
    }
  };

  if (loadingLocation || loading) return <Loading message="Preparing booking..." />;

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Book a Ride</Text>
      <TextInput label="Pickup" value={pickupAddress} disabled style={styles.input} />
      <TextInput label="Destination" value={dropoffAddress} onChangeText={setDropoffAddress} placeholder="Enter destination" style={styles.input} />
      <Button mode="contained" onPress={handleBooking} disabled={!dropoffAddress} style={styles.button}>Book Ride</Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { marginBottom: 30, fontWeight: 'bold' },
  input: { marginBottom: 15 },
  button: { marginTop: 20 }
});

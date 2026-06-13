import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useLocation } from '@/controllers/hooks/useLocation';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { colors, spacing, shadows } from '@/views/styles/theme';

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
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapOverlay}>
          <Text style={styles.mapText}>🗺️</Text>
          <Text style={styles.mapLabel}>Map View</Text>
        </View>
        <View style={styles.currentLocationPin}>
          <Text style={styles.pinIcon}>📍</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.handle} />
        
        <Text style={styles.title}>Where to?</Text>

        <View style={styles.locationCard}>
          <View style={styles.locationDot} />
          <View style={styles.locationInputContainer}>
            <Text style={styles.inputLabel}>Pickup Location</Text>
            <TextInput
              value={pickupAddress}
              disabled
              style={styles.input}
              mode="flat"
              underlineColor="transparent"
            />
          </View>
        </View>

        <View style={[styles.locationCard, styles.destinationCard]}>
          <View style={[styles.locationDot, styles.destinationDot]} />
          <View style={styles.locationInputContainer}>
            <Text style={styles.inputLabel}>Destination</Text>
            <TextInput
              value={dropoffAddress}
              onChangeText={setDropoffAddress}
              placeholder="Where are you going?"
              style={styles.input}
              mode="flat"
              underlineColor="transparent"
            />
          </View>
        </View>

        <View style={styles.estimateCard}>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>🕐 Est. Time</Text>
            <Text style={styles.estimateValue}>~10 mins</Text>
          </View>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>💰 Est. Fare</Text>
            <Text style={styles.estimateValue}>₱50-80</Text>
          </View>
        </View>

        <Button
          mode="contained"
          onPress={handleBooking}
          disabled={!dropoffAddress}
          style={styles.bookButton}
        >
          Confirm Booking
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapPlaceholder: { height: '40%', backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  mapOverlay: { alignItems: 'center' },
  mapText: { fontSize: 64 },
  mapLabel: { fontSize: 16, color: colors.textSecondary, marginTop: spacing.sm },
  currentLocationPin: { position: 'absolute' },
  pinIcon: { fontSize: 40 },
  content: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, padding: spacing.lg, ...shadows.lg },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: spacing.lg },
  locationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
  destinationCard: { marginBottom: spacing.lg },
  locationDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginRight: spacing.md },
  destinationDot: { backgroundColor: colors.accent },
  locationInputContainer: { flex: 1 },
  inputLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  input: { backgroundColor: 'transparent', paddingHorizontal: 0, margin: 0, height: 36 },
  estimateCard: { backgroundColor: colors.primaryLight, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  estimateLabel: { fontSize: 14, color: colors.text },
  estimateValue: { fontSize: 14, fontWeight: '600', color: colors.primary },
  bookButton: { paddingVertical: spacing.xs }
});

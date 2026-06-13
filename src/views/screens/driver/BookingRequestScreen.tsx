import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector, useAppDispatch } from '@/controllers/store';
import { acceptBooking, removeIncomingRequest } from '@/controllers/slices/driverSlice';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { colors, spacing, shadows } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

export const BookingRequestScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { user } = useAppSelector(state => state.auth);
  const { incomingRequests, loading } = useAppSelector(state => state.driver);

  const handleAccept = async (bookingId: string) => {
    try {
      await dispatch(acceptBooking({ bookingId, driverId: user!.id })).unwrap();
      navigation.navigate('DriverDashboard');
      Alert.alert('Success', 'Ride accepted! Head to the pickup location.');
    } catch (error: any) {
      Alert.alert('Error', error || 'Failed to accept ride');
    }
  };

  const handleReject = (bookingId: string) => {
    dispatch(removeIncomingRequest(bookingId));
  };

  if (incomingRequests.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="inbox-outline" size={80} color={colors.textLight} style={{ marginBottom: spacing.lg }} />
        <Text style={styles.emptyTitle}>No active requests</Text>
        <Text style={styles.emptySubtitle}>We'll notify you when a passenger books a ride nearby.</Text>
        <Button variant="outline" onPress={() => navigation.goBack()} style={styles.backBtn}>
          Back to Dashboard
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton icon="chevron-left" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Incoming Requests</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {incomingRequests.map((request) => (
          <Surface key={request.id} style={styles.requestCard} elevation={3}>
            <View style={styles.cardHeader}>
              <View style={styles.passengerInfo}>
                <View style={styles.passengerAvatar}>
                  <MaterialCommunityIcons name="account" size={24} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.passengerLabel}>Passenger</Text>
                  <Text style={styles.passengerName}>New Ride Request</Text>
                </View>
              </View>
              <Text style={styles.fareAmount}>₱{request.total_fare}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.tripDetails}>
              <View style={styles.locationItem}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>PICKUP</Text>
                  <Text style={styles.locationText}>{request.pickup_location.address}</Text>
                </View>
              </View>
              <View style={styles.pathLine} />
              <View style={styles.locationItem}>
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>DROPOFF</Text>
                  <Text style={styles.locationText}>{request.dropoff_location.address}</Text>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Button 
                variant="outline" 
                onPress={() => handleReject(request.id)} 
                style={styles.rejectBtn}
                containerStyle={{ flex: 1 }}
              >
                Decline
              </Button>
              <Button 
                variant="primary" 
                onPress={() => handleAccept(request.id)} 
                loading={loading}
                disabled={loading}
                style={styles.acceptBtn}
                containerStyle={{ flex: 2 }}
              >
                Accept Ride
              </Button>
            </View>
          </Surface>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingTop: 50, 
    paddingBottom: 10,
    backgroundColor: colors.surface,
    ...shadows.sm
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  placeholder: { width: 48 },
  scrollContent: { padding: spacing.lg },
  requestCard: { 
    backgroundColor: colors.surface, 
    borderRadius: 24, 
    padding: spacing.lg, 
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  passengerInfo: { flexDirection: 'row', alignItems: 'center' },
  passengerAvatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: colors.primaryLight, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: spacing.md
  },
  passengerLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  passengerName: { fontSize: 16, fontWeight: '800', color: colors.text },
  fareAmount: { fontSize: 22, fontWeight: '900', color: colors.primary },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md },
  tripDetails: { marginVertical: spacing.sm },
  locationItem: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 14, marginRight: 16 },
  pathLine: { width: 2, height: 20, backgroundColor: colors.borderLight, marginLeft: 4, marginVertical: -4 },
  locationInfo: { flex: 1 },
  locationLabel: { fontSize: 10, color: colors.textLight, fontWeight: '800', letterSpacing: 1 },
  locationText: { fontSize: 14, color: colors.text, fontWeight: '500', marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  rejectBtn: { borderColor: colors.error },
  acceptBtn: { },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  emptySubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
  backBtn: { marginTop: spacing.xl, width: '100%' }
});

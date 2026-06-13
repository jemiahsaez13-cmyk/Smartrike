import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { colors, spacing, shadows } from '@/views/styles/theme';

export const PassengerDashboard = () => {
  const { user } = useAuth();
  const { currentBooking, loading } = useBooking();
  const navigation = useNavigation<any>();

  if (loading) return <Loading message="Loading dashboard..." />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name}>{user?.name || 'Guest'}</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'G'}</Text>
        </TouchableOpacity>
      </View>

      {currentBooking ? (
        <View style={[styles.card, styles.activeCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🚗 Active Ride</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{currentBooking.status}</Text>
            </View>
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationText}>{currentBooking.pickup_location.address}</Text>
            </View>
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>🎯</Text>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Dropoff</Text>
              <Text style={styles.locationText}>{currentBooking.dropoff_location.address}</Text>
            </View>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Total Fare</Text>
            <Text style={styles.fareAmount}>₱{currentBooking.total_fare}</Text>
          </View>
          <Button mode="contained" onPress={() => navigation.navigate('ActiveTrip')} style={styles.viewBtn}>
            View Details
          </Button>
        </View>
      ) : (
        <View style={[styles.card, styles.bookCard]}>
          <Text style={styles.bookIcon}>🚲</Text>
          <Text style={styles.bookTitle}>Ready for your next ride?</Text>
          <Text style={styles.bookSubtitle}>Book a tricycle in just a few taps</Text>
          <Button mode="contained" onPress={() => navigation.navigate('BookRide')} style={styles.bookBtn}>
            Book a Ride
          </Button>
        </View>
      )}

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('TripHistory')}>
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>Trip History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.actionIcon}>👤</Text>
          <Text style={styles.actionText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
  greeting: { fontSize: 16, color: colors.textSecondary },
  name: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginTop: spacing.xs },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, margin: spacing.md, ...shadows.md },
  activeCard: { borderLeftWidth: 4, borderLeftColor: colors.success },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  statusBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', color: colors.primary, textTransform: 'capitalize' },
  locationRow: { flexDirection: 'row', marginBottom: spacing.md },
  locationIcon: { fontSize: 24, marginRight: spacing.sm },
  locationInfo: { flex: 1 },
  locationLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  locationText: { fontSize: 14, color: colors.text },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  fareLabel: { fontSize: 14, color: colors.textSecondary },
  fareAmount: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
  viewBtn: { marginTop: spacing.sm },
  bookCard: { alignItems: 'center', paddingVertical: spacing.xl },
  bookIcon: { fontSize: 64, marginBottom: spacing.md },
  bookTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: spacing.xs },
  bookSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
  bookBtn: { width: '100%' },
  quickActions: { flexDirection: 'row', padding: spacing.md, gap: spacing.md },
  actionCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, alignItems: 'center', ...shadows.sm },
  actionIcon: { fontSize: 32, marginBottom: spacing.sm },
  actionText: { fontSize: 14, fontWeight: '600', color: colors.text }
});

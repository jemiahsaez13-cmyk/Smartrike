import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { Card } from '@/views/components/common/Card';
import { colors, gradients, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Booking } from '@/models/types';

const POPULAR_DESTINATIONS = [
  { id: 1, title: 'Public Market', sub: 'Boac town center', icon: 'storefront-outline', eta: '4 min', fare: '₱45.00' },
  { id: 2, title: 'Marinduque State College', sub: 'Tanza, Boac', icon: 'school-outline', eta: '9 min', fare: '₱68.00' },
  { id: 3, title: 'Provincial Hospital', sub: 'Emergency and outpatient', icon: 'hospital-building', eta: '7 min', fare: '₱60.00' },
];

export const PassengerDashboard = () => {
  const { user } = useAuth();
  const { currentBooking, loading: bookingLoading } = useBooking();
  const navigation = useNavigation<any>();
  const [recentTrips, setRecentTrips] = useState<Booking[]>([]);
  const [fetchingActivity, setFetchingActivity] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    if (user?.id) {
      loadActivity();
    }
  }, [user?.id]);

  const loadActivity = async () => {
    if (!user?.id) return;
    setFetchingActivity(true);
    try {
      const repo = new BookingRepository();
      const data = await repo.findByPassenger(user.id);
      if (Array.isArray(data)) {
        setRecentTrips(data.slice(0, 3));
      }
    } catch (error) {
      console.error('Failed to load activity:', error);
    } finally {
      setFetchingActivity(false);
    }
  };

  if (bookingLoading && !currentBooking) return <Loading message="Syncing with TODA..." />;

  const handleSupport = () => {
    Alert.alert(
      'Dispatch Support',
      'For urgent trip help, contact the TODA desk or use Emergency SOS during an active trip.'
    );
  };

  const handleSavedPlaces = () => {
    Alert.alert('Saved Places', 'Use a popular destination below or book a ride to save it after your trip.');
  };

  const bookDestination = (destination: string) => {
    navigation.navigate('BookRide', { destination });
  };

  const QuickAction = ({ icon, label, onPress, color = colors.primary }: any) => (
    <TouchableOpacity 
      style={styles.quickAction} 
      onPress={onPress} 
      activeOpacity={0.8}
    >
      <Card variant="elevated" padding="md" style={styles.quickActionCard}>
        <View style={styles.quickIcon}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.quickLabel}>{label}</Text>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>GOOD DAY,</Text>
            <Text style={styles.name}>{user?.name?.split(' ')[0] || 'Passenger'}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <LinearGradient
              colors={['#fff', '#f0f0f0']}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'P'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.bookingStatusPill}>
          <View style={[styles.statusDot, { backgroundColor: currentBooking ? colors.success : colors.accent }]} />
          <Text style={styles.statusText}>
            {currentBooking ? 'TRIP ACTIVE' : 'DRIVERS NEARBY'}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Card variant="elevated" padding="lg" style={styles.primaryCard}>
          {currentBooking ? (
            <>
              <View style={styles.activeTripHeader}>
                <View style={styles.activeBadge}>
                  <MaterialCommunityIcons name="radar" size={16} color={colors.success} />
                  <Text style={styles.activeBadgeText}>ON THE WAY</Text>
                </View>
                <Text style={[styles.activeFare, typography.currency]}>
                  ₱{(currentBooking.total_fare || 0).toFixed(2)}
                </Text>
              </View>

              <View style={styles.tripLocations}>
                <View style={styles.locationLine} />
                <View style={styles.locationRow}>
                  <View style={[styles.locationDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.locationName} numberOfLines={1}>{currentBooking.pickup_location?.address || 'Pickup'}</Text>
                </View>
                <View style={styles.locationRow}>
                  <View style={[styles.locationDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.locationName} numberOfLines={1}>{currentBooking.dropoff_location?.address || 'Dropoff'}</Text>
                </View>
              </View>

              <Button
                variant="primary"
                onPress={() => navigation.navigate('ActiveTrip')}
              >
                Track Active Ride
              </Button>
            </>
          ) : (
            <>
              <View style={styles.bookHeader}>
                <View style={styles.bookText}>
                  <Text style={styles.bookTitle}>Where to?</Text>
                  <Text style={styles.bookSub}>Safe & affordable rides in Boac.</Text>
                </View>
                <View style={styles.bookIconBox}>
                  <TricycleIcon size={80} color={colors.primary} />
                </View>
              </View>
              
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>42</Text>
                  <Text style={styles.statLabel}>Drivers</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>4m</Text>
                  <Text style={styles.statLabel}>ETA</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>Fixed</Text>
                  <Text style={styles.statLabel}>Rates</Text>
                </View>
              </View>

              <Button
                variant="primary"
                onPress={() => navigation.navigate('BookRide')}
              >
                Book a Ride Now
              </Button>
            </>
          )}
        </Card>

        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        <Card variant="elevated" padding="none" style={styles.activityCard}>
          {fetchingActivity ? (
            <View style={styles.activityLoading}>
              <Text style={styles.activityLabel}>Loading activity...</Text>
            </View>
          ) : recentTrips.length === 0 ? (
            <View style={styles.activityEmpty}>
              <MaterialCommunityIcons name="history" size={24} color={colors.textMuted} />
              <Text style={styles.activityLabel}>No recent trips yet</Text>
            </View>
          ) : (
            recentTrips.map((trip, idx) => (
              <View key={trip?.id || idx} style={[styles.activityItem, idx === recentTrips.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.activityIconBox}>
                  <MaterialCommunityIcons 
                    name={trip.status === 'completed' ? 'check-circle' : 'close-circle'} 
                    size={20} 
                    color={trip.status === 'completed' ? colors.success : colors.error} 
                  />
                </View>
                <View style={styles.activityText}>
                  <Text style={styles.activityTitle}>{trip.status === 'completed' ? 'Trip Completed' : 'Trip Cancelled'}</Text>
                  <Text style={styles.activityTime} numberOfLines={1}>
                    {trip.created_at ? new Date(trip.created_at).toLocaleDateString() : 'N/A'} • {trip.dropoff_location?.address || 'No address'}
                  </Text>
                </View>
                <Text style={[styles.activityAmt, typography.currency]}>
                  ₱{(trip.total_fare || 0).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </Card>

        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.actionsGrid}>
          <QuickAction icon="history" label="History" onPress={() => navigation.navigate('History')} />
          <QuickAction icon="bookmark-outline" label="Saved" onPress={handleSavedPlaces} color={colors.secondary} />
          <QuickAction icon="message-text-outline" label="Support" onPress={handleSupport} color={colors.info} />
          <QuickAction icon="account-cog-outline" label="Profile" onPress={() => navigation.navigate('Profile')} color={colors.primary500} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>POPULAR PLACES</Text>
          <TouchableOpacity onPress={handleSavedPlaces}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {POPULAR_DESTINATIONS.map(item => (
          <TouchableOpacity key={item.id} onPress={() => bookDestination(item.title)} activeOpacity={0.8}>
            <Card variant="elevated" padding="md" style={styles.placeCard}>
              <View style={styles.placeIconBox}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color={colors.primary} />
              </View>
              <View style={styles.placeInfo}>
                <Text style={styles.placeTitle}>{item.title}</Text>
                <Text style={styles.placeSub}>{item.sub}</Text>
                <Text style={[styles.placeMeta, typography.currency, { color: colors.secondary }]}>{item.eta} • {item.fare}</Text>
              </View>
              <Button variant="secondary" compact style={styles.bookMiniBtn}>Book</Button>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 280,
    paddingTop: 60,
    paddingHorizontal: spacing.screen,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    ...typography.label,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  name: {
    ...typography.h1,
    color: '#fff',
    fontSize: 32,
    marginTop: -4,
  },
  profileBtn: {
    width: 54,
    height: 54,
    borderRadius: 18,
    ...shadows.md,
  },
  avatarGradient: {
    flex: 1,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.h2,
    color: colors.primary,
  },
  bookingStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 24,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    ...typography.label,
    color: '#fff',
    fontSize: 10,
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  body: {
    marginTop: -80,
    paddingHorizontal: spacing.screen,
    paddingBottom: 130,
  },
  primaryCard: {
    ...shadows.xl,
    marginBottom: 32,
  },
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  activeBadgeText: {
    ...typography.label,
    color: colors.success,
    fontSize: 10,
  },
  activeFare: {
    ...typography.h2,
    color: colors.text,
  },
  tripLocations: {
    marginBottom: 24,
    paddingLeft: 24,
    position: 'relative',
  },
  locationLine: {
    position: 'absolute',
    left: 7,
    top: 10,
    bottom: 10,
    width: 2,
    backgroundColor: colors.borderLight,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  locationDot: {
    position: 'absolute',
    left: -24,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadows.sm,
  },
  locationName: {
    ...typography.subtitle,
    color: colors.text,
  },
  bookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  bookText: {
    flex: 1,
  },
  bookTitle: {
    ...typography.h1,
    color: colors.text,
  },
  bookSub: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  bookIconBox: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statNum: {
    ...typography.h3,
    color: colors.primary,
  },
  statLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: 32,
    overflow: 'hidden',
  },
  activityLoading: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  activityEmpty: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: 8,
  },
  activityLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  activityIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityText: {
    flex: 1,
    marginRight: 8,
  },
  activityTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
  },
  activityTime: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  activityAmt: {
    ...typography.label,
    color: colors.text,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  quickAction: {
    width: '48%',
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  quickIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickLabel: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAll: {
    ...typography.label,
    color: colors.primary,
    fontSize: 12,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  placeIconBox: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  placeInfo: {
    flex: 1,
  },
  placeTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  placeSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  placeMeta: {
    ...typography.label,
    color: colors.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  bookMiniBtn: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
  }
});

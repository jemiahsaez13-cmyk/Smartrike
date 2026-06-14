import React, { useEffect, useRef } from 'react';
import { Alert, Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { colors, gradients, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const POPULAR_DESTINATIONS = [
  { id: 1, title: 'Public Market', sub: 'Boac town center', icon: 'storefront-outline', eta: '4 min', fare: '₱45' },
  { id: 2, title: 'Marinduque State College', sub: 'Tanza, Boac', icon: 'school-outline', eta: '9 min', fare: '₱68' },
  { id: 3, title: 'Provincial Hospital', sub: 'Emergency and outpatient', icon: 'hospital-building', eta: '7 min', fare: '₱60' },
];

export const PassengerDashboard = () => {
  const { user } = useAuth();
  const { currentBooking, loading } = useBooking();
  const navigation = useNavigation<any>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  if (loading) return <Loading message="Syncing with TODA..." />;

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

  const QuickAction = ({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.quickIcon}>
        <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Good day</Text>
            <Text style={styles.name} numberOfLines={1}>{user?.name || 'Passenger'}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
            accessibilityLabel="Open profile"
          >
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'P'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerSummary}>
          <View style={styles.summaryPill}>
            <View style={[styles.summaryDot, { backgroundColor: currentBooking ? colors.success : colors.accent }]} />
            <Text style={styles.summaryText}>
              {currentBooking ? 'Trip active' : 'Drivers nearby'}
            </Text>
          </View>
          <Text style={styles.summaryCopy}>
            {currentBooking ? 'Track your ride and trip fare in real time.' : 'Book a verified tricycle around Boac.'}
          </Text>
        </View>
      </LinearGradient>

      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Surface style={styles.primaryCard} elevation={2}>
          {currentBooking ? (
            <>
              <View style={styles.cardHeader}>
                <View style={styles.statusBadge}>
                  <MaterialCommunityIcons name="map-marker-path" size={16} color={colors.success} />
                  <Text style={styles.statusText}>Trip in progress</Text>
                </View>
                <Text style={styles.fareAmount}>₱{currentBooking.total_fare}</Text>
              </View>

              <View style={styles.tripPath}>
                <View style={styles.pathLine} />
                <View style={styles.locationRow}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {currentBooking.pickup_location.address}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {currentBooking.dropoff_location.address}
                  </Text>
                </View>
              </View>

              <Button
                variant="primary"
                icon="map-marker"
                onPress={() => navigation.navigate('ActiveTrip')}
              >
                Track Ride
              </Button>
            </>
          ) : (
            <>
              <View style={styles.bookContent}>
                <View style={styles.bookCopy}>
                  <Text style={styles.bookEyebrow}>Passenger booking</Text>
                  <Text style={styles.bookTitle}>Where to next?</Text>
                  <Text style={styles.bookSubtitle}>Choose a destination and see your TODA fare before confirming.</Text>
                </View>
                <View style={styles.bookIconBox}>
                  <TricycleIcon size={70} color={colors.primary} />
                </View>
              </View>
              <View style={styles.readinessRow}>
                <View style={styles.readinessItem}>
                  <Text style={styles.readinessValue}>42</Text>
                  <Text style={styles.readinessLabel}>drivers</Text>
                </View>
                <View style={styles.readinessItem}>
                  <Text style={styles.readinessValue}>4 min</Text>
                  <Text style={styles.readinessLabel}>pickup</Text>
                </View>
                <View style={styles.readinessItem}>
                  <Text style={styles.readinessValue}>Cash</Text>
                  <Text style={styles.readinessLabel}>payment</Text>
                </View>
              </View>
              <Button
                variant="primary"
                icon="arrow-right"
                contentStyle={styles.primaryButtonContent}
                onPress={() => navigation.navigate('BookRide')}
              >
                Book a Ride
              </Button>
            </>
          )}
        </Surface>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickActionsGrid}>
          <QuickAction icon="history" label="Trip History" onPress={() => navigation.navigate('History')} />
          <QuickAction icon="bookmark-outline" label="Saved Places" onPress={handleSavedPlaces} />
          <QuickAction icon="message-text-outline" label="Support" onPress={handleSupport} />
          <QuickAction icon="account-cog-outline" label="Profile Settings" onPress={() => navigation.navigate('Profile')} />
        </View>

        <Surface style={styles.serviceCard} elevation={1}>
          <View style={styles.serviceHeader}>
            <View style={styles.serviceIcon}>
              <MaterialCommunityIcons name="radar" size={22} color={colors.secondary} />
            </View>
            <View style={styles.serviceCopy}>
              <Text style={styles.serviceTitle}>Live service window</Text>
              <Text style={styles.serviceSubtitle}>Market and terminal zones are moving normally.</Text>
            </View>
          </View>
          <View style={styles.serviceMeter}>
            <View style={styles.serviceMeterFill} />
          </View>
          <View style={styles.serviceFooter}>
            <Text style={styles.serviceMeta}>Demand: moderate</Text>
            <Text style={styles.serviceMeta}>Queue: 3 requests</Text>
          </View>
        </Surface>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Destinations</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={handleSavedPlaces}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentList}>
          {POPULAR_DESTINATIONS.map(item => (
            <TouchableOpacity key={item.id} style={styles.recentItem} activeOpacity={0.76} onPress={() => bookDestination(item.title)}>
              <View style={styles.recentIconBox}>
                <MaterialCommunityIcons name={item.icon as any} size={22} color={colors.primary} />
              </View>
              <View style={styles.recentInfo}>
                <Text style={styles.recentTitle}>{item.title}</Text>
                <Text style={styles.recentSub}>{item.sub}</Text>
                <Text style={styles.recentMeta}>{item.eta} pickup • {item.fare} estimate</Text>
              </View>
              <View style={styles.bookMiniBtn}>
                <Text style={styles.bookMiniText}>Book</Text>
              </View>
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
    minHeight: 230,
    paddingTop: layout.headerTop,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  greeting: {
    ...typography.body,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
  },
  name: {
    ...typography.display,
    color: '#FFFFFF',
    fontSize: 28,
    marginTop: spacing.xs,
    letterSpacing: 0,
  },
  profileBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.title,
    color: '#FFFFFF',
    fontSize: 22,
  },
  headerSummary: {
    marginTop: spacing.xl,
  },
  summaryPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  summaryText: {
    ...typography.label,
    color: '#FFFFFF',
    fontSize: 13,
  },
  summaryCopy: {
    ...typography.body,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
    maxWidth: 310,
  },
  scroll: {
    flex: 1,
    marginTop: -28,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: layout.contentBottom,
  },
  primaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    gap: spacing.xs,
  },
  statusText: {
    ...typography.label,
    color: colors.success,
    fontSize: 12,
  },
  fareAmount: {
    ...typography.number,
    color: colors.text,
    fontSize: 24,
  },
  tripPath: {
    marginBottom: spacing.lg,
    paddingLeft: 22,
    position: 'relative',
  },
  pathLine: {
    position: 'absolute',
    left: 5,
    top: 12,
    bottom: 12,
    width: 2,
    backgroundColor: colors.border,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  dot: {
    position: 'absolute',
    left: -22,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  locationText: {
    ...typography.subtitle,
    flex: 1,
    color: colors.textSecondary,
    fontSize: 15,
  },
  bookContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  bookCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  bookEyebrow: {
    ...typography.label,
    color: colors.primary,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  bookTitle: {
    ...typography.display,
    color: colors.text,
    fontSize: 28,
    letterSpacing: 0,
  },
  bookSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  bookIconBox: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readinessRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  readinessItem: {
    flex: 1,
    minHeight: 66,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  readinessValue: {
    ...typography.number,
    color: colors.text,
    fontSize: 17,
  },
  readinessLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  primaryButtonContent: {
    minHeight: 52,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
  },
  seeAll: {
    ...typography.label,
    color: colors.primary,
    fontSize: 14,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAction: {
    width: '48.5%',
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  quickLabel: {
    ...typography.label,
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  serviceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  serviceCopy: {
    flex: 1,
  },
  serviceTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 15,
  },
  serviceSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  serviceMeter: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  serviceMeterFill: {
    width: '68%',
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: radius.pill,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  serviceMeta: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
  },
  recentList: {
    gap: spacing.sm,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  recentIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  recentInfo: {
    flex: 1,
  },
  recentTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 16,
  },
  recentSub: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  recentMeta: {
    ...typography.label,
    color: colors.secondary,
    fontSize: 12,
    marginTop: 3,
  },
  bookMiniBtn: {
    minWidth: 54,
    minHeight: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  bookMiniText: {
    ...typography.label,
    color: '#FFFFFF',
    fontSize: 12,
  },
});

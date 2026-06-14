import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, Surface, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { addIncomingRequest, fetchCompletedTrips, updateDriverStatus } from '@/controllers/slices/driverSlice';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { colors, gradients, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const DEMAND_ZONES = [
  { area: 'Boac Public Market', demand: 'High', eta: '4 min', color: colors.coral },
  { area: 'Terminal / Town Plaza', demand: 'Moderate', eta: '6 min', color: colors.warning },
  { area: 'MSC Tanza Gate', demand: 'Steady', eta: '9 min', color: colors.secondary },
];

export const DriverDashboard = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { user } = useAppSelector(state => state.auth);
  const { currentStatus, dailyEarnings, incomingRequests, loading } = useAppSelector(state => state.driver);
  const isOnline = currentStatus === 'online' || currentStatus === 'on-trip';

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

    if (user?.id) dispatch(fetchCompletedTrips(user.id));
  }, [dispatch, fadeAnim, slideAnim, user?.id]);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    new BookingRepository()
      .findActiveBookings()
      .then((bookings) => {
        if (cancelled) return;
        bookings
          .filter((booking) => booking.status === 'pending')
          .forEach((booking) => dispatch(addIncomingRequest(booking)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [dispatch, isOnline]);

  const toggleStatus = async () => {
    if (!user?.id) return;
    const newStatus = isOnline ? 'offline' : 'online';
    await dispatch(updateDriverStatus({ driverId: user.id, status: newStatus }));
  };

  if (loading) return <Loading message="Updating duty status..." />;

  const StatCard = ({ label, value, icon, color = colors.primary }: any) => (
    <Surface style={styles.statCard} elevation={1}>
      <View style={[styles.statIconBox, { backgroundColor: `${color}18` }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Surface>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isOnline ? gradients.brand : gradients.offline}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={styles.welcome}>Driver console</Text>
            <Text style={styles.driverName} numberOfLines={1}>{user?.name || 'Driver'}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
            accessibilityLabel="Open profile"
          >
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'D'}</Text>
          </TouchableOpacity>
        </View>

        <Surface style={styles.statusCard} elevation={2}>
          <View style={styles.statusInfo}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.textLight }]} />
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabelText}>
                {isOnline ? 'Online and ready' : 'Offline'}
              </Text>
              <Text style={styles.statusSubtext}>
                {isOnline ? 'Incoming passenger requests will appear below.' : 'Go online to receive TODA bookings.'}
              </Text>
            </View>
          </View>
          <Switch value={isOnline} onValueChange={toggleStatus} color={colors.primary} />
        </Surface>
      </LinearGradient>

      <Animated.ScrollView
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          <StatCard
            label="Earnings Today"
            value={`₱${dailyEarnings.toFixed(2)}`}
            icon="cash-multiple"
            color={colors.success}
          />
          <StatCard label="Acceptance" value="94%" icon="check-all" color={colors.primary} />
        </View>

        <Surface style={styles.shiftCard} elevation={1}>
          <View style={styles.shiftHeader}>
            <View>
              <Text style={styles.shiftTitle}>Shift Target</Text>
              <Text style={styles.shiftSubtitle}>Daily goal based on current TODA queue.</Text>
            </View>
            <Text style={styles.shiftAmount}>₱850</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, (dailyEarnings / 850) * 100)}%` }]} />
          </View>
          <View style={styles.shiftFooter}>
            <Text style={styles.shiftMeta}>Collected ₱{dailyEarnings.toFixed(0)}</Text>
            <Text style={styles.shiftMeta}>₱{Math.max(0, 850 - dailyEarnings).toFixed(0)} left</Text>
          </View>
        </Surface>

        {incomingRequests.length > 0 ? (
          <Surface style={styles.requestAlert} elevation={2}>
            <View style={styles.requestHeader}>
              <View style={styles.requestIconBox}>
                <MaterialCommunityIcons name="bell-ring-outline" size={24} color={colors.warning} />
              </View>
              <View style={styles.requestCopy}>
                <Text style={styles.requestTitle}>New ride requests</Text>
                <Text style={styles.requestDesc}>Passengers are waiting near your location.</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{incomingRequests.length}</Text>
              </View>
            </View>
            <Button
              variant="primary"
              icon="format-list-bulleted"
              onPress={() => navigation.navigate('BookingRequests')}
            >
              View Requests
            </Button>
          </Surface>
        ) : isOnline ? (
          <Surface style={styles.emptyState} elevation={1}>
            <View style={styles.emptyIconBox}>
              <MaterialCommunityIcons name="radar" size={34} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Listening for nearby bookings</Text>
            <Text style={styles.emptySubtitle}>Keep this screen open while waiting for passenger alerts.</Text>
          </Surface>
        ) : (
          <Surface style={styles.emptyState} elevation={1}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.surfaceAlt }]}>
              <MaterialCommunityIcons name="power-sleep" size={34} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>You are offline</Text>
            <Text style={styles.emptySubtitle}>Use the duty switch above when you are ready to accept rides.</Text>
          </Surface>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Demand Zones</Text>
        </View>

        <View style={styles.zoneList}>
          {DEMAND_ZONES.map((zone) => (
            <TouchableOpacity key={zone.area} style={styles.zoneItem} activeOpacity={0.76}>
              <View style={[styles.zoneMarker, { backgroundColor: `${zone.color}20` }]}>
                <View style={[styles.zoneDot, { backgroundColor: zone.color }]} />
              </View>
              <View style={styles.zoneCopy}>
                <Text style={styles.zoneArea}>{zone.area}</Text>
                <Text style={styles.zoneMeta}>{zone.demand} demand • {zone.eta} pickup radius</Text>
              </View>
              <MaterialCommunityIcons name="navigation-variant-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {[1, 2, 3].map((item) => (
          <TouchableOpacity key={item} style={styles.activityItem} activeOpacity={0.76}>
            <View style={styles.activityIcon}>
              <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.success} />
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle}>Trip Completed</Text>
              <Text style={styles.activityTime}>Today, 10:30 AM</Text>
            </View>
            <Text style={styles.activityAmount}>+₱45.00</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Performance</Text>
        </View>

        <Surface style={styles.performanceCard} elevation={1}>
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Rating</Text>
            <View style={styles.ratingContainer}>
              <MaterialCommunityIcons name="star" size={18} color={colors.warning} />
              <Text style={styles.performanceValue}>4.8</Text>
            </View>
          </View>
          <View style={styles.performanceDivider} />
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Completed</Text>
            <Text style={styles.performanceValue}>247</Text>
          </View>
          <View style={styles.performanceDivider} />
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Cancelled</Text>
            <Text style={styles.performanceValue}>3</Text>
          </View>
        </Surface>
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
    paddingTop: layout.headerTop,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  welcome: {
    ...typography.body,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
  },
  driverName: {
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
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
  },
  statusCopy: {
    flex: 1,
  },
  statusLabelText: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 15,
  },
  statusSubtext: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  content: {
    flex: 1,
    marginTop: -20,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: layout.contentBottom,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    ...shadows.sm,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    ...typography.number,
    color: colors.text,
    fontSize: 22,
  },
  statLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  shiftCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  shiftTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 16,
  },
  shiftSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  shiftAmount: {
    ...typography.number,
    color: colors.primary,
    fontSize: 20,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },
  shiftFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  shiftMeta: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
  },
  requestAlert: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  requestIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  requestCopy: {
    flex: 1,
  },
  requestTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
  },
  requestDesc: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  countText: {
    ...typography.label,
    color: '#FFFFFF',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
    textAlign: 'center',
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
  seeAllText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 14,
  },
  zoneList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  zoneItem: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  zoneMarker: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  zoneDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  zoneCopy: {
    flex: 1,
  },
  zoneArea: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 14,
  },
  zoneMeta: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  activityItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 15,
  },
  activityTime: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  activityAmount: {
    ...typography.number,
    color: colors.success,
    fontSize: 15,
  },
  performanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  performanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  performanceLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  performanceValue: {
    ...typography.number,
    color: colors.text,
    fontSize: 18,
  },
  performanceDivider: {
    width: 1,
    height: 42,
    backgroundColor: colors.borderLight,
  },
});

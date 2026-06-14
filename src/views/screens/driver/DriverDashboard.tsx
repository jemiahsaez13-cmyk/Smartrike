import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { Text, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { addIncomingRequest, fetchCompletedTrips, updateDriverStatus } from '@/controllers/slices/driverSlice';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { Card } from '@/views/components/common/Card';
import { colors, gradients, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const DEMAND_ZONES = [
  { area: 'Boac Public Market', demand: 'High', eta: '4 min', color: colors.error },
  { area: 'Terminal / Town Plaza', demand: 'Moderate', eta: '6 min', color: colors.warning },
  { area: 'MSC Tanza Gate', demand: 'Steady', eta: '9 min', color: colors.success },
];

export const DriverDashboard = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { user } = useAppSelector(state => state.auth);
  const { currentStatus, dailyEarnings, incomingRequests, loading } = useAppSelector(state => state.driver);
  const isOnline = currentStatus === 'online' || currentStatus === 'on-trip';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    if (user?.id) dispatch(fetchCompletedTrips(user.id));
  }, [dispatch, user?.id]);

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

  const StatBox = ({ label, value, icon, color }: any) => (
    <Card variant="elevated" padding="md" style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <LinearGradient
        colors={isOnline ? gradients.brand : [colors.primary700, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>DRIVER CONSOLE</Text>
            <Text style={styles.name}>{user?.name?.split(' ')[0] || 'Driver'}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <LinearGradient colors={['#fff', '#f0f0f0']} style={styles.avatarGradient}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'D'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Card variant="elevated" padding="md" style={styles.statusCard}>
          <View style={styles.statusInfo}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.textMuted }]} />
            <View>
              <Text style={styles.statusTitle}>{isOnline ? 'Online & Ready' : 'Currently Offline'}</Text>
              <Text style={styles.statusSub}>{isOnline ? 'Waiting for passengers...' : 'Go online to start earning'}</Text>
            </View>
          </View>
          <Switch value={isOnline} onValueChange={toggleStatus} color={colors.success} />
        </Card>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.statsRow}>
          <StatBox label="Today's Pay" value={`₱${dailyEarnings.toFixed(0)}`} icon="cash" color={colors.success} />
          <StatBox label="Rating" value="4.8" icon="star" color={colors.warning} />
        </View>

        <Card variant="elevated" padding="lg" style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalTitle}>Daily Goal</Text>
            <Text style={styles.goalValue}>₱{dailyEarnings.toFixed(0)} / ₱800</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(100, (dailyEarnings / 800) * 100)}%` }]} />
          </View>
          <Text style={styles.goalSubtitle}>You're almost there! Just a few more rides.</Text>
        </Card>

        {incomingRequests.length > 0 && (
          <TouchableOpacity onPress={() => navigation.navigate('BookingRequests')} activeOpacity={0.9}>
            <LinearGradient colors={gradients.accent} style={styles.requestAlert} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <MaterialCommunityIcons name="bell-ring" size={24} color="#fff" />
              <View style={styles.requestAlertText}>
                <Text style={styles.alertTitle}>New Booking Requests!</Text>
                <Text style={styles.alertSub}>{incomingRequests.length} passengers are waiting nearby.</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>DEMAND HEATMAP</Text>
        {DEMAND_ZONES.map((zone) => (
          <Card key={zone.area} variant="outlined" padding="md" style={styles.zoneCard}>
            <View style={[styles.zoneIcon, { backgroundColor: zone.color + '15' }]}>
              <MaterialCommunityIcons name="map-marker-radius" size={24} color={zone.color} />
            </View>
            <View style={styles.zoneInfo}>
              <Text style={styles.zoneArea}>{zone.area}</Text>
              <Text style={styles.zoneMeta}>{zone.demand} Demand • {zone.eta} Away</Text>
            </View>
            <TouchableOpacity style={styles.goBtn}>
              <Text style={styles.goText}>GO</Text>
            </TouchableOpacity>
          </Card>
        ))}

        <Text style={styles.sectionLabel}>RECENT EARNINGS</Text>
        <Card variant="elevated" padding="none" style={styles.activityCard}>
          {[1, 2, 3].map((i, idx) => (
            <View key={i} style={[styles.activityItem, idx === 2 && { borderBottomWidth: 0 }]}>
              <View style={styles.activityIconBox}>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
              </View>
              <View style={styles.activityText}>
                <Text style={styles.activityTitle}>Trip Completed</Text>
                <Text style={styles.activityTime}>10:30 AM • Market to Plaza</Text>
              </View>
              <Text style={styles.activityAmt}>+₱45.00</Text>
            </View>
          ))}
        </Card>
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
    height: 300,
    paddingTop: 60,
    paddingHorizontal: spacing.screen,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusTitle: {
    ...typography.h3,
    color: colors.text,
    fontSize: 16,
  },
  statusSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  body: {
    marginTop: -40,
    paddingHorizontal: spacing.screen,
    paddingBottom: 130,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.text,
  },
  statLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  goalCard: {
    marginBottom: 24,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  goalValue: {
    ...typography.label,
    color: colors.primary,
  },
  progressBar: {
    height: 10,
    backgroundColor: colors.borderLight,
    borderRadius: 5,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 5,
  },
  goalSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  requestAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    marginBottom: 32,
    ...shadows.md,
  },
  requestAlertText: {
    flex: 1,
    marginLeft: 16,
  },
  alertTitle: {
    ...typography.h3,
    color: '#fff',
    fontSize: 16,
  },
  alertSub: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 4,
  },
  zoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  zoneIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneArea: {
    ...typography.subtitle,
    color: colors.text,
  },
  zoneMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  goBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  goText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 12,
  },
  activityCard: {
    marginBottom: 20,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 14,
  },
  activityTime: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  activityAmt: {
    ...typography.label,
    color: colors.success,
  }
});


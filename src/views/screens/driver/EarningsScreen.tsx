import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Booking } from '@/models/types';
import { Card } from '@/views/components/common/Card';
import { Loading } from '@/views/components/common/Loading';
import { colors, gradients, radius, shadows, spacing, typography } from '@/views/styles/theme';
import { formatDate, formatTime, getWeekRange, getMonthRange, isToday } from '@/utils/dateUtils';
import { DRIVER_GOAL_DAILY } from '@/config/constants';

type Period = 'today' | 'week' | 'month' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

export const EarningsScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAppSelector(state => state.auth);

  const [loading, setLoading] = useState(true);
  const [allTrips, setAllTrips] = useState<Booking[]>([]);
  const [period, setPeriod] = useState<Period>('today');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 30, friction: 8, useNativeDriver: true }),
    ]).start();

    if (user?.id) loadTrips();
  }, [user?.id]);

  const loadTrips = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const repo = new BookingRepository();
      const data = await repo.findByDriver(user.id, 200);
      setAllTrips(data.filter(b => b.status === 'completed'));
    } catch {
      setAllTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const filterTrips = (trips: Booking[], p: Period): Booking[] => {
    const now = new Date();
    switch (p) {
      case 'today':
        return trips.filter(t => t.completed_at && isToday(t.completed_at));
      case 'week': {
        const { start } = getWeekRange();
        return trips.filter(t => t.completed_at && new Date(t.completed_at) >= start);
      }
      case 'month': {
        const { start } = getMonthRange();
        return trips.filter(t => t.completed_at && new Date(t.completed_at) >= start);
      }
      default:
        return trips;
    }
  };

  const filtered = filterTrips(allTrips, period);
  const totalEarnings = filtered.reduce((sum, t) => sum + (t.total_fare ?? 0), 0);
  const todayEarnings = filterTrips(allTrips, 'today').reduce((s, t) => s + (t.total_fare ?? 0), 0);
  const goalProgress = Math.min(100, (todayEarnings / DRIVER_GOAL_DAILY) * 100);

  if (loading) return <Loading message="Loading earnings..." />;

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* Header */}
        <LinearGradient colors={gradients.brand} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Earnings</Text>

          <Card variant="elevated" padding="lg" style={styles.earningsSummary}>
            <Text style={styles.earningsLabel}>
              {PERIODS.find(p => p.key === period)?.label} Earnings
            </Text>
            <Text style={[styles.earningsValue, typography.currency]}>
              ₱{totalEarnings.toFixed(2)}
            </Text>
            <Text style={styles.tripsCount}>{filtered.length} trip{filtered.length !== 1 ? 's' : ''} completed</Text>
          </Card>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Daily goal */}
          <Card variant="elevated" padding="lg" style={styles.goalCard}>
            <View style={styles.goalRow}>
              <Text style={styles.goalTitle}>Daily Goal</Text>
              <Text style={[styles.goalValue, typography.currency]}>
                ₱{todayEarnings.toFixed(2)} / ₱{DRIVER_GOAL_DAILY.toFixed(2)}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${goalProgress}%` }]} />
            </View>
            <Text style={styles.goalNote}>
              {goalProgress >= 100
                ? 'Goal achieved! Great work today.'
                : `₱${(DRIVER_GOAL_DAILY - todayEarnings).toFixed(2)} more to reach your daily goal.`}
            </Text>
          </Card>

          {/* Period filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.filterChip, period === p.key && styles.filterChipActive]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.filterLabel, period === p.key && styles.filterLabelActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Trip list */}
          <Text style={styles.sectionLabel}>TRIP BREAKDOWN</Text>

          {filtered.length === 0 ? (
            <Card variant="elevated" padding="xl" style={styles.emptyCard}>
              <MaterialCommunityIcons name="cash-remove" size={48} color={colors.textLight} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No trips for this period</Text>
            </Card>
          ) : (
            filtered.map((trip, idx) => (
              <Card key={trip.id ?? idx} variant="elevated" padding="none" style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <View style={styles.tripIconBox}>
                    <MaterialCommunityIcons name="check-circle" size={20} color={colors.secondary} />
                  </View>
                  <View style={styles.tripInfo}>
                    <Text style={styles.tripDest} numberOfLines={1}>
                      {trip.dropoff_location?.address ?? 'Destination'}
                    </Text>
                    <Text style={styles.tripMeta}>
                      {trip.completed_at ? `${formatDate(trip.completed_at)} · ${formatTime(trip.completed_at)}` : 'N/A'}
                    </Text>
                  </View>
                  <Text style={[styles.tripFare, typography.currency]}>
                    +₱{(trip.total_fare ?? 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.tripDetails}>
                  <View style={styles.tripDetailItem}>
                    <MaterialCommunityIcons name="map-marker-distance" size={14} color={colors.textMuted} />
                    <Text style={styles.tripDetailText}>{(trip.distance ?? 0).toFixed(1)} km</Text>
                  </View>
                  <View style={styles.tripDetailItem}>
                    <MaterialCommunityIcons name="timer-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.tripDetailText}>
                      {trip.actual_duration ? `${Math.ceil(trip.actual_duration / 60)} min` : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.tripDetailItem}>
                    <MaterialCommunityIcons name="cash" size={14} color={colors.textMuted} />
                    <Text style={styles.tripDetailText}>{trip.payment_method ?? 'Cash'}</Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 52,
    paddingHorizontal: spacing.screen,
    paddingBottom: 80,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    ...typography.h1,
    color: '#fff',
    fontSize: 28,
    marginBottom: 24,
  },
  earningsSummary: {
    ...shadows.xl,
    marginBottom: -48,
  },
  earningsLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 4,
  },
  earningsValue: {
    ...typography.h1,
    color: colors.text,
    fontSize: 36,
    marginBottom: 4,
  },
  tripsCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: 64,
    paddingBottom: 40,
  },
  goalCard: { marginBottom: 24 },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalTitle: { ...typography.h3, color: colors.text },
  goalValue: { ...typography.label, color: colors.primary, fontSize: 14 },
  progressTrack: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 4,
  },
  goalNote: { ...typography.bodySmall, color: colors.textSecondary },
  filterRow: { marginBottom: 24 },
  filterContent: { paddingRight: 8, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabel: { ...typography.label, color: colors.textSecondary, fontSize: 13 },
  filterLabelActive: { color: '#fff' },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  emptyCard: { alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },
  tripCard: { marginBottom: 12, overflow: 'hidden' },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tripIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripInfo: { flex: 1 },
  tripDest: { ...typography.subtitle, color: colors.text, fontSize: 14 },
  tripMeta: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  tripFare: { ...typography.label, color: colors.secondary, fontSize: 16 },
  tripDetails: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: 20,
  },
  tripDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tripDetailText: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 12 },
});

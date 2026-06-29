import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/config/supabase';
import { Driver } from '@/models/entities/User';
import { Rating } from '@/models/entities/Booking';
import { Button } from '@/views/components/common/Button';
import { colors, radius, shadows, spacing, typography, layout } from '@/views/styles/theme';
import { formatDate } from '@/utils/dateUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewItem {
  id: string;
  stars: number;
  comment: string;
  created_at: string;
  /** Masked passenger name derived from booking */
  passengerName?: string;
}

interface DriverProfileRouteParams {
  driverId: string;
  /** Pre-fetched snapshot passed from ActiveTripScreen / BookRideScreen */
  driverSnapshot?: Partial<Driver>;
}

// ─── Star display helper ───────────────────────────────────────────────────────

const StarRow = ({ stars, size = 16 }: { stars: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <MaterialCommunityIcons
        key={n}
        name={n <= Math.round(stars) ? 'star' : 'star-outline'}
        size={size}
        color={n <= Math.round(stars) ? '#FBBF24' : colors.border}
      />
    ))}
  </View>
);

// ─── Rating breakdown bar ─────────────────────────────────────────────────────

const RatingBar = ({ label, value, total }: { label: string; value: number; total: number }) => {
  const pct = total > 0 ? value / total : 0;
  return (
    <View style={styles.ratingBarRow}>
      <Text style={styles.ratingBarLabel}>{label}</Text>
      <View style={styles.ratingBarTrack}>
        <View style={[styles.ratingBarFill, { flex: pct }]} />
        <View style={{ flex: 1 - pct }} />
      </View>
      <Text style={styles.ratingBarCount}>{value}</Text>
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export const DriverProfileScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { driverId, driverSnapshot } = (route.params ?? {}) as DriverProfileRouteParams;

  const [driver, setDriver] = useState<Partial<Driver> | null>(driverSnapshot ?? null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(!driverSnapshot);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Header parallax
  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_MAX = 240;
  const HEADER_MIN = 80;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_MAX - HEADER_MIN],
    outputRange: [HEADER_MAX, HEADER_MIN],
    extrapolate: 'clamp',
  });
  const avatarScale = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0.6],
    extrapolate: 'clamp',
  });

  // ── Load driver profile ────────────────────────────────────────────────────
  useEffect(() => {
    if (!driverId) return;
    if (!driverSnapshot) fetchDriver();
    fetchReviews();
  }, [driverId]);

  const fetchDriver = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', driverId)
        .single();
      if (!error && data) setDriver(data as Driver);
    } catch {
      /* ignore – show snapshot or placeholder */
    } finally {
      setLoading(false);
    }
  };

  /** Pull completed bookings for this driver that have a passenger_rating. */
  const fetchReviews = async () => {
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, passenger_rating, passenger_id, created_at')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .not('passenger_rating', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        const mapped: ReviewItem[] = data.map((b: any) => ({
          id: b.id,
          stars: b.passenger_rating?.stars ?? 5,
          comment: b.passenger_rating?.comment ?? '',
          created_at: b.passenger_rating?.created_at ?? b.created_at,
          passengerName: 'Passenger',
        }));
        setReviews(mapped);
      }
    } catch {
      /* silent */
    } finally {
      setReviewsLoading(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length
      : (driver?.rating ?? 5.0);

  const starBuckets = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => Math.round(r.stars) === n).length,
  }));

  const displayedReviews = showAll ? reviews : reviews.slice(0, 3);

  // ── Vehicle badge helpers ──────────────────────────────────────────────────
  const vehicle = (driver as Driver)?.vehicle_details;
  const vehicleLabel = vehicle
    ? `${vehicle.color} ${vehicle.make} ${vehicle.model} (${vehicle.year})`
    : 'Tricycle';
  const plateLabel = vehicle?.plate_number ?? '—';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Animated header ── */}
      <Animated.View style={[styles.headerWrap, { height: headerHeight }]}>
        <LinearGradient
          colors={['#1F1F1F', '#000000']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
        </TouchableOpacity>

        <Animated.View style={[styles.avatarWrap, { transform: [{ scale: avatarScale }] }]}>
          <View style={styles.avatarCircle}>
            <MaterialCommunityIcons name="account-tie" size={48} color={colors.primary} />
          </View>
          {/* Online dot */}
          {(driver as Driver)?.current_status === 'online' && (
            <View style={styles.onlineDot} />
          )}
        </Animated.View>

        <Text style={styles.driverName} numberOfLines={1}>
          {loading ? 'Loading…' : driver?.name ?? 'Driver'}
        </Text>

        <View style={styles.headerMeta}>
          <MaterialCommunityIcons name="star" size={14} color="#FBBF24" />
          <Text style={styles.headerRating}>{avgRating.toFixed(1)}</Text>
          <Text style={styles.headerDot}>·</Text>
          <Text style={styles.headerTrips}>{driver?.total_trips ?? 0} trips</Text>
          {(driver as Driver)?.verification_status === 'verified' && (
            <>
              <Text style={styles.headerDot}>·</Text>
              <MaterialCommunityIcons name="shield-check" size={14} color={colors.secondary} />
              <Text style={[styles.headerTrips, { color: colors.secondary, marginLeft: 2 }]}>Verified</Text>
            </>
          )}
        </View>
      </Animated.View>

      {/* ── Scrollable content ── */}
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Spacer to account for header */}
        <View style={{ height: HEADER_MAX + 12 }} />

        {/* ── Vehicle card ── */}
        <Surface style={styles.card} elevation={1}>
          <Text style={styles.cardTitle}>Vehicle</Text>
          <View style={styles.vehicleRow}>
            <View style={styles.vehicleIconWrap}>
              <MaterialCommunityIcons name="rickshaw" size={32} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleLabel}>{vehicleLabel}</Text>
              <View style={styles.plateChip}>
                <MaterialCommunityIcons name="card-text-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.plateText}>{plateLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{driver?.total_trips ?? 0}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{avgRating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Avg Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{reviews.length}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
          </View>
        </Surface>

        {/* ── TODA membership ── */}
        {(driver as Driver)?.toda_membership && (
          <Surface style={styles.card} elevation={1}>
            <Text style={styles.cardTitle}>TODA Membership</Text>
            <View style={styles.todaRow}>
              <MaterialCommunityIcons name="badge-account-horizontal-outline" size={20} color={colors.accent} />
              <Text style={styles.todaText}>{(driver as Driver).toda_membership}</Text>
            </View>
          </Surface>
        )}

        {/* ── Ratings breakdown ── */}
        <Surface style={styles.card} elevation={1}>
          <Text style={styles.cardTitle}>Ratings & Reviews</Text>

          <View style={styles.ratingOverview}>
            <View style={styles.ratingBig}>
              <Text style={styles.ratingBigNum}>{avgRating.toFixed(1)}</Text>
              <StarRow stars={avgRating} size={20} />
              <Text style={styles.ratingCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
            </View>

            <View style={styles.ratingBreakdown}>
              {starBuckets.map(({ n, count }) => (
                <RatingBar
                  key={n}
                  label={`${n}`}
                  value={count}
                  total={reviews.length}
                />
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* ── Review list ── */}
          {reviewsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : reviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <MaterialCommunityIcons name="comment-outline" size={36} color={colors.textLight} />
              <Text style={styles.emptyReviewsText}>No reviews yet</Text>
            </View>
          ) : (
            <>
              {displayedReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}

              {reviews.length > 3 && (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  onPress={() => setShowAll((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.showMoreText}>
                    {showAll ? 'Show less' : `Show all ${reviews.length} reviews`}
                  </Text>
                  <MaterialCommunityIcons
                    name={showAll ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </Surface>

        {/* ── Safety badges ── */}
        <Surface style={styles.card} elevation={1}>
          <Text style={styles.cardTitle}>Safety & Verification</Text>
          <View style={styles.badgeGrid}>
            {[
              { icon: 'shield-account', label: 'TODA Verified', color: colors.secondary },
              { icon: 'card-account-details-outline', label: "Driver's License", color: colors.accent },
              { icon: 'car-info', label: 'Vehicle Inspected', color: colors.warning },
              { icon: 'cellphone-check', label: 'Phone Verified', color: colors.primary },
            ].map((b) => (
              <View key={b.label} style={styles.badge}>
                <View style={[styles.badgeIcon, { backgroundColor: b.color + '18' }]}>
                  <MaterialCommunityIcons name={b.icon as any} size={22} color={b.color} />
                </View>
                <Text style={styles.badgeLabel}>{b.label}</Text>
              </View>
            ))}
          </View>
        </Surface>

        <View style={{ height: spacing.xxl }} />
      </Animated.ScrollView>
    </View>
  );
};

// ─── Review card sub-component ────────────────────────────────────────────────

const ReviewCard = ({ review }: { review: ReviewItem }) => (
  <View style={styles.reviewCard}>
    <View style={styles.reviewHeader}>
      <View style={styles.reviewAvatar}>
        <MaterialCommunityIcons name="account-circle" size={30} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.reviewName}>{review.passengerName ?? 'Passenger'}</Text>
        <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
      </View>
      <StarRow stars={review.stars} size={14} />
    </View>
    {review.comment ? (
      <Text style={styles.reviewComment}>"{review.comment}"</Text>
    ) : null}
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.lg,
  },
  backBtn: {
    position: 'absolute',
    top: layout.headerTop - 12,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrap: { position: 'relative', marginBottom: spacing.sm },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F2F2F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: '#000',
  },
  driverName: { ...typography.title, color: '#fff', fontSize: 20, letterSpacing: -0.3 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  headerRating: { ...typography.label, color: '#fff', fontSize: 13 },
  headerDot: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  headerTrips: { ...typography.body, color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  // Scroll
  scrollContent: { paddingHorizontal: spacing.screen },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardTitle: { ...typography.label, fontSize: 11, color: colors.textMuted, letterSpacing: 1.2, marginBottom: spacing.md, textTransform: 'uppercase' },

  // Vehicle
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vehicleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleLabel: { ...typography.subtitle, color: colors.text, fontSize: 15 },
  plateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  plateText: { ...typography.label, color: colors.textSecondary, fontSize: 12 },

  // Divider
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md },

  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.number, fontSize: 22, color: colors.text },
  statLabel: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: colors.borderLight },

  // TODA
  todaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  todaText: { ...typography.subtitle, color: colors.text, fontSize: 14 },

  // Ratings overview
  ratingOverview: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  ratingBig: { alignItems: 'center', minWidth: 80 },
  ratingBigNum: { ...typography.number, fontSize: 40, color: colors.text, lineHeight: 48 },
  ratingCount: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  ratingBreakdown: { flex: 1, gap: 4 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingBarLabel: { ...typography.label, fontSize: 11, color: colors.textSecondary, width: 12, textAlign: 'right' },
  ratingBarTrack: { flex: 1, height: 6, borderRadius: 3, flexDirection: 'row', backgroundColor: colors.borderLight, overflow: 'hidden' },
  ratingBarFill: { backgroundColor: '#FBBF24', borderRadius: 3 },
  ratingBarCount: { ...typography.label, fontSize: 11, color: colors.textSecondary, width: 22, textAlign: 'right' },

  // Reviews
  reviewCard: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  reviewName: { ...typography.label, color: colors.text, fontSize: 13 },
  reviewDate: { ...typography.bodySmall, color: colors.textMuted, fontSize: 11 },
  reviewComment: { ...typography.body, color: colors.textSecondary, fontSize: 13, fontStyle: 'italic', paddingLeft: 40 },

  emptyReviews: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyReviewsText: { ...typography.body, color: colors.textSecondary },

  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  showMoreText: { ...typography.label, color: colors.primary, fontSize: 14 },

  // Safety badges
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeIcon: { width: 40, height: 40, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  badgeLabel: { ...typography.label, fontSize: 12, color: colors.text, flex: 1 },
});

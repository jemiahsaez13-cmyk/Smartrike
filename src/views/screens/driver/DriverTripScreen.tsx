import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { startTrip, completeTrip, submitDriverRating } from '@/controllers/slices/bookingSlice';
import { clearCurrentTrip } from '@/controllers/slices/driverSlice';
import { Button } from '@/views/components/common/Button';
import { Card } from '@/views/components/common/Card';
import { UserRepository } from '@/models/repositories/UserRepository';
import { ReportService, DRIVER_REPORT_REASONS } from '@/models/services/ReportService';
import { User } from '@/models/types';
import { colors, gradients, radius, shadows, spacing, typography } from '@/views/styles/theme';
import { formatETA, formatDistance } from '@/utils/locationUtils';
import { confirm, notify } from '@/utils/confirm';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/config/maps';

const { height } = Dimensions.get('window');
const userRepo = new UserRepository();
const reportService = new ReportService();

const UBER_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
];

type TripPhase = 'to_pickup' | 'in_trip';

export const DriverTripScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { user } = useAppSelector(state => state.auth);
  const { currentTrip } = useAppSelector(state => state.driver);
  const currentBooking = currentTrip;

  const [phase, setPhase] = useState<TripPhase>(
    currentBooking?.status === 'in-transit' ? 'in_trip' : 'to_pickup'
  );
  const [completing, setCompleting] = useState(false);
  const [passenger, setPassenger] = useState<User | null>(null);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [completedFare, setCompletedFare] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  // True when the report was opened from the post-trip rating sheet (so we know
  // to wrap the trip up afterwards instead of returning to the live trip).
  const [reportFromRating, setReportFromRating] = useState(false);

  // Open the report sheet without ever stacking it on top of the rating sheet.
  const openReport = (fromRating: boolean) => {
    setReportFromRating(fromRating);
    if (fromRating) setRatingVisible(false);
    setReportVisible(true);
  };

  const closeReport = () => {
    setReportVisible(false);
    setReportReason('');
    setReportDetails('');
    // Cancelled from the post-trip flow → bring the rating sheet back so the
    // driver can still rate or skip to finish the trip.
    if (reportFromRating) {
      setReportFromRating(false);
      setRatingVisible(true);
    }
  };

  const passengerId = currentBooking?.passenger_id || null;
  const passengerName = passenger?.name || 'Passenger';

  useEffect(() => {
    let active = true;
    if (!passengerId) return;
    userRepo
      .findById(passengerId)
      .then((p) => {
        if (active) setPassenger(p);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [passengerId]);

  const handleCallPassenger = () => {
    const phone = passenger?.phone;
    if (!phone) {
      void notify('Call Passenger', 'No contact number is on file for this passenger.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => notify('Call Passenger', `Passenger: ${phone}`));
  };

  const handleMessagePassenger = () => {
    if (!currentBooking?.id) return;
    navigation.navigate('Chat', { bookingId: currentBooking.id, otherName: passengerName });
  };

  const slideAnim = useRef(new Animated.Value(height * 0.4)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, []);

  if (!currentBooking) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="map-marker-off-outline" size={72} color={colors.textLight} />
        <Text style={styles.emptyTitle}>No active trip</Text>
        <Button variant="outline" onPress={() => navigation.goBack()}>
          Back to Dashboard
        </Button>
      </View>
    );
  }

  const pickup = currentBooking.pickup_location;
  const dropoff = currentBooking.dropoff_location;

  const mapCenter = phase === 'to_pickup'
    ? { latitude: pickup?.latitude ?? 13.4452, longitude: pickup?.longitude ?? 121.8401 }
    : { latitude: dropoff?.latitude ?? 13.4452, longitude: dropoff?.longitude ?? 121.8401 };

  const handlePickedUp = async () => {
    try {
      await dispatch(startTrip(currentBooking.id)).unwrap();
      setPhase('in_trip');
    } catch {
      await notify('Error', 'Could not update trip status. Try again.');
    }
  };

  const handleDropOff = async () => {
    // Web-safe confirm (Alert.alert is a no-op on react-native-web, so the old
    // popup never appeared and the trip never completed).
    const proceed = await confirm('Complete Trip', 'Confirm passenger drop-off at destination?', {
      confirmText: 'Complete Trip',
      cancelText: 'Not yet',
    });
    if (!proceed) return;

    setCompleting(true);
    try {
      await dispatch(completeTrip(currentBooking.id)).unwrap();
      // Keep `currentTrip` set so this screen stays mounted and shows the
      // completion sheet. (The trip-complete service + DB trigger already put
      // the driver back online server-side; clearCurrentTrip — fired when the
      // driver finishes rating/skipping — flips Redux to online at that point.)
      setCompletedFare(currentBooking.total_fare ?? 0);
      setRatingVisible(true);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Please try again.';
      await notify('Could not complete trip', msg);
    } finally {
      setCompleting(false);
    }
  };

  const handleSubmitPassengerRating = async () => {
    setSubmittingRating(true);
    try {
      if (currentBooking?.id) {
        await dispatch(
          submitDriverRating({
            bookingId: currentBooking.id,
            rating: { stars: ratingStars, comment: ratingComment, created_at: new Date().toISOString() } as any,
          })
        ).unwrap();
      }
    } catch {
      // best-effort; proceed regardless
    } finally {
      setSubmittingRating(false);
      setRatingVisible(false);
      dispatch(clearCurrentTrip());
      navigation.navigate('DriverDashboard');
    }
  };

  const handleSkipRating = () => {
    setRatingVisible(false);
    dispatch(clearCurrentTrip());
    navigation.navigate('DriverDashboard');
  };

  const handleSubmitReport = async () => {
    if (!reportReason) {
      void notify('Choose a reason', 'Please select what happened so we can review it.');
      return;
    }
    if (!user?.id || !passengerId) return;
    setSubmittingReport(true);
    try {
      await reportService.fileReport({
        bookingId: currentBooking?.id,
        reporterId: user.id,
        reportedId: passengerId,
        reporterRole: 'driver',
        reason: reportReason,
        details: reportDetails,
      });
      setReportVisible(false);
      setReportReason('');
      setReportDetails('');
      const wrapUp = reportFromRating;
      setReportFromRating(false);
      await notify('Report submitted', 'Thanks — our team will review this passenger. Safe trips!');
      if (wrapUp) {
        // Reported from the post-trip sheet → the trip is done, return home.
        dispatch(clearCurrentTrip());
        navigation.navigate('DriverDashboard');
      }
    } catch (e: any) {
      await notify('Could not submit report', e?.message || 'Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSOS = () => {
    void notify('Emergency SOS', 'Contact the TODA dispatch desk immediately for urgent help during this trip.');
  };

  const isToPickup = phase === 'to_pickup';
  const phaseLabel = isToPickup ? 'HEAD TO PICKUP' : 'IN PROGRESS';
  const phaseColor = isToPickup ? colors.accent : colors.secondary;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={UBER_MAP_STYLE}
        region={{ ...mapCenter, latitudeDelta: 0.025, longitudeDelta: 0.025 }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {pickup && (
          <Marker
            coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }}
            title="Pickup"
          >
            <View style={[styles.markerPin, { backgroundColor: colors.secondary }]}>
              <MaterialCommunityIcons name="account" size={16} color="#fff" />
            </View>
          </Marker>
        )}
        {dropoff && (
          <Marker
            coordinate={{ latitude: dropoff.latitude, longitude: dropoff.longitude }}
            title="Dropoff"
          >
            <View style={[styles.markerPin, { backgroundColor: colors.accent }]}>
              <MaterialCommunityIcons name="map-marker" size={16} color="#fff" />
            </View>
          </Marker>
        )}
        {pickup && dropoff && (
          <Polyline
            coordinates={[
              { latitude: pickup.latitude, longitude: pickup.longitude },
              { latitude: dropoff.latitude, longitude: dropoff.longitude },
            ]}
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.phasePill, { backgroundColor: phaseColor + '18', borderColor: phaseColor }]}>
          <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
          <Text style={[styles.phaseLabel, { color: phaseColor }]}>{phaseLabel}</Text>
        </View>
        <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
          <MaterialCommunityIcons name="alarm-light" size={22} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Bottom panel */}
      <Animated.View style={[styles.panel, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        {/* Passenger info */}
        <View style={styles.passengerRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{passengerName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>{passengerName}</Text>
            <View style={styles.ratingRow}>
              <MaterialCommunityIcons name="map-marker-distance" size={14} color={colors.textSecondary} />
              <Text style={styles.ratingText}>{formatDistance(currentBooking.distance ?? 0)} trip</Text>
            </View>
          </View>
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactBtn} onPress={handleCallPassenger} activeOpacity={0.8}>
              <MaterialCommunityIcons name="phone" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactBtn} onPress={handleMessagePassenger} activeOpacity={0.8}>
              <MaterialCommunityIcons name="message-text" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, styles.reportBtn]}
              onPress={() => openReport(false)}
              activeOpacity={0.8}
              accessibilityLabel="Report passenger"
            >
              <MaterialCommunityIcons name="flag-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Fare & route */}
        <Card variant="elevated" padding="md" style={styles.fareCard}>
          <View style={styles.fareRow}>
            <View style={styles.fareItem}>
              <Text style={styles.fareValue}>₱{(currentBooking.total_fare ?? 0).toFixed(2)}</Text>
              <Text style={styles.fareLabel}>FARE</Text>
            </View>
            <View style={styles.fareDivider} />
            <View style={styles.fareItem}>
              <Text style={styles.fareValue}>{formatDistance(currentBooking.distance ?? 0)}</Text>
              <Text style={styles.fareLabel}>DISTANCE</Text>
            </View>
            <View style={styles.fareDivider} />
            <View style={styles.fareItem}>
              <Text style={styles.fareValue}>{formatETA(currentBooking.estimated_duration ?? 0)}</Text>
              <Text style={styles.fareLabel}>ETA</Text>
            </View>
          </View>
        </Card>

        {/* Location display */}
        <View style={styles.locationBlock}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.secondary }]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {pickup?.address ?? 'Pickup location'}
            </Text>
          </View>
          <View style={styles.locationConnector} />
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.accent }]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {dropoff?.address ?? 'Dropoff location'}
            </Text>
          </View>
        </View>

        {/* CTA */}
        {isToPickup ? (
          <Button variant="primary" onPress={handlePickedUp} style={styles.ctaBtn}>
            Passenger Picked Up
          </Button>
        ) : (
          <Button
            variant="primary"
            onPress={handleDropOff}
            loading={completing}
            disabled={completing}
            style={styles.ctaBtn}
          >
            Complete Trip
          </Button>
        )}
      </Animated.View>

      {/* ── Rate Passenger Modal ────────────────────────────────── */}
      <Modal
        visible={ratingVisible}
        transparent
        animationType="fade"
        onRequestClose={handleSkipRating}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingCard}>
            {/* Completion celebration */}
            <View style={styles.celebrateWrap}>
              <MaterialCommunityIcons name="check-decagram" size={48} color={colors.success} />
            </View>
            <Text style={styles.ratingTitle}>Trip Completed! 🎉</Text>
            <Text style={styles.celebrateFare}>You earned ₱{completedFare.toFixed(2)}</Text>
            <Text style={styles.ratingSubtitle}>Now rate your trip with {passengerName}</Text>

            {/* Stars */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setRatingStars(n)}
                  activeOpacity={0.7}
                  accessibilityLabel={`${n} star`}
                >
                  <MaterialCommunityIcons
                    name={n <= ratingStars ? 'star' : 'star-outline'}
                    size={42}
                    color={n <= ratingStars ? '#FBBF24' : colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Star label */}
            <Text style={styles.starLabel}>
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][ratingStars]}
            </Text>

            {/* Comment */}
            <TextInput
              placeholder="Any comments about this passenger? (optional)"
              value={ratingComment}
              onChangeText={setRatingComment}
              style={styles.commentInput}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={200}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, submittingRating && { opacity: 0.6 }]}
              onPress={handleSubmitPassengerRating}
              disabled={submittingRating}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#000000', '#1F1F1F']}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.submitText}>
                  {submittingRating ? 'Submitting…' : 'Submit & Go Online'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Skip + Report */}
            <View style={styles.ratingActionsRow}>
              <TouchableOpacity onPress={handleSkipRating} style={styles.skipBtn} activeOpacity={0.7}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openReport(true)}
                style={styles.reportLink}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="flag-outline" size={15} color={colors.error} />
                <Text style={styles.reportLinkText}>Report passenger</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Report Passenger Modal ──────────────────────────────── */}
      <Modal visible={reportVisible} transparent animationType="fade" onRequestClose={closeReport}>
        <View style={styles.modalOverlay}>
          <View style={styles.ratingCard}>
            <View style={[styles.ratingAvatarWrap, { backgroundColor: colors.errorLight }]}>
              <MaterialCommunityIcons name="flag" size={40} color={colors.error} />
            </View>
            <Text style={styles.ratingTitle}>Report {passengerName}</Text>
            <Text style={styles.ratingSubtitle}>Tell us what happened. This goes to the TODA admin for review.</Text>

            <View style={styles.reasonWrap}>
              {DRIVER_REPORT_REASONS.map((r) => {
                const active = reportReason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setReportReason(r)}
                    activeOpacity={0.8}
                    style={[styles.reasonChip, active && styles.reasonChipActive]}
                  >
                    <Text style={[styles.reasonChipText, active && styles.reasonChipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              placeholder="Add details (optional)"
              value={reportDetails}
              onChangeText={setReportDetails}
              style={styles.commentInput}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={300}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submittingReport && { opacity: 0.6 }]}
              onPress={handleSubmitReport}
              disabled={submittingReport}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[colors.error, '#B91C1C']} style={styles.submitGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.submitText}>{submittingReport ? 'Submitting…' : 'Submit Report'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeReport} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={styles.skipText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    padding: 40,
    backgroundColor: colors.background,
  },
  emptyTitle: { ...typography.h2, color: colors.textSecondary },
  topBar: {
    position: 'absolute',
    top: 52,
    left: spacing.screen,
    right: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    backgroundColor: '#fff',
    ...shadows.sm,
  },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseLabel: { ...typography.label, fontSize: 11, letterSpacing: 1 },
  sosBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.screen,
    paddingBottom: 36,
    paddingTop: 16,
    ...shadows.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginBottom: 20,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { ...typography.h3, color: colors.primary },
  passengerInfo: { flex: 1, marginLeft: 14 },
  passengerName: { ...typography.subtitle, color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { ...typography.bodySmall, color: colors.textSecondary },
  contactRow: { flexDirection: 'row', gap: 12 },
  reportBtn: { backgroundColor: colors.errorLight },
  contactBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fareCard: { marginBottom: 20 },
  fareRow: { flexDirection: 'row', alignItems: 'center' },
  fareItem: { flex: 1, alignItems: 'center' },
  fareValue: { ...typography.h3, color: colors.text, fontSize: 18 },
  fareLabel: { ...typography.label, color: colors.textMuted, fontSize: 10, letterSpacing: 1, marginTop: 2 },
  fareDivider: { width: 1, height: 32, backgroundColor: colors.borderLight },
  locationBlock: { marginBottom: 24 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 40 },
  locationDot: { width: 12, height: 12, borderRadius: 6 },
  locationConnector: {
    width: 2,
    height: 16,
    backgroundColor: colors.borderLight,
    marginLeft: 5,
  },
  locationText: { ...typography.body, color: colors.text, flex: 1 },
  ctaBtn: { marginTop: 4 },
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  // ── Rating Modal ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13,27,42,0.65)',
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
  },
  ratingCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.xl,
  },
  ratingAvatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ratingTitle: { ...typography.title, fontSize: 22, color: colors.text, marginBottom: 4 },
  ratingSubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  starLabel: {
    ...typography.label,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    letterSpacing: 0.5,
  },
  commentInput: {
    width: '100%',
    minHeight: 72,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  submitBtn: { width: '100%', height: 52, borderRadius: 14, overflow: 'hidden', marginBottom: spacing.sm },
  submitGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitText: { ...typography.label, color: '#fff', fontSize: 16, letterSpacing: 0 },
  skipBtn: { paddingVertical: spacing.sm },
  skipText: { ...typography.body, fontSize: 14, color: colors.textSecondary },
  celebrateWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  celebrateFare: { ...typography.h2, color: colors.success, fontSize: 24, marginTop: 2, marginBottom: 4 },
  ratingActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.sm },
  reportLinkText: { ...typography.label, fontSize: 13, color: colors.error },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md, justifyContent: 'center' },
  reasonChip: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonChipActive: { backgroundColor: colors.errorLight, borderColor: colors.error },
  reasonChipText: { ...typography.label, fontSize: 12, color: colors.textSecondary },
  reasonChipTextActive: { color: colors.error },
});

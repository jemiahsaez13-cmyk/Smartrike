import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { updateDriverStatus, clearCurrentTrip } from '@/controllers/slices/driverSlice';
import { Button } from '@/views/components/common/Button';
import { Card } from '@/views/components/common/Card';
import { UserRepository } from '@/models/repositories/UserRepository';
import { User } from '@/models/types';
import { colors, gradients, radius, shadows, spacing, typography } from '@/views/styles/theme';
import { formatETA, formatDistance } from '@/utils/locationUtils';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/config/maps';

const { height } = Dimensions.get('window');
const userRepo = new UserRepository();

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
      Alert.alert('Call Passenger', 'No contact number is on file for this passenger.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Call Passenger', `Passenger: ${phone}`));
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
      Alert.alert('Error', 'Could not update trip status. Try again.');
    }
  };

  const handleDropOff = () => {
    Alert.alert('Complete Trip', 'Confirm passenger drop-off at destination?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setCompleting(true);
          try {
            await dispatch(completeTrip(currentBooking.id)).unwrap();
            if (user?.id) {
              await dispatch(updateDriverStatus({ driverId: user.id, status: 'online' }));
            }
            // Show rating modal instead of immediate navigation
            setRatingVisible(true);
          } catch {
            Alert.alert('Error', 'Failed to complete trip. Try again.');
          } finally {
            setCompleting(false);
          }
        },
      },
    ]);
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

  const handleSOS = () => {
    Alert.alert('Emergency SOS', 'Choose an action:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call TODA Dispatch', onPress: () => undefined },
      { text: 'Flag Emergency', style: 'destructive', onPress: () => undefined },
    ]);
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
            {/* Avatar */}
            <View style={styles.ratingAvatarWrap}>
              <MaterialCommunityIcons name="account-circle" size={52} color={colors.primary} />
            </View>

            <Text style={styles.ratingTitle}>Rate your passenger</Text>
            <Text style={styles.ratingSubtitle}>
              How was the ride with this passenger?
            </Text>

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

            {/* Skip */}
            <TouchableOpacity onPress={handleSkipRating} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip</Text>
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
});

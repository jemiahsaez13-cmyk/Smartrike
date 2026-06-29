import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, View, StyleSheet, Animated, Dimensions, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@/controllers/store';
import { submitRating, cancelBooking, updateBookingStatus, clearCurrentBooking } from '@/controllers/slices/bookingSlice';
import { RealtimeService } from '@/models/services/RealtimeService';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { UserRepository } from '@/models/repositories/UserRepository';
import { User } from '@/models/types';
import { Button } from '@/views/components/common/Button';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { colors, layout, radius, spacing, shadows, typography } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { LocationService } from '@/models/services/LocationService';
import { haversineDistance, estimateETA, formatETA } from '@/utils/locationUtils';
import { confirm, notify } from '@/utils/confirm';
import { Location } from '@/models/types';

const { height } = Dimensions.get('window');
const realtimeService = new RealtimeService();
const bookingRepo = new BookingRepository();
const userRepo = new UserRepository();

export const ActiveTripScreen = () => {
  const { currentBooking } = useBooking();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  const [driver, setDriver] = useState<User | null>(null);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [driverCoords, setDriverCoords] = useState<Location | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const status = currentBooking?.status || 'accepted';
  const driverId = currentBooking?.driver_id || null;
  const vehicle = (driver as any)?.vehicle_details || {};
  const driverName = driver?.name || 'Your driver';
  const plate = vehicle.plate_number || vehicle.plate || '—';
  const vehicleDesc = [vehicle.color, vehicle.model].filter(Boolean).join(' ') || 'FEDTODAB Tricycle';

  const paymentMethod = currentBooking?.payment_method || 'cash';
  const isEMoney = paymentMethod !== 'cash';
  const paidViaEMoney = isEMoney && currentBooking?.payment_status === 'completed';
  const providerLabel = paymentMethod === 'paymaya' ? 'Maya' : paymentMethod === 'gcash' ? 'GCash' : 'cash';
  const fareText = `₱${(currentBooking?.total_fare ?? 0).toFixed(2)}`;

  // Animation for the tracking card
  const slideAnim = useRef(new Animated.Value(height * 0.3)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  // Load the real assigned driver's profile.
  useEffect(() => {
    let active = true;
    if (!driverId) {
      setDriver(null);
      return;
    }
    userRepo
      .findById(driverId)
      .then((d) => {
        if (active) setDriver(d);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [driverId]);

  // Subscribe to the assigned driver's live location so we can show a moving
  // position + a live ETA to the pickup point. Falls back silently if the
  // driver isn't streaming yet.
  useEffect(() => {
    if (!driverId) return;
    const realtime = new RealtimeService();
    const locationService = new LocationService();

    locationService.getDriverLocation(driverId).then((loc) => {
      if (loc) setDriverCoords(loc);
    });

    const key = realtime.subscribeToDriverLocation(driverId, (payload) => {
      const row = payload?.new;
      if (row?.latitude != null && row?.longitude != null) {
        setDriverCoords({ latitude: row.latitude, longitude: row.longitude, address: '' });
      }
    });

    return () => realtime.unsubscribe(key);
  }, [driverId]);

  // Live ETA from the driver's current coords to the passenger's pickup point.
  const liveEtaMinutes =
    driverCoords && currentBooking?.pickup_location
      ? estimateETA(haversineDistance(driverCoords, currentBooking.pickup_location))
      : null;

  // Live booking updates (driver starts trip, completes, etc.) via realtime,
  // with a polling fallback for environments where realtime isn't published.
  const refresh = useCallback(async () => {
    if (!currentBooking?.id) return;
    try {
      const fresh = await bookingRepo.findById(currentBooking.id);
      if (fresh) dispatch(updateBookingStatus(fresh));
    } catch {
      /* ignore */
    }
  }, [currentBooking?.id, dispatch]);

  useEffect(() => {
    if (!currentBooking?.id) return;
    const channelKey = realtimeService.subscribeToBooking(currentBooking.id, (payload) => {
      if (payload?.new) dispatch(updateBookingStatus(payload.new));
    });
    const poll = setInterval(refresh, 8000);
    return () => {
      realtimeService.unsubscribe(channelKey);
      clearInterval(poll);
    };
  }, [currentBooking?.id, dispatch, refresh]);

  // When the driver completes the trip, prompt the passenger to rate it.
  useEffect(() => {
    if (status === 'completed') setRatingVisible(true);
  }, [status]);

  const handleCallDriver = () => {
    const phone = driver?.phone;
    if (!phone) {
      void notify('Call Driver', 'No contact number is on file for this driver yet.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => notify('Call Driver', `Driver: ${phone}`));
  };

  const handleMessageDriver = () => {
    if (!currentBooking?.id) return;
    navigation.navigate('Chat', { bookingId: currentBooking.id, otherName: driverName });
  };

  const handleCancel = async () => {
    if (!currentBooking?.id) return;
    const yes = await confirm('Cancel Ride', 'Cancel this booking? Your driver will be notified.', {
      confirmText: 'Cancel Ride',
      cancelText: 'Keep Ride',
      destructive: true,
    });
    if (!yes) return;
    setCancelling(true);
    try {
      await dispatch(cancelBooking(currentBooking.id)).unwrap();
    } catch {
      /* fall through to navigation */
    } finally {
      setCancelling(false);
      navigation.navigate('PassengerDashboard');
    }
  };

  const handleSOS = () => {
    void notify('Emergency SOS', 'For urgent help, contact the TODA dispatch desk right away.');
  };

  const handleSubmitRating = async () => {
    if (!currentBooking) return;
    setSubmitting(true);
    const bookingId = currentBooking.id;
    try {
      await dispatch(
        submitRating({
          bookingId,
          rating: { stars, comment, created_at: new Date().toISOString() } as any,
        })
      ).unwrap();
    } catch {
      // Driver already marked the trip complete; rating is best-effort.
    } finally {
      setSubmitting(false);
      setRatingVisible(false);
      dispatch(clearCurrentBooking());
      navigation.navigate('PassengerDashboard');
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { bg: string; dot: string; fg: string; label: string }> = {
      accepted: { bg: '#DBEAFE', dot: '#2563EB', fg: '#1E40AF', label: 'Driver is arriving' },
      'in-transit': { bg: '#DCFCE7', dot: '#16A34A', fg: '#166534', label: 'On your way' },
      completed: { bg: '#DCFCE7', dot: '#16A34A', fg: '#166534', label: 'Trip completed' },
    };
    const s = map[status] || map.accepted;
    return (
      <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
        <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
        <Text style={[styles.statusText, { color: s.fg }]}>{s.label}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapView}>
        <View style={styles.mapPlaceholder}>
          <MaterialCommunityIcons name="map-outline" size={80} color={colors.textLight} style={{ opacity: 0.5 }} />
        </View>
        
        <IconButton 
          icon="chevron-left" 
          mode="contained"
          containerColor={colors.surface}
          style={styles.backBtn}
          onPress={() => navigation.navigate('PassengerDashboard')}
        />

        <View style={styles.trackingOverlay}>
          <StatusBadge status={currentBooking?.status || 'accepted'} />
          {liveEtaMinutes != null && (
            <View style={styles.liveEtaChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveEtaText}>
                Driver {formatETA(liveEtaMinutes)} away
              </Text>
            </View>
          )}
        </View>
      </View>

      <Animated.View style={[styles.trackingCard, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        
        <View style={styles.driverSection}>
          <TouchableOpacity
            style={styles.driverInfo}
            onPress={() =>
              currentBooking?.driver_id &&
              navigation.navigate('DriverProfile', {
                driverId: currentBooking.driver_id,
              })
            }
            activeOpacity={0.75}
            accessibilityLabel="View driver profile"
          >
            <Surface style={styles.driverAvatar} elevation={2}>
              <MaterialCommunityIcons name="account-tie" size={36} color={colors.primary} />
            </Surface>
            <View>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={14} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={styles.ratingText}>
                  {(driver?.rating ?? 5).toFixed(1)} ({driver?.total_trips ?? 0} trips)
                </Text>
              </View>
              <Text style={[styles.ratingText, { color: colors.accent, marginTop: 2 }]}>
                View profile →
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.driverActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleCallDriver} activeOpacity={0.76} accessibilityLabel="Call driver">
              <MaterialCommunityIcons name="phone" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleMessageDriver} activeOpacity={0.76} accessibilityLabel="Message driver">
              <MaterialCommunityIcons name="message-text" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleCard}>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehiclePlate}>{plate}</Text>
            <Text style={styles.vehicleDesc}>{vehicleDesc} • FEDTODAB</Text>
          </View>
          <TricycleIcon size={56} color={colors.primaryDark} />
        </View>

        <View style={styles.routeProgress}>
          {[
            { label: 'Driver assigned', active: true },
            { label: 'Pickup', active: status === 'in-transit' || status === 'completed' },
            { label: 'Drop-off', active: status === 'completed' },
          ].map((step, index) => (
            <View key={step.label} style={styles.progressStep}>
              <View style={[styles.progressDot, step.active && styles.progressDotActive]}>
                {step.active && <View style={styles.progressDotInner} />}
              </View>
              {index < 2 && <View style={[styles.progressLine, index === 0 && styles.progressLineActive]} />}
              <Text style={[styles.progressLabel, step.active && styles.progressLabelActive]}>{step.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tripDetails}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="map-marker-radius" size={24} color={colors.primary} style={styles.detailIcon} />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Destination</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {currentBooking?.dropoff_location.address || 'Boac Public Market'}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="cash" size={24} color={colors.success} style={styles.detailIcon} />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Estimated Fare</Text>
              <Text style={[styles.detailValue, typography.currency]}>
                ₱{currentBooking ? currentBooking.total_fare.toFixed(2) : '0.00'}
              </Text>
            </View>
          </View>
        </View>

        {/* The driver marks the trip complete; the passenger just waits and is
            prompted to rate afterwards. Before pickup the passenger may cancel. */}
        {status === 'in-transit' ? (
          <View style={styles.waitBanner}>
            <MaterialCommunityIcons name="navigation-variant" size={20} color={colors.primary} />
            <Text style={styles.waitText}>Enjoy your ride — your driver will end the trip on arrival.</Text>
          </View>
        ) : status === 'completed' ? (
          <>
            {paidViaEMoney ? (
              <View style={styles.paidBanner}>
                <MaterialCommunityIcons name="check-decagram" size={20} color={colors.success} />
                <Text style={styles.paidText}>Paid {fareText} via {providerLabel}</Text>
              </View>
            ) : isEMoney ? (
              <View style={styles.waitBanner}>
                <MaterialCommunityIcons name="cash" size={20} color={colors.primary} />
                <Text style={styles.waitText}>Please pay {fareText} in cash to your driver.</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.completeBtn} onPress={() => setRatingVisible(true)} activeOpacity={0.85}>
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.completeGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <MaterialCommunityIcons name="star" size={20} color="#fff" />
                <Text style={styles.completeText}>Rate your trip</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <Button
            variant="outline"
            icon="close-circle-outline"
            onPress={handleCancel}
            loading={cancelling}
            disabled={cancelling}
            style={styles.cancelBtn}
          >
            Cancel Ride
          </Button>
        )}

        <Button
          variant="outline"
          icon="shield-alert-outline"
          onPress={handleSOS}
          style={styles.sosBtn}
        >
          Emergency SOS
        </Button>
      </Animated.View>

      <Modal visible={ratingVisible} transparent animationType="fade" onRequestClose={() => setRatingVisible(false)}>
        <View style={styles.modalOverlay}>
          <Surface style={styles.ratingCard} elevation={5}>
            <View style={styles.ratingDriverAvatar}>
              <MaterialCommunityIcons name="account-tie" size={36} color={colors.primary} />
            </View>
            <Text style={styles.ratingTitle}>Rate your trip</Text>
            <Text style={styles.ratingSubtitle}>How was your ride with {driverName}?</Text>

            {paidViaEMoney && (
              <View style={styles.paidChip}>
                <MaterialCommunityIcons name="check-decagram" size={14} color={colors.success} />
                <Text style={styles.paidChipText}>Paid {fareText} via {providerLabel}</Text>
              </View>
            )}

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setStars(n)} activeOpacity={0.7}>
                  <MaterialCommunityIcons
                    name={n <= stars ? 'star' : 'star-outline'}
                    size={40}
                    color={n <= stars ? '#FBBF24' : colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              placeholder="Leave a comment (optional)"
              value={comment}
              onChangeText={setComment}
              style={styles.commentInput}
              placeholderTextColor={colors.textLight}
              multiline
            />

            <TouchableOpacity
              style={[styles.submitRatingBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmitRating}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.submitRatingGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.submitRatingText}>{submitting ? 'Submitting...' : 'Submit & Finish'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Surface>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapView: { flex: 1, backgroundColor: '#CBD5E1', position: 'relative' },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: { position: 'absolute', top: layout.headerTop - 10, left: 20, zIndex: 10, ...shadows.md },
  trackingOverlay: { position: 'absolute', top: layout.headerTop, alignSelf: 'center', zIndex: 5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, ...shadows.md },
  liveEtaChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface, ...shadows.sm },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A', marginRight: 6 },
  liveEtaText: { ...typography.label, fontSize: 12, color: colors.text },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { ...typography.label, fontSize: 13 },
  trackingCard: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40, ...shadows.xl },
  handle: { width: 40, height: 5, backgroundColor: colors.borderLight, borderRadius: 3, alignSelf: 'center', marginBottom: spacing.lg },
  driverSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  driverInfo: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  driverName: { ...typography.title, fontSize: 18, color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  ratingText: { ...typography.body, fontSize: 12, color: colors.textSecondary },
  driverActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  vehicleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primaryLight, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.lg },
  vehicleInfo: { flex: 1 },
  vehiclePlate: { ...typography.number, fontSize: 18, color: colors.primaryDark, letterSpacing: 0 },
  vehicleDesc: { ...typography.body, fontSize: 12, color: colors.primary, marginTop: 2 },
  routeProgress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  progressDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  progressDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  progressLine: {
    position: 'absolute',
    top: 9,
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: colors.borderLight,
  },
  progressLineActive: {
    backgroundColor: colors.primaryLight,
  },
  progressLabel: {
    ...typography.body,
    color: colors.textLight,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  progressLabelActive: {
    color: colors.text,
  },
  tripDetails: { marginBottom: spacing.xl },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  detailIcon: { marginRight: spacing.md },
  detailTextContainer: { flex: 1 },
  detailLabel: { ...typography.label, fontSize: 10, color: colors.textLight, letterSpacing: 0, textTransform: 'uppercase' },
  detailValue: { ...typography.body, fontSize: 14, color: colors.text, marginTop: 2 },
  completeBtn: { height: 52, borderRadius: 14, overflow: 'hidden', marginBottom: spacing.md },
  completeGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  completeText: { ...typography.label, color: '#fff', fontSize: 16, letterSpacing: 0 },
  cancelBtn: { borderColor: colors.error, borderRadius: 14, marginBottom: spacing.md },
  waitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  waitText: { ...typography.body, fontSize: 13, color: colors.primaryDark, flex: 1 },
  paidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  paidText: { ...typography.label, fontSize: 13, color: colors.success, flex: 1 },
  paidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: colors.successLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.md,
  },
  paidChipText: { ...typography.label, fontSize: 12, color: colors.success },
  sosBtn: { borderColor: colors.error, borderRadius: 14 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  ratingCard: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.xl, alignItems: 'center' },
  ratingDriverAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ratingTitle: { ...typography.title, fontSize: 22, color: colors.text },
  ratingSubtitle: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.lg },
  commentInput: {
    width: '100%',
    minHeight: 64,
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
  submitRatingBtn: { width: '100%', height: 52, borderRadius: 14, overflow: 'hidden' },
  submitRatingGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitRatingText: { ...typography.label, color: '#fff', fontSize: 16, letterSpacing: 0 },
});

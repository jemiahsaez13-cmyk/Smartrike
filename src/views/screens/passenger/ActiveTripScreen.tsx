import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useChatUnread } from '@/controllers/hooks/useChatUnread';
import { useAppSelector } from '@/controllers/store';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@/controllers/store';
import { submitRating, cancelBooking, updateBookingStatus, clearCurrentBooking } from '@/controllers/slices/bookingSlice';
import { RealtimeService } from '@/models/services/RealtimeService';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { UserRepository } from '@/models/repositories/UserRepository';
import { ReportService, PASSENGER_REPORT_REASONS } from '@/models/services/ReportService';
import { User } from '@/models/types';
import { Button } from '@/views/components/common/Button';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { colors, layout, radius, spacing, shadows, typography } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { LocationService } from '@/models/services/LocationService';
import { estimateETA, formatDistance, formatETA, haversineDistance } from '@/utils/locationUtils';
import { confirm, notify } from '@/utils/confirm';
import { Location } from '@/models/types';
import { FranchiseService } from '@/models/services/FranchiseService';
import { PublicDriverFranchise, FRANCHISE_RECORD_STATUS_LABEL } from '@/models/entities/Franchise';
import { DirectionsService } from '@/models/services/DirectionsService';
import MapView, { AnimatedMarker, AnimatedRegion, Marker, Polyline, PROVIDER_GOOGLE } from '@/config/maps';
import { PassengerRidePaymentModal } from '@/views/components/payment/PassengerRidePaymentModal';
import { RidePaymentStatus } from '@/models/entities/RidePayment';

const { height } = Dimensions.get('window');
const realtimeService = new RealtimeService();
const bookingRepo = new BookingRepository();
const userRepo = new UserRepository();
const reportService = new ReportService();
const franchiseService = new FranchiseService();
const directionsService = new DirectionsService();

const BOAC_CENTER = { latitude: 13.4452, longitude: 121.8401 };

const RIDE_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#F1F4F2' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B756F' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F1F4F2' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#E7EEE9' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#DDE5DF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#D6E4DA' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C8DDE4' }] },
];

const bearingBetween = (from: Location, to: Location): number => {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
};

export const ActiveTripScreen = () => {
  const { height: screenHeight } = useWindowDimensions();
  const { currentBooking } = useBooking();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const me = useAppSelector((state) => state.auth.user);
  // Unread chat messages from the driver — red badge on the message button.
  const chatUnread = useChatUnread(currentBooking?.id, me?.id);

  const [driver, setDriver] = useState<User | null>(null);
  const [franchise, setFranchise] = useState<PublicDriverFranchise | null>(null);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [driverCoords, setDriverCoords] = useState<Location | null>(null);
  const [lastDriverUpdate, setLastDriverUpdate] = useState<Date | null>(null);
  const [roadPoints, setRoadPoints] = useState<{ latitude: number; longitude: number }[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [followDriver, setFollowDriver] = useState(true);
  const [driverHeading, setDriverHeading] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  // Report-driver sheet (opened from the rating modal or on its own).
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  // True when the report was opened from the rating sheet, so cancelling
  // returns there instead of dropping the post-trip flow.
  const [reportFromRating, setReportFromRating] = useState(false);
  // Driver-owned online payment proof workflow.
  const [payVisible, setPayVisible] = useState(false);
  const [paymentReviewStatus, setPaymentReviewStatus] = useState<RidePaymentStatus | null>(null);
  const autoPromptedPay = useRef(false);
  const mapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const previousDriverCoords = useRef<Location | null>(null);
  const lastMarkerAnimationAt = useRef(Date.now());
  const animatedDriverCoordinate = useRef(
    new AnimatedRegion({
      ...BOAC_CENTER,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  const status = currentBooking?.status || 'accepted';
  const driverId = currentBooking?.driver_id || null;
  const vehicle = (driver as any)?.vehicle_details || {};
  const driverName = driver?.name || 'Your driver';
  const plate = vehicle.plate_number || vehicle.plate || '—';
  const vehicleDesc = [vehicle.color, vehicle.model].filter(Boolean).join(' ') || 'FEDTODAB Tricycle';
  const bodyNumber = franchise?.body_number || vehicle.body_number || 'Unassigned';
  const franchiseStatus = franchise?.franchise_status
    ? franchise.franchise_status === 'active' && franchise.last_renewed_at
      ? `Renewed ${franchise.renewal_year || new Date(franchise.last_renewed_at).getFullYear()} · Active`
      : FRANCHISE_RECORD_STATUS_LABEL[franchise.franchise_status]
    : 'Record unavailable';

  const paymentMethod = currentBooking?.payment_method || 'cash';
  const isEMoney = paymentMethod !== 'cash';
  const paidViaEMoney = isEMoney && currentBooking?.payment_status === 'completed';
  const isOnline = paymentMethod === 'online';
  const onlineUnpaid = isOnline && currentBooking?.payment_status !== 'completed' && paymentReviewStatus !== 'verified';
  const providerLabel = paymentMethod === 'paymaya' ? 'Maya' : paymentMethod === 'gcash' ? 'GCash' : paymentMethod === 'online' ? 'Online' : 'cash';
  const fareText = `₱${(currentBooking?.total_fare ?? 0).toFixed(2)}`;
  const pickupCoord = currentBooking?.pickup_location
    ? {
        latitude: currentBooking.pickup_location.latitude,
        longitude: currentBooking.pickup_location.longitude,
      }
    : null;
  const dropoffCoord = currentBooking?.dropoff_location
    ? {
        latitude: currentBooking.dropoff_location.latitude,
        longitude: currentBooking.dropoff_location.longitude,
      }
    : null;
  const trackingTarget = status === 'in-transit' || status === 'completed' ? dropoffCoord : pickupCoord;
  const canUseNativeMap = Platform.OS !== 'web' && !!MapView;
  const maxPanelHeight = Math.max(420, Math.min(560, screenHeight * 0.62));

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

  useEffect(() => {
    let active = true;
    if (!driverId) {
      setFranchise(null);
      return;
    }
    franchiseService
      .getPublicDriverFranchise(driverId)
      .then((record) => { if (active) setFranchise(record); })
      .catch(() => { if (active) setFranchise(null); });
    return () => { active = false; };
  }, [driverId]);

  // Subscribe to the assigned driver's live location so we can show a moving
  // position + a live ETA to the pickup point. Falls back silently if the
  // driver isn't streaming yet.
  useEffect(() => {
    if (!driverId) return;
    let active = true;
    const realtime = new RealtimeService();
    const locationService = new LocationService();

    locationService.getDriverLocation(driverId).then((loc) => {
      if (active && loc) {
        setDriverCoords(loc);
        setLastDriverUpdate(loc.timestamp ? new Date(loc.timestamp) : new Date());
      }
    }).catch(() => undefined);

    const key = realtime.subscribeToDriverLocation(driverId, (payload) => {
      const row = payload?.new;
      if (row?.latitude != null && row?.longitude != null) {
        setDriverCoords({ latitude: row.latitude, longitude: row.longitude, address: '' });
        setLastDriverUpdate(row.timestamp ? new Date(row.timestamp) : new Date());
      }
    });

    return () => {
      active = false;
      realtime.unsubscribe(key);
    };
  }, [driverId]);

  // Draw the actual road route for the booked trip. If Directions is
  // unavailable, the map falls back to a clean pickup-to-drop-off segment.
  useEffect(() => {
    let active = true;
    if (!pickupCoord || !dropoffCoord) {
      setRoadPoints([]);
      return;
    }
    directionsService
      .getRoute(pickupCoord, dropoffCoord)
      .then((route) => {
        if (active) setRoadPoints(route?.points ?? []);
      })
      .catch(() => {
        if (active) setRoadPoints([]);
      });
    return () => {
      active = false;
    };
  }, [
    pickupCoord?.latitude,
    pickupCoord?.longitude,
    dropoffCoord?.latitude,
    dropoffCoord?.longitude,
  ]);

  const centerTrackingMap = useCallback(
    (animated = true) => {
      if (!mapRef.current) return;
      const points = [driverCoords, trackingTarget].filter(Boolean).map((point: any) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      }));

      if (points.length > 1) {
        mapRef.current.fitToCoordinates(points, {
          edgePadding: {
            top: 116,
            right: 52,
            bottom: Math.min(380, screenHeight * 0.48),
            left: 52,
          },
          animated,
        });
      } else if (points.length === 1) {
        mapRef.current.animateCamera(
          { center: points[0], zoom: 16, pitch: 20 },
          { duration: animated ? 650 : 0 }
        );
      }
    },
    [
      driverCoords?.latitude,
      driverCoords?.longitude,
      trackingTarget?.latitude,
      trackingTarget?.longitude,
      screenHeight,
    ]
  );

  // Interpolate between five-second GPS pings so the tricycle glides instead
  // of teleporting. Camera following pauses as soon as the passenger pans.
  useEffect(() => {
    if (!driverCoords) return;
    const previous = previousDriverCoords.current;
    const now = Date.now();
    const next = {
      latitude: driverCoords.latitude,
      longitude: driverCoords.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    };

    if (!previous) {
      animatedDriverCoordinate.setValue(next);
    } else {
      if (haversineDistance(previous, driverCoords) > 0.003) {
        setDriverHeading(bearingBetween(previous, driverCoords));
      }
      const duration = Math.min(4500, Math.max(900, (now - lastMarkerAnimationAt.current) * 0.9));
      if (Platform.OS === 'android' && driverMarkerRef.current?.animateMarkerToCoordinate) {
        driverMarkerRef.current.animateMarkerToCoordinate(next, duration);
      } else {
        animatedDriverCoordinate
          .timing({ ...next, duration, useNativeDriver: false } as any)
          .start();
      }
    }

    previousDriverCoords.current = driverCoords;
    lastMarkerAnimationAt.current = now;
    if (mapReady && followDriver) centerTrackingMap(true);
  }, [
    animatedDriverCoordinate,
    centerTrackingMap,
    driverCoords?.latitude,
    driverCoords?.longitude,
    followDriver,
    mapReady,
  ]);

  useEffect(() => {
    if (mapReady) centerTrackingMap(false);
  }, [centerTrackingMap, mapReady]);

  // ETA switches from driver→pickup to driver→destination after pickup.
  const liveDistanceKm =
    driverCoords && trackingTarget
      ? haversineDistance(driverCoords, { ...trackingTarget, address: '' })
      : null;
  const liveEtaMinutes =
    liveDistanceKm != null
      ? estimateETA(liveDistanceKm, status === 'in-transit' ? 24 : 22)
      : null;
  const driverGpsFresh = Boolean(
    lastDriverUpdate && Date.now() - lastDriverUpdate.getTime() < 30_000
  );

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

  // Show the assigned driver's real payment details as soon as a driver accepts.
  useEffect(() => {
    if ((status === 'accepted' || status === 'in-transit') && onlineUnpaid && !autoPromptedPay.current) {
      autoPromptedPay.current = true;
      setPayVisible(true);
    }
  }, [status, onlineUnpaid]);

  // When the driver completes the trip, prompt the passenger to rate it
  // (but never stack it on top of an open payment sheet).
  useEffect(() => {
    if (status === 'completed' && !payVisible) setRatingVisible(true);
  }, [status, payVisible]);

  const closePaySheet = () => {
    setPayVisible(false);
    // If the trip already ended behind the sheet, move on to rating.
    if (status === 'completed') setRatingVisible(true);
  };

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
    if (cancelling) return;
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
      navigation.navigate('PassengerDashboard');
    } catch (error) {
      await notify('Could not cancel ride', typeof error === 'string' ? error : 'Please check your connection and try again. Your ride has not been cancelled.');
    } finally {
      setCancelling(false);
    }
  };

  const handleSOS = () => {
    void notify('Emergency SOS', 'For urgent help, contact the TODA dispatch desk right away.');
  };

  // Open the report sheet without stacking it on top of the rating sheet.
  const openReport = (fromRating: boolean) => {
    setReportFromRating(fromRating);
    if (fromRating) setRatingVisible(false);
    setReportVisible(true);
  };

  const closeReport = () => {
    setReportVisible(false);
    setReportReason('');
    setReportDetails('');
    if (reportFromRating) {
      setReportFromRating(false);
      setRatingVisible(true);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportReason) {
      void notify('Choose a reason', 'Please select what happened so we can review it.');
      return;
    }
    if (!me?.id || !driverId) return;
    setSubmittingReport(true);
    try {
      await reportService.fileReport({
        bookingId: currentBooking?.id,
        reporterId: me.id,
        reportedId: driverId,
        reporterRole: 'passenger',
        reason: reportReason,
        details: reportDetails,
      });
      setReportVisible(false);
      setReportReason('');
      setReportDetails('');
      const backToRating = reportFromRating;
      setReportFromRating(false);
      await notify('Report submitted', 'Thanks — the TODA admin will review this driver.');
      if (backToRating) setRatingVisible(true);
    } catch (e: any) {
      await notify('Could not submit report', e?.message || 'Please try again.');
    } finally {
      setSubmittingReport(false);
    }
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

  if (!currentBooking) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={42} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No active ride</Text>
        <Text style={styles.emptyText}>Your next booked trip will appear here with live driver tracking.</Text>
        <Button variant="primary" onPress={() => navigation.navigate('PassengerDashboard')}>
          Back to home
        </Button>
      </View>
    );
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { bg: string; dot: string; fg: string; label: string }> = {
      accepted: { bg: colors.surface, dot: colors.success, fg: colors.text, label: 'Driver is on the way' },
      'in-transit': { bg: colors.surface, dot: colors.primary, fg: colors.text, label: 'Heading to destination' },
      completed: { bg: colors.surface, dot: colors.success, fg: colors.text, label: "You've arrived" },
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
        {canUseNativeMap ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            customMapStyle={RIDE_MAP_STYLE}
            initialRegion={{
              latitude: driverCoords?.latitude ?? pickupCoord?.latitude ?? BOAC_CENTER.latitude,
              longitude: driverCoords?.longitude ?? pickupCoord?.longitude ?? BOAC_CENTER.longitude,
              latitudeDelta: 0.025,
              longitudeDelta: 0.025,
            }}
            showsCompass={false}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            onMapReady={() => setMapReady(true)}
            onPanDrag={() => setFollowDriver(false)}
          >
            {pickupCoord && dropoffCoord && (
              <Polyline
                coordinates={roadPoints.length > 1 ? roadPoints : [pickupCoord, dropoffCoord]}
                strokeColor={status === 'accepted' ? 'rgba(59,99,78,0.38)' : colors.primary}
                strokeWidth={status === 'accepted' ? 4 : 5}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {status === 'accepted' && driverCoords && pickupCoord && (
              <Polyline
                coordinates={[
                  { latitude: driverCoords.latitude, longitude: driverCoords.longitude },
                  pickupCoord,
                ]}
                strokeColor={colors.primaryDark}
                strokeWidth={4}
                lineDashPattern={[8, 7]}
                lineCap="round"
              />
            )}

            {pickupCoord && (
              <Marker coordinate={pickupCoord} title="Pickup point" accessibilityLabel="Passenger pickup point">
                <View style={styles.pickupMapMarker}>
                  <MaterialCommunityIcons name="account" size={18} color="#FFFFFF" />
                </View>
              </Marker>
            )}

            {dropoffCoord && (
              <Marker coordinate={dropoffCoord} title="Destination" accessibilityLabel="Trip destination">
                <View style={styles.dropoffMapMarker}>
                  <MaterialCommunityIcons name="flag-checkered" size={18} color="#FFFFFF" />
                </View>
              </Marker>
            )}

            {driverCoords && (
              <AnimatedMarker
                ref={driverMarkerRef}
                coordinate={animatedDriverCoordinate as any}
                anchor={{ x: 0.5, y: 0.5 }}
                title={driverName}
                description="Live driver location"
                accessibilityLabel={`${driverName}'s live location`}
                zIndex={20}
              >
                <View style={styles.driverMapMarker}>
                  <View style={styles.driverMarkerHalo} />
                  <View style={styles.driverMarkerBubble}>
                    <TricycleIcon size={34} color="#FFFFFF" />
                  </View>
                  <View
                    style={[
                      styles.headingBadge,
                      { transform: [{ rotate: `${driverHeading}deg` }] },
                    ]}
                  >
                    <MaterialCommunityIcons name="navigation-variant" size={11} color="#FFFFFF" />
                  </View>
                </View>
              </AnimatedMarker>
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <View style={styles.webMapIcon}>
              <MaterialCommunityIcons name="map-marker-path" size={38} color={colors.primary} />
            </View>
            <Text style={styles.webMapTitle}>Live map is available on mobile</Text>
            <Text style={styles.webMapText}>Driver updates and trip status still sync here.</Text>
          </View>
        )}
        
        <IconButton 
          icon="chevron-left" 
          mode="contained"
          containerColor={colors.surface}
          style={styles.backBtn}
          onPress={() => navigation.navigate('PassengerDashboard')}
          accessibilityLabel="Back to passenger home"
        />

        {canUseNativeMap && (
          <TouchableOpacity
            style={[styles.recenterBtn, { bottom: maxPanelHeight + spacing.md }]}
            onPress={() => {
              setFollowDriver(true);
              centerTrackingMap(true);
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Recenter map on driver"
          >
            <MaterialCommunityIcons
              name={followDriver ? 'navigation-variant' : 'crosshairs-gps'}
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}

        <View style={styles.trackingOverlay} accessibilityLiveRegion="polite">
          <StatusBadge status={status} />
          {liveEtaMinutes != null && (
            <View style={styles.liveEtaChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveEtaText}>
                {status === 'in-transit' ? 'Arrival' : 'Pickup'} in {formatETA(liveEtaMinutes)}
                {liveDistanceKm != null ? ` · ${formatDistance(liveDistanceKm)}` : ''}
              </Text>
            </View>
          )}
          {driverId && !driverCoords && (
            <View style={styles.liveEtaChip}>
              <ActivityIndicator size={12} color={colors.primary} />
              <Text style={styles.liveEtaText}>Connecting to driver's GPS…</Text>
            </View>
          )}
        </View>
      </View>

      <Animated.View style={[styles.trackingCard, { maxHeight: maxPanelHeight, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.panelContent}
        >
        
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
            accessibilityRole="button"
            accessibilityLabel="View driver profile"
          >
            <Surface style={styles.driverAvatar} elevation={2}>
              <MaterialCommunityIcons name="account-tie" size={36} color={colors.primary} />
            </Surface>
            <View style={styles.driverTextBlock}>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={14} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={styles.ratingText}>
                  {(driver?.total_trips ?? 0) > 0
                    ? `${(driver?.rating ?? 5).toFixed(1)} (${driver?.total_trips} trips)`
                    : 'No ratings yet'}
                </Text>
              </View>
              <Text style={[styles.ratingText, { color: colors.accent, marginTop: 2 }]}>
                View profile →
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.driverActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleCallDriver} activeOpacity={0.76} accessibilityRole="button" accessibilityLabel="Call driver">
              <MaterialCommunityIcons name="phone" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleMessageDriver} activeOpacity={0.76} accessibilityRole="button" accessibilityLabel="Message driver">
              <MaterialCommunityIcons name="message-text" size={20} color={colors.primary} />
              {chatUnread > 0 && (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleCard}>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehiclePlate}>{plate}</Text>
            <Text style={styles.vehicleDesc}>{vehicleDesc} • FEDTODAB</Text>
            <View style={styles.gpsStatusRow}>
              <View style={[styles.gpsStatusDot, !driverGpsFresh && styles.gpsStatusDotWaiting]} />
              <Text style={styles.gpsStatusText}>
                {!lastDriverUpdate
                  ? 'Waiting for driver GPS'
                  : driverGpsFresh
                  ? 'Live GPS connected'
                  : 'Location signal delayed'}
              </Text>
            </View>
            <View style={styles.franchiseMetaRow}>
              <View style={styles.bodyBadge}>
                <Text style={styles.bodyBadgeLabel}>BODY</Text>
                <Text style={styles.bodyBadgeValue}>{bodyNumber}</Text>
              </View>
              <View style={styles.franchiseBadge}>
                <MaterialCommunityIcons name="shield-check-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.franchiseBadgeText}>{franchiseStatus}</Text>
              </View>
            </View>
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
              {index < 2 && (
                <View
                  style={[
                    styles.progressLine,
                    ((index === 0 && (status === 'in-transit' || status === 'completed')) ||
                      (index === 1 && status === 'completed')) &&
                      styles.progressLineActive,
                  ]}
                />
              )}
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
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="account-multiple-outline" size={24} color={colors.primary} style={styles.detailIcon} />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Passengers &amp; Payment</Text>
              <Text style={styles.detailValue}>
                {currentBooking?.passenger_count ?? 1} passenger{(currentBooking?.passenger_count ?? 1) > 1 ? 's' : ''}
                {' • '}{paymentMethod === 'cash' ? 'Pay driver in cash' : providerLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* The driver marks the trip complete; the passenger just waits and is
            prompted to rate afterwards. Before pickup the passenger may cancel. */}
        {status === 'in-transit' ? (
          <>
            {isOnline && (onlineUnpaid ? (
              <TouchableOpacity
                style={styles.payNowBanner}
                onPress={() => setPayVisible(true)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="credit-card-clock-outline" size={20} color="#fff" />
                <Text style={styles.payNowText}>{paymentReviewStatus === 'pending' ? 'Payment submitted — awaiting driver review' : paymentReviewStatus === 'rejected' ? 'Payment rejected — tap to resubmit proof' : `Payment due — tap to pay ${fareText} online`}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.paidBanner}>
                <MaterialCommunityIcons name="check-decagram" size={20} color={colors.success} />
                <Text style={styles.paidText}>Paid {fareText} via {providerLabel}</Text>
              </View>
            ))}
            <View style={styles.waitBanner}>
              <MaterialCommunityIcons name="navigation-variant" size={20} color={colors.primary} />
              <Text style={styles.waitText}>Enjoy your ride — your driver will end the trip on arrival.</Text>
            </View>
          </>
        ) : status === 'completed' ? (
          <>
            {paidViaEMoney ? (
              <View style={styles.paidBanner}>
                <MaterialCommunityIcons name="check-decagram" size={20} color={colors.success} />
                <Text style={styles.paidText}>Paid {fareText} via {providerLabel}</Text>
              </View>
            ) : isOnline ? (
              <TouchableOpacity
                style={styles.payNowBanner}
                onPress={() => setPayVisible(true)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="credit-card-clock-outline" size={20} color="#fff" />
                <Text style={styles.payNowText}>Settle your fare — pay {fareText} online</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
              </TouchableOpacity>
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
        </ScrollView>
      </Animated.View>

      {isOnline && currentBooking && <PassengerRidePaymentModal booking={currentBooking} driverName={driverName} visible={payVisible} onClose={closePaySheet} onStatus={setPaymentReviewStatus} onBookingChanged={(booking) => dispatch(updateBookingStatus(booking))} />}

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

            <TouchableOpacity onPress={() => openReport(true)} style={styles.reportLink} activeOpacity={0.7}>
              <MaterialCommunityIcons name="flag-outline" size={15} color={colors.error} />
              <Text style={styles.reportLinkText}>Report driver</Text>
            </TouchableOpacity>
          </Surface>
        </View>
      </Modal>

      {/* ── Report Driver Modal ─────────────────────────────────────── */}
      <Modal visible={reportVisible} transparent animationType="fade" onRequestClose={closeReport}>
        <View style={styles.modalOverlay}>
          <Surface style={styles.ratingCard} elevation={5}>
            <View style={[styles.ratingDriverAvatar, { backgroundColor: colors.errorLight }]}>
              <MaterialCommunityIcons name="flag" size={36} color={colors.error} />
            </View>
            <Text style={styles.ratingTitle}>Report {driverName}</Text>
            <Text style={styles.ratingSubtitle}>Tell us what happened. This goes to the TODA admin for review.</Text>

            <View style={styles.reasonWrap}>
              {PASSENGER_REPORT_REASONS.map((r) => {
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
              placeholderTextColor={colors.textLight}
              multiline
              maxLength={300}
            />

            <TouchableOpacity
              style={[styles.submitRatingBtn, submittingReport && { opacity: 0.6 }]}
              onPress={handleSubmitReport}
              disabled={submittingReport}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[colors.error, '#B91C1C']} style={styles.submitRatingGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.submitRatingText}>{submittingReport ? 'Submitting…' : 'Submit Report'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeReport} style={styles.reportCancelBtn} activeOpacity={0.7}>
              <Text style={styles.reportCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Surface>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  mapView: { flex: 1, backgroundColor: '#E7EEE9', position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surfaceAlt,
  },
  webMapIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.md,
  },
  webMapTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  webMapText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  pickupMapMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...shadows.md,
  },
  dropoffMapMarker: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...shadows.md,
  },
  driverMapMarker: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerHalo: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(59,99,78,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59,99,78,0.28)',
  },
  driverMarkerBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...shadows.lg,
  },
  headingBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  backBtn: { position: 'absolute', top: layout.headerTop - 10, left: 20, zIndex: 10, ...shadows.md },
  recenterBtn: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  trackingOverlay: { position: 'absolute', top: layout.headerTop, alignSelf: 'center', zIndex: 5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, ...shadows.md },
  liveEtaChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface, ...shadows.sm },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3B634E', marginRight: 6 },
  liveEtaText: { ...typography.label, fontSize: 12, color: colors.text },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { ...typography.label, fontSize: 13 },
  trackingCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: 0,
    ...shadows.xl,
  },
  handle: { width: 40, height: 5, backgroundColor: colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: spacing.sm },
  panelContent: { paddingBottom: 36 },
  driverSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  driverInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: spacing.sm },
  driverTextBlock: { flex: 1, minWidth: 0 },
  driverAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  driverName: { ...typography.title, fontSize: 18, color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  ratingText: { ...typography.body, fontSize: 12, color: colors.textSecondary },
  driverActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  chatBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  vehicleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primaryLight, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.md },
  vehicleInfo: { flex: 1 },
  vehiclePlate: { ...typography.number, fontSize: 18, color: colors.primaryDark, letterSpacing: 0 },
  vehicleDesc: { ...typography.body, fontSize: 12, color: colors.primary, marginTop: 2 },
  gpsStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  gpsStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  gpsStatusDotWaiting: { backgroundColor: colors.warning },
  gpsStatusText: { ...typography.bodySmall, fontSize: 10, color: colors.textSecondary },
  franchiseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  bodyBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: 9 },
  bodyBadgeLabel: { ...typography.labelSmall, fontSize: 8, color: colors.textMuted, letterSpacing: 0.8 },
  bodyBadgeValue: { ...typography.label, fontSize: 11, color: colors.primaryDark },
  franchiseBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: 9 },
  franchiseBadgeText: { ...typography.labelSmall, fontSize: 10, color: colors.primaryDark },
  routeProgress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
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
    backgroundColor: colors.primary,
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
  tripDetails: { marginBottom: spacing.md },
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
  // Driver-owned online payment proof sheet
  payNowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  payNowText: { ...typography.label, fontSize: 13, color: '#fff', flex: 1 },
  payCard: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.xl, alignItems: 'center' },
  payIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  payTitle: { ...typography.title, fontSize: 22, color: colors.text },
  paySubtitle: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md, textAlign: 'center' },
  payAmount: { ...typography.h1, fontSize: 36, color: colors.text, marginBottom: spacing.sm },
  payMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.lg, maxWidth: '92%' },
  payMetaText: { ...typography.bodySmall, color: colors.textSecondary, flexShrink: 1 },
  payBtn: { width: '100%', height: 52, borderRadius: 14, overflow: 'hidden' },
  payBtnGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  payBtnText: { ...typography.label, color: '#fff', fontSize: 16, letterSpacing: 0 },
  payLaterBtn: { paddingVertical: spacing.sm, marginTop: spacing.xs },
  payLaterText: { ...typography.body, fontSize: 14, color: colors.textSecondary },
  demoBadge: {
    backgroundColor: colors.infoLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  demoBadgeText: { ...typography.label, fontSize: 10, letterSpacing: 1.2, color: colors.info },
  demoNote: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
  payRefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.lg,
  },
  payRefText: { ...typography.label, fontSize: 12, color: colors.textSecondary },
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
  // Report driver
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.sm, marginTop: spacing.sm },
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
  reportCancelBtn: { paddingVertical: spacing.sm, marginTop: spacing.xs },
  reportCancelText: { ...typography.body, fontSize: 14, color: colors.textSecondary },
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, ScrollView, StyleSheet, TextInput as RNTextInput, TouchableOpacity, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useLocation } from '@/controllers/hooks/useLocation';
import { useAppDispatch } from '@/controllers/store';
import { fetchEMoneyAccounts } from '@/controllers/slices/paymentSlice';
import { confirm, notify } from '@/utils/confirm';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { FareCalculationService } from '@/models/services/FareCalculationService';
import { PopularPlaceService } from '@/models/services/PopularPlaceService';
import { Location } from '@/models/types';
import { PopularPlace } from '@/config/constants';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/config/maps';

// Desaturated "silver" Google Maps style — the clean, low-contrast look Uber uses.
const UBER_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
];

const { height } = Dimensions.get('window');
const fareService = new FareCalculationService();
const placeService = new PopularPlaceService();
const BOAC_CENTER = { latitude: 13.4452, longitude: 121.8401 };

const placeToLocation = (p: PopularPlace): Location => ({
  latitude: p.lat,
  longitude: p.lng,
  address: p.name,
});

const RIDE_OPTIONS = [
  { id: 'standard', label: 'Standard', desc: 'Regular TODA queue', icon: 'rickshaw' },
  { id: 'priority', label: 'Priority', desc: 'Faster driver matching', icon: 'lightning-bolt-outline' },
] as const;

export const BookRideScreen = () => {
  const { user } = useAuth();
  const { bookRide, loading } = useBooking();
  const { currentLocation, getLocation } = useLocation();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoff, setDropoff] = useState<Location | null>(null);
  const [estimate, setEstimate] = useState<{ fare: number; distance: number; eta: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [rideType, setRideType] = useState<'standard' | 'priority'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [passengers, setPassengers] = useState(1);
  const [tripNote, setTripNote] = useState('');
  const [destinations, setDestinations] = useState<PopularPlace[]>([]);
  const [picking, setPicking] = useState(false);
  const [pinTarget, setPinTarget] = useState<'pickup' | 'dropoff'>('dropoff');
  const [pickup, setPickup] = useState<Location | null>(null);
  const [bookForOther, setBookForOther] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [otherPhone, setOtherPhone] = useState('');

  useEffect(() => {
    placeService.listActive().then(setDestinations).catch(() => undefined);
  }, []);

  const sheetAnim = useRef(new Animated.Value(height * 0.42)).current;
  const mapRef = useRef<any>(null);
  const mapSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // react-native-maps only renders on native; on web we show the faux map.
  const canUseNativeMap = !!MapView && Platform.OS !== 'web';

  // The pickup defaults to the device location but can be re-pinned.
  const effectivePickup = pickup || currentLocation;
  const pickupCoord = effectivePickup
    ? { latitude: effectivePickup.latitude, longitude: effectivePickup.longitude }
    : null;
  const dropCoord = dropoff ? { latitude: dropoff.latitude, longitude: dropoff.longitude } : null;

  // Region that frames pickup + dropoff (or just the pickup) with breathing room.
  const region = useMemo(() => {
    if (pickupCoord && dropCoord) {
      return {
        latitude: (pickupCoord.latitude + dropCoord.latitude) / 2,
        longitude: (pickupCoord.longitude + dropCoord.longitude) / 2,
        latitudeDelta: Math.max(0.02, Math.abs(pickupCoord.latitude - dropCoord.latitude) * 1.8),
        longitudeDelta: Math.max(0.02, Math.abs(pickupCoord.longitude - dropCoord.longitude) * 1.8),
      };
    }
    const base = pickupCoord || BOAC_CENTER;
    return { ...base, latitudeDelta: 0.03, longitudeDelta: 0.03 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoord?.latitude, pickupCoord?.longitude, dropCoord?.latitude, dropCoord?.longitude]);

  useEffect(() => {
    getLocation()
      .catch(() => undefined)
      .finally(() => {
        setLoadingLocation(false);
        Animated.spring(sheetAnim, {
          toValue: 0,
          tension: 48,
          friction: 9,
          useNativeDriver: true,
        }).start();
      });
  }, [getLocation, sheetAnim]);

  // Keep the native map framed on the active pickup/dropoff pair.
  useEffect(() => {
    if (mapRef.current?.animateToRegion) mapRef.current.animateToRegion(region, 650);
  }, [region]);

  useEffect(() => {
    let active = true;
    const compute = async () => {
      const ep = pickup || currentLocation;
      if (!ep || !dropoff) {
        setEstimate(null);
        return;
      }
      try {
        const distance = await fareService.calculateDistance(ep, dropoff);
        const { baseFare, perKmRate, multiplier } = await fareService.getFareConfig();
        const standardFare = fareService.calculateFare(distance, baseFare, perKmRate, multiplier);
        const fare = rideType === 'priority' ? standardFare + Math.max(12, standardFare * 0.15) : standardFare;
        const eta = Math.max(3, Math.ceil((distance / (rideType === 'priority' ? 30 : 25)) * 60));
        if (active) setEstimate({ fare, distance, eta });
      } catch {
        if (active) setEstimate(null);
      }
    };
    compute();
    return () => {
      active = false;
    };
  }, [pickup, currentLocation, dropoff, rideType]);

  useEffect(() => {
    const destination = route.params?.destination;
    if (!destination) return;
    const q = String(destination).toLowerCase();
    const match = destinations.find(
      (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
    );
    if (match) selectDestination(placeToLocation(match));
  }, [route.params?.destination, destinations]);

  // A popular place passed with full coordinates pre-fills the drop-off directly.
  useEffect(() => {
    const place = route.params?.place;
    if (place?.latitude && place?.longitude) {
      selectDestination({ latitude: place.latitude, longitude: place.longitude, address: place.address || 'Destination' });
    }
  }, [route.params?.place]);

  function selectDestination(dest: Location) {
    setDropoff(dest);
    setDropoffAddress(dest.address);
  }

  const recenter = () => {
    if (mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion({ ...(pickupCoord || BOAC_CENTER), latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
    }
  };

  // Enter full-screen tap-to-pin mode for either pickup or drop-off. The sheet
  // slides away so the whole map is usable.
  const openPickerFor = (target: 'pickup' | 'dropoff') => {
    setPinTarget(target);
    setPicking(true);
    Animated.timing(sheetAnim, { toValue: height, duration: 240, useNativeDriver: true }).start();
  };
  const closePicker = () => {
    setPicking(false);
    Animated.spring(sheetAnim, { toValue: 0, tension: 48, friction: 9, useNativeDriver: true }).start();
  };

  const applyPin = (coord: { latitude: number; longitude: number }) => {
    const loc: Location = {
      latitude: coord.latitude,
      longitude: coord.longitude,
      address: pinTarget === 'pickup' ? 'Pinned pickup' : 'Pinned destination',
    };
    if (pinTarget === 'pickup') setPickup(loc);
    else selectDestination(loc);
    closePicker();
  };

  // Works everywhere: a native map tap carries real coordinates; a tap on the
  // web/faux map carries pixel offsets we convert to geo within the framed region.
  const handleMapTap = (e: any) => {
    const ne = e?.nativeEvent;
    if (!ne) return;
    if (ne.coordinate) {
      applyPin(ne.coordinate);
      return;
    }
    const { width, height: h } = mapSizeRef.current;
    const x = ne.locationX;
    const y = ne.locationY;
    if (width && h && x != null && y != null) {
      applyPin({
        latitude: region.latitude + (0.5 - y / h) * region.latitudeDelta,
        longitude: region.longitude + (x / width - 0.5) * region.longitudeDelta,
      });
    }
  };

  const handleBooking = async () => {
    const ep = pickup || currentLocation;
    if (!ep || !dropoff) {
      void notify('Choose Destination', 'Set a drop-off — pick a place, tap the map, or use “Set on map”.');
      return;
    }
    const noteParts: string[] = [];
    if (bookForOther && otherName.trim()) {
      noteParts.push(`For: ${otherName.trim()}${otherPhone.trim() ? ` (${otherPhone.trim()})` : ''}`);
    }
    if (passengers > 1) noteParts.push(`${passengers} passengers`);
    if (tripNote.trim()) noteParts.push(tripNote.trim());
    const notes = noteParts.join(' • ') || undefined;

    const proceed = async (method: 'cash' | 'gcash') => {
      try {
        await bookRide(user!.id, ep, dropoff, { notes, paymentMethod: method });
        navigation.navigate('ConfirmBooking');
      } catch {
        await notify('Booking Failed', 'Unable to create booking. Please try again.');
      }
    };

    // For GCash, confirm the rider has a funded wallet first — otherwise the
    // fare can never be collected and the trip would silently fall back to cash.
    if (paymentMethod === 'gcash') {
      const fare = estimate?.fare ?? 0;
      let acct: any = null;
      try {
        const accounts: any[] = await dispatch(fetchEMoneyAccounts(user!.id)).unwrap();
        acct = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
      } catch {
        acct = null;
      }
      if (!acct || Number(acct.balance) < fare) {
        const detail = !acct
          ? 'You have no funded GCash wallet yet.'
          : `Your GCash balance is ₱${Number(acct.balance).toFixed(2)} but the fare is ₱${fare.toFixed(2)}.`;
        const useCash = await confirm('GCash not ready', `${detail} Pay with cash instead, or open your wallet to cash in.`, {
          confirmText: 'Pay with Cash',
          cancelText: 'Open Wallet',
        });
        if (useCash) {
          setPaymentMethod('cash');
          await proceed('cash');
        } else {
          navigation.navigate('EMoneyWallet');
        }
        return;
      }
    }

    await proceed(paymentMethod);
  };

  if (loadingLocation) return <Loading message="Finding your location..." />;

  return (
    <View style={styles.container}>
      <View
        style={styles.mapContainer}
        onLayout={(e) => {
          mapSizeRef.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
        }}
      >
        {canUseNativeMap ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            customMapStyle={UBER_MAP_STYLE}
            initialRegion={region}
            onPress={picking ? handleMapTap : undefined}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            {pickupCoord && (
              <Marker coordinate={pickupCoord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={styles.pickupMarker}>
                  <View style={styles.pickupMarkerCore} />
                </View>
              </Marker>
            )}
            {dropCoord && (
              <Marker coordinate={dropCoord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={styles.dropMarker}>
                  <MaterialCommunityIcons name="map-marker" size={18} color="#FFFFFF" />
                </View>
              </Marker>
            )}
            {pickupCoord && dropCoord && (
              <Polyline coordinates={[pickupCoord, dropCoord]} strokeColor={colors.primary} strokeWidth={4} lineCap="round" />
            )}
          </MapView>
        ) : (
          // Web / no-native-maps fallback: a clean monochrome faux map.
          <View style={styles.mapPlaceholder}>
            <View style={styles.mapGrid} />
            <View style={styles.mapRoute} />
            <View style={styles.mapNodeStart} />
            <View style={styles.mapNodeEnd} />
            <MaterialCommunityIcons name="map-outline" size={54} color={colors.textMuted} />
            <Text style={styles.mapHint}>Map preview</Text>
            <View style={styles.centerPinContainer}>
              <View style={styles.pinShadow} />
              <View style={styles.pinCircle}>
                <View style={styles.pinInner} />
              </View>
              <View style={styles.pinTail} />
            </View>
          </View>
        )}

        <LinearGradient colors={['rgba(0,0,0,0.16)', 'transparent']} style={styles.mapTopGradient} pointerEvents="none" />

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.text} />
        </TouchableOpacity>

        {canUseNativeMap && !picking && (
          <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.85} accessibilityLabel="Recenter map">
            <MaterialCommunityIcons name="crosshairs-gps" size={20} color={colors.text} />
          </TouchableOpacity>
        )}

        {/* Tap-to-pin mode overlay */}
        {picking && (
          <>
            {/* On web / faux map there is no map onPress, so this transparent
                responder captures the tap and converts it to coordinates. */}
            {!canUseNativeMap && (
              <View
                style={StyleSheet.absoluteFill}
                onStartShouldSetResponder={() => true}
                onResponderRelease={handleMapTap}
              />
            )}
            <View pointerEvents="none" style={styles.pinPickTop}>
              <MaterialCommunityIcons name="gesture-tap" size={18} color="#fff" />
              <Text style={styles.pinPickTopText}>
                Tap the map to set your {pinTarget === 'pickup' ? 'pickup point' : 'destination'}
              </Text>
            </View>
            <View style={styles.pinPickBar}>
              <TouchableOpacity style={styles.pinPickConfirm} onPress={closePicker} activeOpacity={0.85}>
                <Text style={styles.pinPickConfirmText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Plan your ride</Text>
          <Text style={styles.sheetSubtitle}>Pick a saved place, tap the map, or pin your exact drop-off.</Text>

          <View style={styles.locationContainer}>
            <View style={styles.pathGraphic}>
              <View style={[styles.pathDot, { backgroundColor: colors.primary }]} />
              <View style={styles.pathLine} />
              <View style={[styles.pathSquare, { backgroundColor: colors.primary }]} />
            </View>

            <View style={styles.inputs}>
              <TouchableOpacity style={styles.inputWrapper} onPress={() => openPickerFor('pickup')} activeOpacity={0.7}>
                <Text style={styles.inputLabel}>PICKUP</Text>
                <Text style={styles.inputValue} numberOfLines={1}>{effectivePickup?.address || 'Tap to set pickup'}</Text>
              </TouchableOpacity>
              <View style={styles.inputDivider} />
              <TouchableOpacity style={styles.inputWrapper} onPress={() => openPickerFor('dropoff')} activeOpacity={0.7}>
                <Text style={styles.inputLabel}>DROP OFF</Text>
                <Text style={[styles.inputValue, !dropoffAddress && styles.inputMuted]} numberOfLines={1}>
                  {dropoffAddress || 'Tap to set destination'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.optionSection}>
            <Text style={styles.optionTitle}>Ride type</Text>
            <View style={styles.rideOptions}>
              {RIDE_OPTIONS.map((option) => {
                const selected = rideType === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.rideOption, selected && styles.rideOptionSelected]}
                    onPress={() => setRideType(option.id)}
                    activeOpacity={0.82}
                  >
                    <MaterialCommunityIcons
                      name={option.icon as any}
                      size={20}
                      color={selected ? colors.primary : colors.textSecondary}
                    />
                    <View style={styles.rideOptionCopy}>
                      <Text style={styles.rideOptionLabel}>{option.label}</Text>
                      <Text style={styles.rideOptionDesc}>{option.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {destinations.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.destScroll} contentContainerStyle={styles.destRow}>
              {destinations.map((place) => {
                const selected = dropoff?.address === place.name;
                return (
                  <TouchableOpacity
                    key={place.id}
                    style={[styles.destChip, selected && styles.destChipSelected]}
                    onPress={() => selectDestination(placeToLocation(place))}
                    activeOpacity={0.82}
                  >
                    <MaterialCommunityIcons
                      name={selected ? 'map-marker-check' : (place.icon as any) || 'map-marker-outline'}
                      size={16}
                      color={selected ? '#FFFFFF' : colors.primary}
                    />
                    <Text style={[styles.destChipText, selected && styles.destChipTextSelected]}>{place.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.tapHint}>
              <MaterialCommunityIcons name="gesture-tap" size={16} color={colors.textMuted} />
              <Text style={styles.tapHintText}>Use “Set destination on map” below to drop your pin.</Text>
            </View>
          )}

          <TouchableOpacity style={styles.pinMapBtn} onPress={() => openPickerFor('dropoff')} activeOpacity={0.85}>
            <MaterialCommunityIcons name="map-marker-radius" size={18} color={colors.primary} />
            <Text style={styles.pinMapText}>{dropoff ? 'Change destination on map' : 'Set destination on map'}</Text>
          </TouchableOpacity>

          <View style={styles.tripControls}>
            <View style={styles.passengerStepper}>
              <Text style={styles.controlLabel}>Passengers</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setPassengers(Math.max(1, passengers - 1))}
                  activeOpacity={0.76}
                >
                  <MaterialCommunityIcons name="minus" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.passengerCount}>{passengers}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setPassengers(Math.min(4, passengers + 1))}
                  activeOpacity={0.76}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.paymentGroup}>
              <Text style={styles.controlLabel}>Payment</Text>
              <View style={styles.paymentRow}>
                {(['cash', 'gcash'] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[styles.paymentPill, paymentMethod === method && styles.paymentPillActive]}
                    onPress={() => setPaymentMethod(method)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.paymentText, paymentMethod === method && styles.paymentTextActive]}>
                      {method === 'cash' ? 'Cash' : 'GCash'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.noteBox}>
            <MaterialCommunityIcons name="text-box-edit-outline" size={18} color={colors.textMuted} />
            <RNTextInput
              value={tripNote}
              onChangeText={setTripNote}
              placeholder="Pickup note, landmark, or gate number"
              placeholderTextColor={colors.textMuted}
              style={styles.noteInput}
            />
          </View>

          {/* Book on behalf of another passenger */}
          <TouchableOpacity style={styles.forOtherToggle} onPress={() => setBookForOther((v) => !v)} activeOpacity={0.8}>
            <MaterialCommunityIcons
              name={bookForOther ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={bookForOther ? colors.primary : colors.textMuted}
            />
            <Text style={styles.forOtherText}>I'm booking this ride for someone else</Text>
          </TouchableOpacity>
          {bookForOther && (
            <View style={styles.forOtherFields}>
              <RNTextInput
                style={styles.forOtherInput}
                value={otherName}
                onChangeText={setOtherName}
                placeholder="Passenger's name"
                placeholderTextColor={colors.textMuted}
              />
              <RNTextInput
                style={styles.forOtherInput}
                value={otherPhone}
                onChangeText={setOtherPhone}
                placeholder="Passenger's phone (optional)"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          )}

          <Surface style={styles.fareCard} elevation={0}>
            <View style={styles.fareInfo}>
              <View style={styles.fareIconBox}>
                <MaterialCommunityIcons name="rickshaw" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.fareCopy}>
                <Text style={styles.fareType}>{rideType === 'priority' ? 'Priority Tricycle' : 'Standard Tricycle'}</Text>
                <Text style={styles.fareEta}>
                  {estimate
                    ? `${estimate.distance.toFixed(1)} km • ${estimate.eta} min • ${passengers} passenger${passengers > 1 ? 's' : ''}`
                    : 'Destination required'}
                </Text>
              </View>
            </View>
            <Text style={[styles.farePrice, typography.currency]}>{estimate ? `₱${estimate.fare.toFixed(2)}` : '—'}</Text>
          </Surface>

          <Button
            variant="primary"
            onPress={handleBooking}
            disabled={!dropoff || loading}
            loading={loading}
          >
            {dropoff ? `Confirm ${rideType === 'priority' ? 'Priority' : 'Standard'} Trip` : 'Choose a destination'}
          </Button>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    position: 'relative',
  },
  mapTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 1,
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mapGrid: {
    position: 'absolute',
    width: '130%',
    height: '130%',
    backgroundColor: colors.surfaceHover,
    opacity: 0.6,
    transform: [{ rotate: '-8deg' }],
  },
  mapRoute: {
    position: 'absolute',
    width: 190,
    height: 84,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderColor: colors.primary,
    borderBottomLeftRadius: 42,
    opacity: 0.3,
    transform: [{ rotate: '-14deg' }],
  },
  mapNodeStart: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    top: '42%',
    left: '28%',
  },
  mapNodeEnd: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    bottom: '36%',
    right: '28%',
  },
  mapHint: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  // Native map markers
  pickupMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  pickupMarkerCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  dropMarker: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadows.md,
  },
  backBtn: {
    position: 'absolute',
    top: layout.headerTop - 10,
    left: 20,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  recenterBtn: {
    position: 'absolute',
    right: 20,
    bottom: '4%',
    zIndex: 2,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  centerPinContainer: {
    position: 'absolute',
    top: '43%',
    alignItems: 'center',
  },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  pinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  pinTail: {
    width: 4,
    height: 16,
    backgroundColor: colors.primary,
    marginTop: -3,
    borderRadius: radius.pill,
  },
  pinShadow: {
    width: 18,
    height: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginBottom: -2,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    ...shadows.xl,
  },
  sheetContent: {
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.text,
  },
  sheetSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  locationContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pathGraphic: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginRight: spacing.md,
  },
  pathDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  pathSquare: {
    width: 11,
    height: 11,
    borderRadius: 3,
  },
  pathLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  inputs: {
    flex: 1,
  },
  inputWrapper: {
    minHeight: 42,
    justifyContent: 'center',
  },
  inputLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  inputValue: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 15,
  },
  inputMuted: {
    color: colors.textMuted,
  },
  inputDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  destScroll: {
    marginBottom: spacing.md,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  tapHintText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  pinMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.md,
  },
  pinMapText: { ...typography.label, color: colors.primary, fontSize: 14 },
  // Pin-picker overlay
  pinPickFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    // lift the marker tip to the exact centre
    marginTop: -23,
  },
  pinPickTop: {
    position: 'absolute',
    top: layout.headerTop + 30,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: 'rgba(13,27,42,0.85)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPickTopText: { ...typography.label, color: '#fff', fontSize: 13, textAlign: 'center' },
  pinPickBar: {
    position: 'absolute',
    bottom: 28,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pinPickCancel: {
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  pinPickCancelText: { ...typography.button, color: colors.text, fontSize: 14 },
  pinPickConfirm: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  pinPickConfirmText: { ...typography.button, color: '#fff', fontSize: 15 },
  // Book for someone else
  forOtherToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  forOtherText: { ...typography.label, color: colors.text, fontSize: 14 },
  forOtherFields: { gap: spacing.sm, marginBottom: spacing.md },
  forOtherInput: {
    ...typography.body,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  destRow: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  destChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  destChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  destChipText: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
  },
  destChipTextSelected: {
    color: '#FFFFFF',
  },
  fareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  fareInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
  },
  fareIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  fareCopy: {
    flex: 1,
  },
  fareType: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 16,
  },
  fareEta: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  farePrice: {
    ...typography.number,
    color: colors.text,
    fontSize: 22,
  },
  optionSection: {
    marginBottom: spacing.md,
  },
  optionTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  rideOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rideOption: {
    flex: 1,
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  rideOptionSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.surfaceAlt,
  },
  rideOptionCopy: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  rideOptionLabel: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 13,
  },
  rideOptionDesc: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  tripControls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  passengerStepper: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
  },
  paymentGroup: {
    flex: 1.2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
  },
  controlLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerCount: {
    ...typography.number,
    color: colors.text,
    fontSize: 18,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  paymentPill: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  paymentText: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 12,
  },
  paymentTextActive: {
    color: '#FFFFFF',
  },
  noteBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  noteInput: {
    ...typography.body,
    flex: 1,
    color: colors.text,
    fontSize: 14,
    marginLeft: spacing.sm,
    minHeight: 44,
  },
});

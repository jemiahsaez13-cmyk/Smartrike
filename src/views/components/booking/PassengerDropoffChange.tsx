import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Booking, BookingRouteChange, Location, SavedAddress } from '@/models/types';
import { PopularPlace } from '@/config/constants';
import { RouteChangeService } from '@/models/services/RouteChangeService';
import { PopularPlaceService } from '@/models/services/PopularPlaceService';
import { GeocodingService } from '@/models/services/GeocodingService';
import { AddressRepository } from '@/models/repositories/AddressRepository';
import { useLocation } from '@/controllers/hooks/useLocation';
import { LocationChooser } from '@/views/screens/passenger/LocationChooser';
import { MapPinPicker } from '@/views/components/location/MapPinPicker';
import { Button } from '@/views/components/common/Button';
import { confirm, notify } from '@/utils/confirm';
import { formatDistance } from '@/utils/locationUtils';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

const placeService = new PopularPlaceService();
const geo = new GeocodingService();
const addressRepo = new AddressRepository();

const MODAL_GAP_MS = 350;
const peso = (n: number | null | undefined) => `₱${Number(n ?? 0).toFixed(2)}`;

interface Props {
  booking: Booking;
  /** Driver's live position: during the ride the distance goes through it. */
  driverPosition?: { latitude: number; longitude: number } | null;
  /** A payment was sent, so the fare can no longer change. */
  locked?: boolean;
  /** Reload the booking after the driver accepted. */
  onAccepted?: () => void;
}

/**
 * D7: "Change drop-off" for the passenger while the driver is on the way or
 * during the ride. The request waits for the driver; only an accepted request
 * changes the booking's drop-off and fare.
 */
export const PassengerDropoffChange = ({ booking, driverPosition, locked, onAccepted }: Props) => {
  const { currentLocation, getLocation } = useLocation();
  const [changes, setChanges] = useState<BookingRouteChange[]>([]);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [places, setPlaces] = useState<PopularPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const seen = useRef<Map<string, string>>(new Map());
  const firstLoad = useRef(true);
  const onAcceptedRef = useRef(onAccepted);
  onAcceptedRef.current = onAccepted;

  const active = booking.status === 'accepted' || booking.status === 'in-transit';

  // Live requests; tell the passenger when the driver answers.
  useEffect(() => {
    if (!booking.id) return;
    seen.current = new Map();
    firstLoad.current = true;
    const watcher = RouteChangeService.watch(booking.id, (rows) => {
      setChanges(rows);
      for (const row of rows) {
        const before = seen.current.get(row.id);
        if (!firstLoad.current && before === 'pending' && row.status !== 'pending') {
          if (row.status === 'accepted') {
            onAcceptedRef.current?.();
            void notify('Drop-off changed', `Your driver accepted. New drop-off: ${row.new_dropoff_location?.address || 'pinned on the map'}. New fare ${peso(row.new_total_fare)}.`);
          } else if (row.status === 'declined') {
            void notify('Drop-off change declined', `Your driver kept the original drop-off${row.decline_reason ? ` (${row.decline_reason})` : ''}.`);
          }
        }
        seen.current.set(row.id, row.status);
      }
      firstLoad.current = false;
    });
    return () => watcher.stop();
  }, [booking.id]);

  const pending = changes.find((c) => c.status === 'pending') ?? null;
  const lastDecided = changes.find((c) => c.status === 'accepted' || c.status === 'declined') ?? null;

  if (!active) return null;

  const open = () => {
    void getLocation().catch(() => undefined);
    if (booking.passenger_id) addressRepo.listByUser(booking.passenger_id).then(setSavedAddresses).catch(() => undefined);
    placeService.listActive().then(setPlaces).catch(() => undefined);
    setChooserOpen(true);
  };

  const resolveSaved = async (addr: SavedAddress): Promise<Location | null> => {
    if (addr.latitude != null && addr.longitude != null) {
      return { latitude: addr.latitude, longitude: addr.longitude, address: addr.full_address };
    }
    void notify('Pin required', 'Edit this saved address and confirm its exact location on the map before using it.');
    return null;
  };

  const send = async (loc: Location) => {
    setBusy(true);
    try {
      const quote = await RouteChangeService.quote(booking, loc, driverPosition);
      const diff = quote.totalFare - Number(booking.total_fare ?? 0);
      const ok = await confirm(
        'Change drop-off?',
        `New drop-off: ${loc.address}\n` +
          `Trip: about ${formatDistance(quote.distanceKm)}${quote.via ? ' (from your pickup, through where you are now)' : ''}\n` +
          `Fare: ${peso(booking.total_fare)} → about ${peso(quote.totalFare)} (${diff >= 0 ? '+' : '−'}${peso(Math.abs(diff))})\n\n` +
          'Your driver has to accept it. Until then your drop-off and fare stay the same.',
        { confirmText: 'Send to driver', cancelText: 'Not now' }
      );
      if (!ok) return;
      const change = await RouteChangeService.request(booking.id, loc, quote.distanceKm);
      seen.current.set(change.id, 'pending');
      setChanges((rows) => [change, ...rows.filter((r) => r.id !== change.id)]);
    } catch (error: any) {
      void notify('Drop-off not changed', error?.message || 'The request could not be sent. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!pending) return;
    const ok = await confirm('Withdraw request?', 'Your drop-off stays as it is now.', { confirmText: 'Withdraw', cancelText: 'Keep waiting' });
    if (!ok) return;
    setBusy(true);
    try {
      const row = await RouteChangeService.cancel(pending.id);
      seen.current.set(row.id, row.status);
      setChanges((rows) => rows.map((r) => (r.id === row.id ? row : r)));
    } catch (error: any) {
      void notify('Not withdrawn', error?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmPin = async () => {
    if (!pin) return;
    setPinOpen(false);
    await new Promise((resolve) => setTimeout(resolve, MODAL_GAP_MS));
    const address = await geo.reverseGeocode(pin.latitude, pin.longitude).catch(() => 'Pinned destination');
    await send({ latitude: pin.latitude, longitude: pin.longitude, address: address || 'Pinned destination' });
  };

  return (
    <>
      {pending ? (
        <View style={styles.pendingCard} accessibilityLiveRegion="polite">
          <View style={styles.pendingHead}>
            <ActivityIndicator size={14} color={colors.warning} />
            <Text style={styles.pendingTitle}>Waiting for your driver to accept</Text>
          </View>
          <Text style={styles.pendingLine} numberOfLines={2}>New drop-off: {pending.new_dropoff_location?.address || 'Pinned on the map'}</Text>
          <Text style={styles.pendingLine}>
            New fare {peso(pending.new_total_fare)} (now {peso(pending.old_total_fare)}) · {formatDistance(Number(pending.new_distance))}
          </Text>
          <TouchableOpacity onPress={withdraw} disabled={busy} style={styles.withdrawBtn} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.withdrawText}>Withdraw request</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {lastDecided?.status === 'declined' && (
            <Text style={styles.declinedNote}>
              Driver declined your last change{lastDecided.decline_reason ? `: ${lastDecided.decline_reason}` : ''}.
            </Text>
          )}
          {lastDecided?.status === 'accepted' && (
            <Text style={styles.changedNote} numberOfLines={1}>
              Drop-off changed from {lastDecided.old_dropoff_location?.address || 'the original place'}
            </Text>
          )}
          {!locked && (
            <Button
              variant="outline"
              icon="map-marker-path"
              onPress={open}
              loading={busy}
              disabled={busy}
              style={styles.changeBtn}
            >
              Change drop-off
            </Button>
          )}
        </>
      )}

      <LocationChooser
        visible={chooserOpen}
        target="dropoff"
        currentLocation={currentLocation}
        savedAddresses={savedAddresses}
        popularPlaces={places}
        onClose={() => setChooserOpen(false)}
        // Let the chooser finish closing before the next dialog opens (iOS
        // drops a modal presented while another one is dismissing).
        onConfirm={(loc) => { setChooserOpen(false); setTimeout(() => { void send(loc); }, MODAL_GAP_MS); }}
        resolveSaved={resolveSaved}
        onSetOnMap={() => {
          setChooserOpen(false);
          setPin(null);
          setTimeout(() => setPinOpen(true), MODAL_GAP_MS);
        }}
      />

      <Modal visible={pinOpen} animationType="slide" onRequestClose={() => setPinOpen(false)}>
        <View style={styles.pinContainer}>
          <View style={styles.pinHeader}>
            <TouchableOpacity style={styles.pinHeaderBtn} onPress={() => setPinOpen(false)} activeOpacity={0.7} accessibilityLabel="Close">
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.pinTitle}>Pin the new drop-off</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.pinBody} keyboardShouldPersistTaps="handled">
            <MapPinPicker
              value={pin}
              onChange={setPin}
              initialCenter={{ latitude: booking.dropoff_location.latitude, longitude: booking.dropoff_location.longitude }}
              height={340}
            />
          </ScrollView>
          <View style={styles.pinFooter}>
            <Button variant="primary" icon="check" onPress={confirmPin} disabled={!pin}>
              Use this drop-off
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  changeBtn: { borderRadius: 14, marginBottom: spacing.md },
  pendingCard: {
    backgroundColor: colors.warningLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 4,
  },
  pendingHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  pendingTitle: { ...typography.label, fontSize: 13, color: colors.text, flex: 1 },
  pendingLine: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  withdrawBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginTop: 2 },
  withdrawText: { ...typography.label, fontSize: 13, color: colors.error },
  declinedNote: { ...typography.bodySmall, fontSize: 12, color: colors.error, marginBottom: spacing.sm },
  changedNote: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  pinContainer: { flex: 1, backgroundColor: colors.background },
  pinHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingRight: spacing.screen, paddingTop: layout.headerTop,
    paddingBottom: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  pinHeaderBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  pinTitle: { ...typography.h3, fontSize: 18 },
  pinBody: { padding: spacing.screen },
  pinFooter: {
    paddingHorizontal: spacing.screen, paddingTop: spacing.md, paddingBottom: spacing.xl,
    borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.surface,
  },
});

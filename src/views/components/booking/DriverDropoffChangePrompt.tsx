import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Booking, BookingRouteChange } from '@/models/types';
import { RouteChangeService } from '@/models/services/RouteChangeService';
import { Button } from '@/views/components/common/Button';
import { notify } from '@/utils/confirm';
import { formatDistance } from '@/utils/locationUtils';
import { colors, radius, shadows, spacing, typography } from '@/views/styles/theme';

const DECLINE_REASONS = ['Too far', 'Outside the service area', 'Not enough fuel / time', 'Road not passable'];
const peso = (n: number | null | undefined) => `₱${Number(n ?? 0).toFixed(2)}`;

interface Props {
  booking: Booking;
  /** The booking after the driver accepted (new drop-off, distance and fare). */
  onBookingChanged: (booking: Booking) => void;
}

/**
 * D7: the passenger asked for a new drop-off. Shows the new destination and
 * fare with Accept / Decline. Pops up as soon as the request arrives (realtime,
 * with polling as fallback); "Later" folds it into a banner on the trip panel.
 */
export const DriverDropoffChangePrompt = ({ booking, onBookingChanged }: Props) => {
  const [pending, setPending] = useState<BookingRouteChange | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const shownFor = useRef<string | null>(null);
  const pendingId = useRef<string | null>(null);

  useEffect(() => {
    if (!booking.id) return;
    shownFor.current = null;
    pendingId.current = null;
    const watcher = RouteChangeService.watch(booking.id, (rows) => {
      const next = rows.find((r) => r.status === 'pending') ?? null;
      const prevId = pendingId.current;
      if (prevId && prevId !== next?.id) {
        setOpen(false);
        const gone = rows.find((r) => r.id === prevId);
        if (gone?.status === 'cancelled') void notify('Request withdrawn', 'The passenger kept the original drop-off.');
      }
      pendingId.current = next?.id ?? null;
      setPending(next);
      if (next && shownFor.current !== next.id) {
        shownFor.current = next.id;
        setReason(null);
        setDeclining(false);
        setOpen(true);
      }
    });
    return () => watcher.stop();
  }, [booking.id]);

  if (!pending) return null;

  const answer = async (accept: boolean) => {
    setBusy(accept ? 'accept' : 'decline');
    try {
      const updated = await RouteChangeService.respond(pending.id, accept, accept ? null : reason);
      setOpen(false);
      setPending(null);
      pendingId.current = null;
      if (accept) {
        onBookingChanged(updated);
        void notify('Drop-off changed', `Head to ${updated.dropoff_location?.address || 'the new drop-off'}. Fare is now ${peso(updated.total_fare)}.`);
      }
    } catch (error: any) {
      void notify(accept ? 'Not accepted' : 'Not declined', error?.message || 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const fareUp = Number(pending.new_total_fare) - Number(booking.total_fare ?? pending.old_total_fare);

  return (
    <>
      <TouchableOpacity style={styles.banner} onPress={() => setOpen(true)} activeOpacity={0.85} accessibilityRole="button">
        <MaterialCommunityIcons name="map-marker-path" size={20} color="#fff" />
        <Text style={styles.bannerText} numberOfLines={2}>
          Passenger wants a new drop-off · {peso(pending.new_total_fare)}. Tap to answer.
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="map-marker-path" size={34} color={colors.primary} />
            </View>
            <Text style={styles.title}>New drop-off requested</Text>
            <Text style={styles.subtitle}>The passenger wants to go somewhere else.</Text>

            <View style={styles.routeBox}>
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                <Text style={[styles.routeText, styles.oldText]} numberOfLines={1}>
                  {pending.old_dropoff_location?.address || 'Original drop-off'}
                </Text>
              </View>
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                <Text style={styles.routeText} numberOfLines={2}>
                  {pending.new_dropoff_location?.address || 'Pinned on the map'}
                </Text>
              </View>
            </View>

            <View style={styles.fareRow}>
              <View style={styles.fareItem}>
                <Text style={styles.fareOld}>{peso(booking.total_fare ?? pending.old_total_fare)}</Text>
                <Text style={styles.fareNew}>{peso(pending.new_total_fare)}</Text>
                <Text style={styles.fareLabel}>NEW FARE{fareUp !== 0 ? ` (${fareUp > 0 ? '+' : '−'}${peso(Math.abs(fareUp))})` : ''}</Text>
              </View>
              <View style={styles.fareDivider} />
              <View style={styles.fareItem}>
                <Text style={styles.fareNew}>{formatDistance(Number(pending.new_distance))}</Text>
                <Text style={styles.fareLabel}>{pending.via_location ? 'WHOLE TRIP' : 'TRIP'}</Text>
              </View>
            </View>
            {pending.via_location ? (
              <Text style={styles.hint}>Distance is from the pickup, through where you are now, to the new drop-off.</Text>
            ) : null}

            {declining ? (
              <>
                <Text style={styles.reasonTitle}>Reason (optional)</Text>
                <View style={styles.reasonWrap}>
                  {DECLINE_REASONS.map((r) => {
                    const active = reason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setReason(active ? null : r)}
                        style={[styles.reasonChip, active && styles.reasonChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.reasonChipText, active && styles.reasonChipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Button variant="danger" onPress={() => answer(false)} loading={busy === 'decline'} disabled={!!busy} style={styles.fullBtn}>
                  Decline, keep original drop-off
                </Button>
                <TouchableOpacity onPress={() => setDeclining(false)} style={styles.linkBtn} activeOpacity={0.7}>
                  <Text style={styles.linkText}>Back</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Button variant="primary" icon="check" onPress={() => answer(true)} loading={busy === 'accept'} disabled={!!busy} style={styles.fullBtn}>
                  Accept new drop-off
                </Button>
                <Button variant="outline" onPress={() => setDeclining(true)} disabled={!!busy} style={styles.fullBtn}>
                  Decline
                </Button>
                <TouchableOpacity onPress={() => setOpen(false)} style={styles.linkBtn} activeOpacity={0.7}>
                  <Text style={styles.linkText}>Later</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warning,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: 16,
    ...shadows.sm,
  },
  bannerText: { ...typography.label, fontSize: 13, color: '#fff', flex: 1 },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.screen },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: spacing.xl, alignItems: 'center', ...shadows.xl },
  iconWrap: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  title: { ...typography.title, fontSize: 20, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: spacing.md },
  routeBox: { width: '100%', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: 10, marginBottom: spacing.md },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { ...typography.body, fontSize: 14, color: colors.text, flex: 1 },
  oldText: { color: colors.textMuted, textDecorationLine: 'line-through' },
  fareRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: spacing.sm },
  fareItem: { flex: 1, alignItems: 'center' },
  fareOld: { ...typography.bodySmall, fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
  fareNew: { ...typography.h3, fontSize: 18, color: colors.text },
  fareLabel: { ...typography.label, color: colors.textMuted, fontSize: 10, letterSpacing: 1, marginTop: 2, textAlign: 'center' },
  fareDivider: { width: 1, height: 36, backgroundColor: colors.borderLight },
  hint: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  reasonTitle: { ...typography.label, fontSize: 13, color: colors.text, alignSelf: 'flex-start', marginBottom: spacing.sm, marginTop: spacing.xs },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md, justifyContent: 'center' },
  reasonChip: {
    paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.borderLight, justifyContent: 'center', alignItems: 'center',
  },
  reasonChipActive: { backgroundColor: colors.errorLight, borderColor: colors.error },
  reasonChipText: { ...typography.label, fontSize: 12, color: colors.textSecondary },
  reasonChipTextActive: { color: colors.error },
  fullBtn: { width: '100%', marginTop: spacing.sm },
  linkBtn: { paddingVertical: spacing.sm, marginTop: spacing.xs },
  linkText: { ...typography.body, fontSize: 14, color: colors.textSecondary },
});

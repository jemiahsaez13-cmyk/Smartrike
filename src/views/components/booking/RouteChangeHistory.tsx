import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BookingRouteChange, BookingRouteChangeStatus } from '@/models/types';
import { RouteChangeService } from '@/models/services/RouteChangeService';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const STATUS: Record<BookingRouteChangeStatus, { label: string; color: string }> = {
  pending: { label: 'Waiting for driver', color: colors.warning },
  accepted: { label: 'Accepted', color: colors.success },
  declined: { label: 'Declined', color: colors.error },
  cancelled: { label: 'Withdrawn', color: colors.textMuted },
  expired: { label: 'Expired', color: colors.textMuted },
};

const peso = (n: number | null | undefined) => `₱${Number(n ?? 0).toFixed(2)}`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

/**
 * Audit of the passenger's drop-off change requests on one ride (D7): the
 * original drop-off and fare next to the requested ones, and the outcome.
 * Renders nothing when the ride had none.
 */
export const RouteChangeHistory = ({ bookingId }: { bookingId: string }) => {
  const [rows, setRows] = useState<BookingRouteChange[]>([]);

  useEffect(() => {
    let active = true;
    RouteChangeService.list(bookingId)
      .then((r) => { if (active) setRows(r); })
      .catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [bookingId]);

  if (rows.length === 0) return null;

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <MaterialCommunityIcons name="map-marker-path" size={14} color={colors.textMuted} />
        <Text style={styles.title}>Drop-off changes ({rows.length})</Text>
      </View>
      {rows.map((c) => {
        const meta = STATUS[c.status] ?? STATUS.expired;
        return (
          <View key={c.id} style={styles.row}>
            <Text style={styles.line} numberOfLines={2}>
              {c.old_dropoff_location?.address || 'Original'} → {c.new_dropoff_location?.address || 'Pinned on the map'}
            </Text>
            <Text style={styles.meta}>
              {peso(c.old_total_fare)} → {peso(c.new_total_fare)} · {Number(c.new_distance).toFixed(1)} km · {when(c.requested_at)}
            </Text>
            <Text style={[styles.status, { color: meta.color }]}>
              {meta.label}{c.decline_reason ? `: ${c.decline_reason}` : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs, gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...typography.label, fontSize: 12, color: colors.textSecondary },
  row: { paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderLight },
  line: { ...typography.bodySmall, fontSize: 12, color: colors.text },
  meta: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  status: { ...typography.label, fontSize: 11, marginTop: 1 },
});

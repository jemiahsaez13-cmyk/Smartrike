import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '@/config/supabase';
import { Booking, BookingStatus } from '@/models/types';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminBooking extends Booking {
  passenger_name?: string;
  driver_name?: string;
}

type Filter = 'all' | BookingStatus;

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all',        label: 'All' },
  { key: 'pending',    label: 'Pending' },
  { key: 'accepted',   label: 'Accepted' },
  { key: 'in-transit', label: 'In Transit' },
  { key: 'completed',  label: 'Completed' },
  { key: 'cancelled',  label: 'Cancelled' },
];

const STATUS_META: Record<BookingStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:     { label: 'Pending',    color: colors.warning,     bg: colors.warningLight,  icon: 'clock-outline' },
  accepted:    { label: 'Accepted',   color: colors.info,        bg: colors.infoLight,     icon: 'account-check-outline' },
  'in-transit':{ label: 'In Transit', color: colors.primary,     bg: colors.primaryLight,  icon: 'car-arrow-right' },
  completed:   { label: 'Completed',  color: colors.success,     bg: colors.successLight,  icon: 'check-circle-outline' },
  cancelled:   { label: 'Cancelled',  color: colors.error,       bg: colors.errorLight,    icon: 'close-circle-outline' },
};

const PAYMENT_ICON: Record<string, string> = {
  cash:     'cash',
  gcash:    'cellphone',
  paymaya:  'credit-card-outline',
  online:   'bank-transfer',
};

const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

const formatDate = (iso: any) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const addr = (loc: any): string =>
  loc && typeof loc === 'object' ? loc.address || 'Unknown' : 'Unknown';

// ─── Service (inline — read-only admin query) ─────────────────────────────────

async function fetchAllBookings(): Promise<AdminBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  const rows = (data ?? []) as AdminBooking[];

  // Resolve passenger and driver names in one batch query.
  const userIds = [
    ...new Set([
      ...rows.map((r) => r.passenger_id),
      ...rows.map((r) => r.driver_id).filter(Boolean),
    ]),
  ] as string[];

  if (userIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);
    const names = new Map<string, string>(
      (users ?? []).map((u: any) => [u.id, u.name])
    );
    rows.forEach((r) => {
      r.passenger_name = names.get(r.passenger_id) ?? 'Passenger';
      r.driver_name = r.driver_id ? (names.get(r.driver_id) ?? 'Driver') : undefined;
    });
  }
  return rows;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export const BookingMonitoringScreen = () => {
  const navigation = useNavigation<any>();

  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setBookings(await fetchAllBookings());
    } catch (e: any) {
      console.error('BookingMonitoring load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  // ── Derived ──────────────────────────────────────────────────────────────
  const counts: Record<Filter, number> = {
    all:          bookings.length,
    pending:      bookings.filter((b) => b.status === 'pending').length,
    accepted:     bookings.filter((b) => b.status === 'accepted').length,
    'in-transit': bookings.filter((b) => b.status === 'in-transit').length,
    completed:    bookings.filter((b) => b.status === 'completed').length,
    cancelled:    bookings.filter((b) => b.status === 'cancelled').length,
  };

  const lowerSearch = search.toLowerCase().trim();
  const displayed = bookings.filter((b) => {
    if (filter !== 'all' && b.status !== filter) return false;
    if (!lowerSearch) return true;
    return (
      b.passenger_name?.toLowerCase().includes(lowerSearch) ||
      b.driver_name?.toLowerCase().includes(lowerSearch) ||
      addr(b.pickup_location).toLowerCase().includes(lowerSearch) ||
      addr(b.dropoff_location).toLowerCase().includes(lowerSearch) ||
      b.id.toLowerCase().includes(lowerSearch)
    );
  });

  // ── Stats cards ───────────────────────────────────────────────────────────
  const activeCount = counts.pending + counts.accepted + counts['in-transit'];
  const completedCount = counts.completed;
  const cancelledCount = counts.cancelled;
  const totalRevenue = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.total_fare), 0);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Booking Monitor</Text>
          <Text style={styles.headerSub}>All trips · read-only admin view</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Summary stats */}
        <View style={styles.statsRow}>
          <StatBox
            icon="car-clock"
            label="Active"
            value={activeCount}
            color={colors.primary}
            bg={colors.primaryLight}
          />
          <StatBox
            icon="check-circle"
            label="Completed"
            value={completedCount}
            color={colors.success}
            bg={colors.successLight}
          />
          <StatBox
            icon="close-circle"
            label="Cancelled"
            value={cancelledCount}
            color={colors.error}
            bg={colors.errorLight}
          />
        </View>

        {/* Total revenue */}
        <Card variant="elevated" padding="md" style={styles.revenueCard}>
          <View style={styles.revenueRow}>
            <View style={styles.revenueIcon}>
              <MaterialCommunityIcons name="cash-multiple" size={22} color={colors.primary} />
            </View>
            <View style={styles.revenueCopy}>
              <Text style={styles.revenueLabel}>VERIFIED TRIP REVENUE</Text>
              <Text style={[styles.revenueAmount, typography.currency]}>{peso(totalRevenue)}</Text>
            </View>
            <Text style={styles.revenueCount}>{bookings.length} total</Text>
          </View>
        </Card>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search passenger, driver, or address…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                    {counts[key]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.resultCount}>
          SHOWING {displayed.length} OF {bookings.length} BOOKINGS
        </Text>

        {/* Booking list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="car-search-outline" size={52} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No bookings found</Text>
            <Text style={styles.emptyText}>
              {search ? 'Try a different keyword.' : 'No bookings for this status yet.'}
            </Text>
          </View>
        ) : (
          displayed.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              expanded={expanded === booking.id}
              onToggle={() =>
                setExpanded((prev) => (prev === booking.id ? null : booking.id))
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const StatBox = ({
  icon, label, value, color, bg,
}: { icon: string; label: string; value: number; color: string; bg: string }) => (
  <View style={[styles.statBox, { backgroundColor: bg }]}>
    <MaterialCommunityIcons name={icon as any} size={20} color={color} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={[styles.statLabel, { color }]}>{label}</Text>
  </View>
);

interface BookingCardProps {
  booking: AdminBooking;
  expanded: boolean;
  onToggle: () => void;
}

const BookingCard = ({ booking: b, expanded, onToggle }: BookingCardProps) => {
  const meta = STATUS_META[b.status];
  return (
    <Card variant="elevated" padding="md" style={styles.card}>
      {/* ── Header row ── */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={onToggle}
        activeOpacity={0.75}
      >
        <View style={[styles.cardAvatar, { backgroundColor: meta.bg }]}>
          <MaterialCommunityIcons name={meta.icon as any} size={20} color={meta.color} />
        </View>
        <View style={styles.cardNames}>
          <Text style={styles.passengerName} numberOfLines={1}>
            {b.passenger_name ?? 'Passenger'}
          </Text>
          <Text style={styles.driverLine} numberOfLines={1}>
            {b.driver_name ? `Driver: ${b.driver_name}` : 'No driver assigned'}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>
              {meta.label.toUpperCase()}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textLight}
            style={{ marginTop: 6 }}
          />
        </View>
      </TouchableOpacity>

      {/* ── Route summary (always visible) ── */}
      <View style={styles.routeRow}>
        <View style={styles.routeDot} />
        <Text style={styles.routeAddr} numberOfLines={1}>
          {addr(b.pickup_location)}
        </Text>
      </View>
      <View style={[styles.routeRow, { marginBottom: 0 }]}>
        <MaterialCommunityIcons name="map-marker" size={14} color={colors.error} />
        <Text style={styles.routeAddr} numberOfLines={1}>
          {addr(b.dropoff_location)}
        </Text>
      </View>

      {/* ── Expanded detail ── */}
      {expanded && (
        <View style={styles.detail}>
          <View style={styles.detailDivider} />

          <DetailRow label="Booking ID" value={b.id.slice(0, 12).toUpperCase() + '…'} />
          <DetailRow label="Created" value={formatDate(b.created_at)} />
          {b.accepted_at   && <DetailRow label="Accepted"   value={formatDate(b.accepted_at)} />}
          {b.started_at    && <DetailRow label="Started"    value={formatDate(b.started_at)} />}
          {b.completed_at  && <DetailRow label="Completed"  value={formatDate(b.completed_at)} />}

          <View style={styles.detailDivider} />

          <View style={styles.fareRow}>
            <Text style={styles.fareAmount}>{peso(b.total_fare)}</Text>
            <View style={styles.paymentBadge}>
              <MaterialCommunityIcons
                name={(PAYMENT_ICON[b.payment_method] ?? 'cash') as any}
                size={13}
                color={colors.textSecondary}
              />
              <Text style={styles.paymentText}>{b.payment_method.toUpperCase()}</Text>
              <View
                style={[
                  styles.paymentStatusDot,
                  { backgroundColor: b.payment_status === 'completed' ? colors.success : colors.warning },
                ]}
              />
              <Text style={[styles.paymentText, { color: b.payment_status === 'completed' ? colors.success : colors.warning }]}>
                {b.payment_status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.tripMetaRow}>
            <MetaChip icon="map-marker-distance" label={`${Number(b.distance).toFixed(1)} km`} />
            <MetaChip icon="account-group-outline" label={`${b.passenger_count} pax`} />
            <MetaChip icon="star-outline" label={b.ride_type} />
          </View>

          {b.notes ? (
            <View style={styles.notesBox}>
              <MaterialCommunityIcons name="note-text-outline" size={14} color={colors.textMuted} />
              <Text style={styles.notesText}>{b.notes}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const MetaChip = ({ icon, label }: { icon: string; label: string }) => (
  <View style={styles.metaChip}>
    <MaterialCommunityIcons name={icon as any} size={13} color={colors.textSecondary} />
    <Text style={styles.metaChipText}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    paddingRight: spacing.screen,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { ...typography.h2, fontSize: 22 },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 1 },

  scrollContent: { paddingBottom: 100 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: 4,
  },
  statValue: { fontSize: 24, fontWeight: '800', fontFamily: 'Poppins_700Bold' },
  statLabel: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Revenue
  revenueCard: { marginHorizontal: spacing.screen, marginBottom: spacing.sm },
  revenueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  revenueIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  revenueCopy: { flex: 1 },
  revenueLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  revenueAmount: {
    ...typography.h2,
    fontSize: 22,
    color: colors.text,
    marginTop: 2,
  },
  revenueCount: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11 },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },

  // Filters
  filterScroll: { marginTop: spacing.sm },
  filterContent: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  chipBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipBadgeText: { ...typography.labelSmall, fontSize: 10, fontWeight: '800', color: colors.textSecondary },
  chipBadgeTextActive: { color: '#fff' },

  resultCount: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  // Booking card
  card: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardAvatar: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cardNames: { flex: 1, minWidth: 0 },
  passengerName: { ...typography.label, fontSize: 15, color: colors.text },
  driverLine: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 2 },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.sm,
  },
  statusText: { ...typography.labelSmall, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // Route
  routeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 4,
  },
  routeDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 3,
  },
  routeAddr: {
    ...typography.bodySmall, fontSize: 12,
    color: colors.textSecondary, flex: 1,
  },

  // Expanded detail
  detail: { marginTop: spacing.sm },
  detailDivider: {
    height: 1, backgroundColor: colors.borderLight,
    marginVertical: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: { ...typography.labelSmall, color: colors.textMuted, fontSize: 11 },
  detailValue: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11 },

  fareRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.sm,
  },
  fareAmount: { ...typography.h2, fontSize: 26, color: colors.primary },
  paymentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.md,
  },
  paymentText: { ...typography.labelSmall, fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  paymentStatusDot: { width: 6, height: 6, borderRadius: 3 },

  tripMetaRow: {
    flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  metaChipText: { ...typography.labelSmall, fontSize: 11, color: colors.textSecondary },

  notesBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm, padding: spacing.sm,
  },
  notesText: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, flex: 1 },

  // States
  center: { alignItems: 'center', paddingVertical: 60 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.screen },
  emptyTitle: { ...typography.h3, marginTop: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },
});

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector } from '@/controllers/store';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Booking } from '@/models/types';
import { colors, layout, radius, spacing, shadows, typography } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { ExportService } from '@/models/services/ExportService';

// Filter options for the status choice chips.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'in-transit', label: 'In Progress' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

// Per-status presentation — label, accent color, tint background and icon.
const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  completed: { label: 'Completed', color: colors.success, bg: colors.successLight, icon: 'check-circle' },
  cancelled: { label: 'Cancelled', color: colors.error, bg: colors.errorLight, icon: 'close-circle' },
  'in-transit': { label: 'In Progress', color: colors.info, bg: colors.infoLight, icon: 'navigation-variant' },
  pending: { label: 'Pending', color: colors.warning, bg: colors.warningLight, icon: 'clock-outline' },
  accepted: { label: 'Accepted', color: colors.info, bg: colors.infoLight, icon: 'check' },
};

const statusMeta = (status: string) =>
  STATUS_META[status] ?? { label: status, color: colors.textSecondary, bg: colors.surfaceAlt, icon: 'information-outline' };

const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={[styles.chip, active && styles.chipActive]}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export const TripHistoryScreen = () => {
  const { user } = useAppSelector(state => state.auth);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, statusFilter, bookings]);

  const loadBookings = async () => {
    try {
      const repo = new BookingRepository();
      const data = user?.user_type === 'driver'
        ? await repo.findByDriver(user!.id)
        : await repo.findByPassenger(user!.id);
      setBookings(data);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...bookings];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(b =>
        b.pickup_location.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.dropoff_location.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredBookings(filtered);
  };

  const handleExport = async () => {
    setMenuVisible(false);
    try {
      await ExportService.exportBookingsToCSV(filteredBookings);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) return <Loading message="Loading trip history..." />;

  const totalFares = filteredBookings.reduce((sum, b) => sum + (b.total_fare || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trip History</Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <TouchableOpacity style={styles.exportBtn} onPress={() => setMenuVisible(true)} activeOpacity={0.7}>
              <MaterialCommunityIcons name="download-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          }
        >
          <Menu.Item onPress={handleExport} title="Export CSV" leadingIcon="file-delimited" />
        </Menu>
      </View>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textLight} style={styles.searchIcon} />
        <RNTextInput
          placeholder="Search by location..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          placeholderTextColor={colors.textLight}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map(f => (
          <FilterChip
            key={f.key}
            label={f.label}
            active={statusFilter === f.key}
            onPress={() => setStatusFilter(f.key)}
          />
        ))}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{filteredBookings.length}</Text>
            <Text style={styles.summaryLabel}>Trips</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, typography.currency]}>₱{totalFares.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Total Fares</Text>
          </View>
        </View>

        {filteredBookings.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="map-marker-path" size={40} color={colors.textLight} />
            </View>
            <Text style={styles.emptyText}>No trips found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Your completed trips will appear here'}
            </Text>
          </View>
        ) : (
          filteredBookings.map(booking => {
            const meta = statusMeta(booking.status);
            return (
              <View key={booking.id} style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <MaterialCommunityIcons name={meta.icon} size={13} color={meta.color} />
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <Text style={[styles.fareText, typography.currency]}>₱{(booking.total_fare || 0).toFixed(2)}</Text>
                </View>

                <View style={styles.route}>
                  <View style={styles.routeRail}>
                    <View style={styles.originDot} />
                    <View style={styles.routeLine} />
                    <MaterialCommunityIcons name="map-marker" size={16} color={colors.text} style={styles.destMarker} />
                  </View>
                  <View style={styles.routeText}>
                    <Text style={styles.locationText} numberOfLines={1}>
                      {booking.pickup_location?.address || 'Pickup'}
                    </Text>
                    <View style={styles.routeGap} />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {booking.dropoff_location?.address || 'Dropoff'}
                    </Text>
                  </View>
                </View>

                <View style={styles.tripFooter}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={13} color={colors.textLight} />
                  <Text style={styles.dateText}>
                    {new Date(booking.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: { ...typography.h2, fontSize: 24 },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    ...typography.body,
    flex: 1,
    height: 48,
    fontSize: 15,
    color: colors.text,
  },
  filterScroll: { maxHeight: 56 },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.label,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  content: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: layout.contentBottom },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { ...typography.number, color: colors.text, fontSize: 22 },
  summaryLabel: { ...typography.labelSmall, color: colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, height: 38, backgroundColor: colors.borderLight },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  statusText: { ...typography.labelSmall, fontWeight: '700' },
  fareText: { ...typography.number, fontSize: 18, color: colors.text },
  route: {
    flexDirection: 'row',
  },
  routeRail: {
    alignItems: 'center',
    width: 16,
    marginRight: spacing.sm,
    paddingTop: 4,
  },
  originDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: colors.text,
  },
  routeLine: {
    flex: 1,
    width: 2,
    minHeight: 16,
    backgroundColor: colors.border,
    marginVertical: 3,
  },
  destMarker: { marginBottom: -2 },
  routeText: { flex: 1 },
  routeGap: { height: 14 },
  locationText: {
    ...typography.label,
    fontSize: 14,
    color: colors.text,
  },
  tripFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  dateText: { ...typography.bodySmall, fontSize: 12, color: colors.textLight },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyText: { ...typography.h3, fontSize: 18, color: colors.text },
  emptySubtext: {
    ...typography.body,
    fontSize: 14,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});

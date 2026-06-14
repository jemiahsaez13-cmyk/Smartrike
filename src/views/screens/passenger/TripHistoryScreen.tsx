import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, Surface, Chip, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector } from '@/controllers/store';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Booking } from '@/models/types';
import { colors, layout, radius, spacing, shadows, typography } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { ExportService } from '@/models/services/ExportService';

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
    try {
      await ExportService.exportBookingsToCSV(filteredBookings);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) return <Loading message="Loading trip history..." />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trip History</Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <TouchableOpacity style={styles.exportBtn} onPress={() => setMenuVisible(true)}>
              <MaterialCommunityIcons name="download-outline" size={20} color={colors.primary} />
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
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filters}>
          <Chip
            selected={statusFilter === 'all'}
            onPress={() => setStatusFilter('all')}
            style={styles.chip}
            textStyle={styles.chipText}
            compact
          >
            All
          </Chip>
          <Chip
            selected={statusFilter === 'completed'}
            onPress={() => setStatusFilter('completed')}
            style={styles.chip}
            textStyle={styles.chipText}
            compact
          >
            Completed
          </Chip>
          <Chip
            selected={statusFilter === 'cancelled'}
            onPress={() => setStatusFilter('cancelled')}
            style={styles.chip}
            textStyle={styles.chipText}
            compact
          >
            Cancelled
          </Chip>
          <Chip
            selected={statusFilter === 'in-transit'}
            onPress={() => setStatusFilter('in-transit')}
            style={styles.chip}
            textStyle={styles.chipText}
            compact
          >
            In Progress
          </Chip>
        </View>
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.summaryCard} elevation={1}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{filteredBookings.length}</Text>
            <Text style={styles.summaryLabel}>trips found</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, typography.currency]}>
              ₱{(filteredBookings.reduce((sum, booking) => sum + (booking.total_fare || 0), 0)).toFixed(2)}
            </Text>
            <Text style={styles.summaryLabel}>total fares</Text>
          </View>
        </Surface>
        
        {filteredBookings.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="map-marker-off" size={64} color={colors.textLight} />
            <Text style={styles.emptyText}>No trips found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        ) : (
          filteredBookings.map(booking => (
            <Surface key={booking.id} style={styles.tripCard} elevation={1}>
              <View style={styles.tripHeader}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: booking.status === 'completed' ? colors.success + '20' : colors.error + '20' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: booking.status === 'completed' ? colors.success : colors.error }
                  ]}>
                    {booking.status}
                  </Text>
                </View>
                <Text style={[styles.fareText, typography.currency]}>₱{(booking.total_fare || 0).toFixed(2)}</Text>
              </View>
              
              <View style={styles.locationRow}>
                <MaterialCommunityIcons name="circle" size={12} color={colors.primary} />
                <Text style={styles.locationText}>{booking.pickup_location?.address || 'Pickup'}</Text>
              </View>
              
              <View style={styles.locationRow}>
                <MaterialCommunityIcons name="map-marker" size={12} color={colors.accent} />
                <Text style={styles.locationText}>{booking.dropoff_location?.address || 'Dropoff'}</Text>
              </View>
              
              <Text style={styles.dateText}>
                {new Date(booking.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </Surface>
          ))
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
    borderBottomColor: colors.borderLight
  },
  headerTitle: { ...typography.title, fontSize: 24, color: colors.text },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    ...typography.body,
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text
  },
  filterScroll: { maxHeight: 44, marginBottom: spacing.md },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: { 
    height: 32,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 0,
  },
  chipText: {
    ...typography.labelSmall,
    fontSize: 12,
    color: colors.textSecondary,
    marginVertical: 0,
    marginHorizontal: 4,
  },
  content: { flex: 1 },
  scrollContent: { padding: spacing.md },
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
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.number,
    color: colors.text,
    fontSize: 20,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 38,
    backgroundColor: colors.borderLight,
  },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12
  },
  statusText: {
    ...typography.label,
    fontSize: 12,
    textTransform: 'capitalize'
  },
  fareText: {
    ...typography.number,
    fontSize: 18,
    color: colors.text
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs
  },
  locationText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1
  },
  dateText: {
    ...typography.body,
    fontSize: 12,
    color: colors.textLight,
    marginTop: spacing.xs
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2
  },
  emptyText: {
    ...typography.title,
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: spacing.md
  },
  emptySubtext: {
    ...typography.body,
    fontSize: 14,
    color: colors.textLight,
    marginTop: spacing.xs
  }
});

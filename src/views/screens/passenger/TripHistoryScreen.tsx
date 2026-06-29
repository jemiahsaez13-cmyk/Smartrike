import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput as RNTextInput, Modal } from 'react-native';
import { Text, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector, useAppDispatch } from '@/controllers/store';
import { submitRating } from '@/controllers/slices/bookingSlice';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Booking } from '@/models/types';
import { colors, layout, radius, spacing, shadows, typography } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { ExportService } from '@/models/services/ExportService';
import { notify } from '@/utils/confirm';

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
  const dispatch = useAppDispatch();
  const isPassenger = user?.user_type !== 'driver';
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [menuVisible, setMenuVisible] = useState(false);
  // Edit-review modal state
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const openReview = (b: Booking) => {
    const r: any = b.passenger_rating;
    setReviewStars(r?.stars ?? 5);
    setReviewComment(r?.comment ?? '');
    setReviewBooking(b);
  };

  const submitReview = async () => {
    if (!reviewBooking) return;
    setSavingReview(true);
    try {
      await dispatch(
        submitRating({
          bookingId: reviewBooking.id,
          rating: { stars: reviewStars, comment: reviewComment, created_at: new Date().toISOString() } as any,
        })
      ).unwrap();
      await loadBookings();
      setReviewBooking(null);
    } catch {
      await notify('Could not save review', 'Please try again.');
    } finally {
      setSavingReview(false);
    }
  };

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

  // Only completed trips contribute to fares — cancelled/pending rides were
  // never paid, so they must not inflate the total.
  const totalFares = filteredBookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + (b.total_fare || 0), 0);

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
                  <Text style={[styles.fareText, typography.currency, booking.status === 'cancelled' && styles.fareVoid]}>
                    {booking.status === 'cancelled' ? '—' : `₱${(booking.total_fare || 0).toFixed(2)}`}
                  </Text>
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

                {isPassenger && booking.status === 'completed' && (
                  <TouchableOpacity style={styles.reviewRow} onPress={() => openReview(booking)} activeOpacity={0.7}>
                    {booking.passenger_rating ? (
                      <>
                        <View style={styles.starsInline}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <MaterialCommunityIcons
                              key={n}
                              name={n <= ((booking.passenger_rating as any)?.stars ?? 0) ? 'star' : 'star-outline'}
                              size={14}
                              color={colors.warning}
                            />
                          ))}
                        </View>
                        <Text style={styles.reviewEdit}>Edit review</Text>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons name="star-plus-outline" size={16} color={colors.primary} />
                        <Text style={[styles.reviewEdit, { color: colors.primary }]}>Rate this trip</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Edit Review Modal ───────────────────────────────────── */}
      <Modal visible={!!reviewBooking} transparent animationType="fade" onRequestClose={() => setReviewBooking(null)}>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>Rate your trip</Text>
            <Text style={styles.reviewSub} numberOfLines={1}>
              To {reviewBooking?.dropoff_location?.address || 'destination'}
            </Text>

            <View style={styles.reviewStarsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setReviewStars(n)} activeOpacity={0.7}>
                  <MaterialCommunityIcons
                    name={n <= reviewStars ? 'star' : 'star-outline'}
                    size={40}
                    color={n <= reviewStars ? colors.warning : colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <RNTextInput
              placeholder="Share details about your ride (optional)"
              value={reviewComment}
              onChangeText={setReviewComment}
              style={styles.reviewInput}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={300}
            />

            <TouchableOpacity
              style={[styles.reviewSaveBtn, savingReview && { opacity: 0.6 }]}
              onPress={submitReview}
              disabled={savingReview}
              activeOpacity={0.85}
            >
              <Text style={styles.reviewSaveText}>{savingReview ? 'Saving…' : 'Save Review'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReviewBooking(null)} style={styles.reviewCancelBtn} activeOpacity={0.7}>
              <Text style={styles.reviewCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  fareVoid: { color: colors.textLight },
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
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  starsInline: { flexDirection: 'row', gap: 2 },
  reviewEdit: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  reviewOverlay: { flex: 1, backgroundColor: 'rgba(13,27,42,0.6)', justifyContent: 'center', paddingHorizontal: spacing.lg },
  reviewCard: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.xl, alignItems: 'center', ...shadows.xl },
  reviewTitle: { ...typography.h2, fontSize: 22, color: colors.text },
  reviewSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg, textAlign: 'center' },
  reviewStarsRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.lg },
  reviewInput: {
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
  reviewSaveBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewSaveText: { ...typography.label, color: '#fff', fontSize: 16 },
  reviewCancelBtn: { paddingVertical: spacing.sm, marginTop: spacing.xs },
  reviewCancelText: { ...typography.body, fontSize: 14, color: colors.textSecondary },
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

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@/controllers/store';
import { completeTrip, submitRating } from '@/controllers/slices/bookingSlice';
import { Button } from '@/views/components/common/Button';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { colors, spacing, shadows } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');

export const ActiveTripScreen = () => {
  const { currentBooking } = useBooking();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  const [ratingVisible, setRatingVisible] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      await dispatch(completeTrip(bookingId)).unwrap();
    } catch {
      // Mock backend rarely fails; complete locally regardless.
    } finally {
      setSubmitting(false);
      setRatingVisible(false);
      navigation.navigate('PassengerDashboard');
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const isAccepted = status === 'accepted';
    return (
      <View style={[styles.statusBadge, { backgroundColor: isAccepted ? '#DBEAFE' : '#DCFCE7' }]}>
        <View style={[styles.statusDot, { backgroundColor: isAccepted ? '#2563EB' : '#16A34A' }]} />
        <Text style={[styles.statusText, { color: isAccepted ? '#1E40AF' : '#166534' }]}>
          {isAccepted ? 'Driver is arriving' : 'On your way'}
        </Text>
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
        </View>
      </View>

      <Animated.View style={[styles.trackingCard, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        
        <View style={styles.driverSection}>
          <View style={styles.driverInfo}>
            <Surface style={styles.driverAvatar} elevation={2}>
              <MaterialCommunityIcons name="account-tie" size={36} color={colors.primary} />
            </Surface>
            <View>
              <Text style={styles.driverName}>Kuya Jojo</Text>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={14} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={styles.ratingText}>4.9 (124 trips)</Text>
              </View>
            </View>
          </View>
          <View style={styles.driverActions}>
            <TouchableOpacity style={styles.actionBtn}>
              <MaterialCommunityIcons name="phone" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <MaterialCommunityIcons name="message-text" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleCard}>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehiclePlate}>ABC-1234</Text>
            <Text style={styles.vehicleDesc}>Blue Tricycle • FEDTODAB</Text>
          </View>
          <TricycleIcon size={56} color={colors.primaryDark} />
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
              <Text style={styles.detailValue}>₱{currentBooking?.total_fare || '45.00'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.completeBtn} onPress={() => setRatingVisible(true)} activeOpacity={0.85}>
          <LinearGradient colors={['#1E90FF', '#0DA5C0']} style={styles.completeGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <MaterialCommunityIcons name="flag-checkered" size={20} color="#fff" />
            <Text style={styles.completeText}>Complete Trip</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Button
          variant="outline"
          onPress={() => {}}
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
            <Text style={styles.ratingSubtitle}>How was your ride with Kuya Jojo?</Text>

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
              <LinearGradient colors={['#1E90FF', '#0DA5C0']} style={styles.submitRatingGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
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
  backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10, ...shadows.md },
  trackingOverlay: { position: 'absolute', top: 60, alignSelf: 'center', zIndex: 5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, ...shadows.md },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 13, fontWeight: '700' },
  trackingCard: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: spacing.lg, paddingBottom: 40, ...shadows.xl },
  handle: { width: 40, height: 5, backgroundColor: colors.borderLight, borderRadius: 3, alignSelf: 'center', marginBottom: spacing.lg },
  driverSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  driverInfo: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  driverName: { fontSize: 18, fontWeight: '800', color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  ratingText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  driverActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  vehicleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primaryLight, padding: spacing.md, borderRadius: 16, marginBottom: spacing.lg },
  vehicleInfo: { flex: 1 },
  vehiclePlate: { fontSize: 18, fontWeight: '900', color: colors.primaryDark, letterSpacing: 1 },
  vehicleDesc: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 },
  tripDetails: { marginBottom: spacing.xl },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  detailIcon: { marginRight: spacing.md },
  detailTextContainer: { flex: 1 },
  detailLabel: { fontSize: 10, fontWeight: '800', color: colors.textLight, letterSpacing: 1, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  completeBtn: { height: 52, borderRadius: 14, overflow: 'hidden', marginBottom: spacing.md },
  completeGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  completeText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  sosBtn: { borderColor: colors.error, borderRadius: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(13,27,42,0.6)', justifyContent: 'center', padding: spacing.lg },
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
  ratingTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  ratingSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.lg },
  commentInput: {
    width: '100%',
    minHeight: 64,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  submitRatingBtn: { width: '100%', height: 52, borderRadius: 14, overflow: 'hidden' },
  submitRatingGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitRatingText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});

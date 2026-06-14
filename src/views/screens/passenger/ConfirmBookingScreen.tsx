import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@/controllers/store';
import { updateBookingStatus } from '@/controllers/slices/bookingSlice';
import { RealtimeService } from '@/models/services/RealtimeService';
import { Button } from '@/views/components/common/Button';
import { colors, spacing, shadows } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const realtimeService = new RealtimeService();

export const ConfirmBookingScreen = () => {
  const { currentBooking } = useBooking();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  // Radar Animation
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Subscribe to live booking updates so we react the moment a driver accepts.
  useEffect(() => {
    const radarAnimation = Animated.loop(
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 4,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    radarAnimation.start();

    let channelKey: string | null = null;
    if (currentBooking?.id) {
      channelKey = realtimeService.subscribeToBooking(currentBooking.id, (payload) => {
        if (payload?.new) dispatch(updateBookingStatus(payload.new));
      });
    }

    return () => {
      radarAnimation.stop();
      if (channelKey) realtimeService.unsubscribe(channelKey);
    };
  }, [currentBooking?.id, dispatch]);

  // Navigate to the live trip view once a driver is assigned.
  useEffect(() => {
    if (currentBooking?.status === 'accepted' || currentBooking?.status === 'in-transit') {
      navigation.navigate('ActiveTrip');
    }
  }, [currentBooking?.status, navigation]);

  const handleCancel = () => {
    navigation.navigate('PassengerDashboard');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.background, '#fff']} style={styles.content}>
        <View style={styles.radarContainer}>
          <Animated.View 
            style={[
              styles.radarCircle, 
              { 
                transform: [{ scale: scaleAnim }], 
                opacity: opacityAnim 
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.radarCircle, 
              { 
                transform: [{ scale: Animated.multiply(scaleAnim, 0.5) }], 
                opacity: opacityAnim 
              }
            ]} 
          />
          <Surface style={styles.centerIcon} elevation={4}>
            <MaterialCommunityIcons name="bike" size={40} color="#fff" />
          </Surface>
        </View>

        <View style={styles.textSection}>
          <Text style={styles.title}>Finding your ride</Text>
          <Text style={styles.subtitle}>Connecting you to the nearest available FEDTODAB drivers in Boac...</Text>
        </View>

        <Surface style={styles.tripSummary} elevation={1}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>From</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {currentBooking?.pickup_location.address || 'Current Location'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>To</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {currentBooking?.dropoff_location.address || 'Destination'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Estimated Fare</Text>
            <Text style={styles.summaryFare}>₱{currentBooking?.total_fare || '45.00'}</Text>
          </View>
        </Surface>

        <View style={styles.footer}>
          <Button 
            variant="outline" 
            onPress={handleCancel} 
            style={styles.cancelBtn}
          >
            Cancel Booking
          </Button>
          <Text style={styles.tipText}>Tip: Finding a driver usually takes less than a minute</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: spacing.xl, paddingTop: 100 },
  radarContainer: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  radarCircle: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primaryLight },
  centerIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  textSection: { alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 12 },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20, lineHeight: 24 },
  tripSummary: { width: '100%', backgroundColor: colors.surface, borderRadius: 24, padding: spacing.lg, marginTop: 40, borderWidth: 1, borderColor: colors.borderLight },
  summaryRow: { paddingVertical: 8 },
  summaryLabel: { fontSize: 10, fontWeight: '800', color: colors.textLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  summaryFare: { fontSize: 20, fontWeight: '800', color: colors.primary },
  summaryDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 4 },
  footer: { width: '100%', alignItems: 'center', paddingBottom: 20 },
  cancelBtn: { width: '100%', borderColor: colors.error },
  tipText: { fontSize: 12, color: colors.textLight, marginTop: 20, fontWeight: '500' }
});

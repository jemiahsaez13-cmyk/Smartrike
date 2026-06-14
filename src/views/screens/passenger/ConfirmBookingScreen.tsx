import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@/controllers/store';
import { cancelBooking, updateBookingStatus } from '@/controllers/slices/bookingSlice';
import { RealtimeService } from '@/models/services/RealtimeService';
import { Button } from '@/views/components/common/Button';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { colors, layout, radius, spacing, shadows, typography } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const realtimeService = new RealtimeService();

export const ConfirmBookingScreen = () => {
  const { currentBooking } = useBooking();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);

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

  useEffect(() => {
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Navigate to the live trip view once a driver is assigned.
  useEffect(() => {
    if (currentBooking?.status === 'accepted' || currentBooking?.status === 'in-transit') {
      navigation.navigate('ActiveTrip');
    }
  }, [currentBooking?.status, navigation]);

  const handleCancel = async () => {
    if (!currentBooking?.id) {
      navigation.navigate('PassengerDashboard');
      return;
    }
    setCancelling(true);
    try {
      await dispatch(cancelBooking(currentBooking.id)).unwrap();
    } catch {
      navigation.navigate('PassengerDashboard');
    } finally {
      setCancelling(false);
      navigation.navigate('PassengerDashboard');
    }
  };

  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

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
            <TricycleIcon size={64} color="#fff" />
          </Surface>
        </View>

        <View style={styles.textSection}>
          <Text style={styles.title}>Finding your ride</Text>
          <Text style={styles.subtitle}>Matching with verified FEDTODAB drivers near your pickup point.</Text>
        </View>

        <View style={styles.matchingPanel}>
          <View style={styles.matchingHeader}>
            <Text style={styles.matchingLabel}>Matching time</Text>
            <Text style={styles.matchingTime}>{elapsedLabel}</Text>
          </View>
          {[
            { label: 'Booking received', done: true },
            { label: 'Broadcasting to nearby drivers', done: true },
            { label: 'Waiting for driver acceptance', done: false },
          ].map((step, index) => (
            <View key={step.label} style={styles.stepRow}>
              <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
                {step.done ? <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" /> : <View style={styles.stepDotInner} />}
              </View>
              <Text style={[styles.stepText, step.done && styles.stepTextDone]}>{step.label}</Text>
            </View>
          ))}
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
            <Text style={[styles.summaryFare, typography.currency]}>
              ₱{currentBooking ? currentBooking.total_fare.toFixed(2) : '45.00'}
            </Text>
          </View>
        </Surface>

        <View style={styles.footer}>
          <Button 
            variant="outline" 
            onPress={handleCancel} 
            loading={cancelling}
            disabled={cancelling}
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
  content: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: spacing.xl, paddingTop: layout.headerTop + 34 },
  radarContainer: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  radarCircle: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primaryLight },
  centerIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  textSection: { alignItems: 'center' },
  title: { ...typography.title, fontSize: 28, color: colors.text, marginBottom: 12 },
  subtitle: { ...typography.body, fontSize: 16, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20, lineHeight: 24 },
  matchingPanel: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    ...shadows.sm,
  },
  matchingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  matchingLabel: { ...typography.label, color: colors.textSecondary, fontSize: 12 },
  matchingTime: { ...typography.number, color: colors.primary, fontSize: 18 },
  stepRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  stepDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepDotInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  stepText: { ...typography.body, color: colors.textSecondary, fontSize: 13 },
  stepTextDone: { color: colors.text },
  tripSummary: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: 24, borderWidth: 1, borderColor: colors.borderLight },
  summaryRow: { paddingVertical: 8 },
  summaryLabel: { ...typography.label, fontSize: 10, color: colors.textLight, letterSpacing: 0, textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { ...typography.subtitle, fontSize: 15, color: colors.text },
  summaryFare: { ...typography.number, fontSize: 20, color: colors.primary },
  summaryDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 4 },
  footer: { width: '100%', alignItems: 'center', paddingBottom: 20 },
  cancelBtn: { width: '100%', borderColor: colors.error },
  tipText: { ...typography.body, fontSize: 12, color: colors.textLight, marginTop: 20 }
});

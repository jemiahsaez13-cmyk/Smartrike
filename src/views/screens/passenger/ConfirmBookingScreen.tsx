import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Animated, Easing, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
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

  // Radar pulse
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  // Subscribe to live booking updates so we react the moment a driver accepts.
  useEffect(() => {
    const radarAnimation = Animated.loop(
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 4, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ])
    );
    radarAnimation.start();

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    breatheLoop.start();

    let channelKey: string | null = null;
    if (currentBooking?.id) {
      channelKey = realtimeService.subscribeToBooking(currentBooking.id, (payload) => {
        if (payload?.new) dispatch(updateBookingStatus(payload.new));
      });
    }

    return () => {
      radarAnimation.stop();
      breatheLoop.stop();
      if (channelKey) realtimeService.unsubscribe(channelKey);
    };
  }, [currentBooking?.id, dispatch]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Navigate to the live trip view once a driver is assigned. `replace` so this
  // matching screen (and its realtime subscription) tears down cleanly.
  useEffect(() => {
    if (currentBooking?.status === 'accepted' || currentBooking?.status === 'in-transit') {
      navigation.replace('ActiveTrip');
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
      /* fall through to navigation */
    } finally {
      setCancelling(false);
      navigation.navigate('PassengerDashboard');
    }
  };

  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const coreScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const steps = [
    { label: 'Booking received', done: true },
    { label: 'Broadcasting to nearby drivers', done: true },
    { label: 'Waiting for a driver to accept', done: false },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FFFFFF', colors.surfaceAlt]} style={styles.bg}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.kicker}>FEDTODAB · SMART TRIKE</Text>
          <View style={styles.timerPill}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>{elapsedLabel}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
        {/* Radar hero */}
        <View style={styles.hero}>
          <View style={styles.radar}>
            <Animated.View style={[styles.ring, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]} />
            <Animated.View style={[styles.ring, { transform: [{ scale: Animated.multiply(scaleAnim, 0.6) }], opacity: opacityAnim }]} />
            <View style={styles.ringHalo} />
            <Animated.View style={[styles.core, { transform: [{ scale: coreScale }] }]}>
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.coreFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <TricycleIcon size={54} color="#fff" />
              </LinearGradient>
            </Animated.View>
          </View>
          <Text style={styles.title}>Finding your ride</Text>
          <Text style={styles.subtitle}>Connecting you with a verified FEDTODAB driver near your pickup point.</Text>
        </View>

        {/* Matching steps */}
        <View style={styles.card}>
          {steps.map((step, index) => {
            const active = !step.done;
            return (
              <View key={step.label} style={[styles.stepRow, index < steps.length - 1 && styles.stepRowBorder]}>
                <View style={[styles.stepDot, step.done && styles.stepDotDone, active && styles.stepDotActive]}>
                  {step.done ? (
                    <MaterialCommunityIcons name="check" size={13} color="#fff" />
                  ) : (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </View>
                <Text style={[styles.stepText, step.done && styles.stepTextDone]}>{step.label}</Text>
                {step.done && <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />}
              </View>
            );
          })}
        </View>

        {/* Trip summary */}
        <View style={styles.summary}>
          <View style={styles.route}>
            <View style={styles.routeRail}>
              <View style={styles.originDot} />
              <View style={styles.routeLine} />
              <MaterialCommunityIcons name="map-marker" size={18} color={colors.primary} style={{ marginBottom: -2 }} />
            </View>
            <View style={styles.routeText}>
              <View style={styles.routeBlock}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <Text style={styles.routeValue} numberOfLines={1}>{currentBooking?.pickup_location.address || 'Current Location'}</Text>
              </View>
              <View style={styles.routeBlock}>
                <Text style={styles.routeLabel}>DROP-OFF</Text>
                <Text style={styles.routeValue} numberOfLines={1}>{currentBooking?.dropoff_location.address || 'Destination'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Estimated fare</Text>
            <Text style={[styles.fareValue, typography.currency]}>₱{currentBooking ? currentBooking.total_fare.toFixed(2) : '0.00'}</Text>
          </View>
        </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button variant="outline" onPress={handleCancel} loading={cancelling} disabled={cancelling} style={styles.cancelBtn}>
            Cancel Booking
          </Button>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="shield-check" size={14} color={colors.textMuted} />
            <Text style={styles.tip}>Most FEDTODAB drivers respond within a minute.</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bg: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: layout.headerTop, paddingBottom: spacing.xl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { ...typography.labelSmall, color: colors.textMuted, letterSpacing: 1.5, fontSize: 10 },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    ...shadows.sm,
  },
  timerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  timerText: { ...typography.number, fontSize: 13, color: colors.text },

  scroll: { flex: 1 },
  scrollBody: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.lg },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  radar: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl },
  ring: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  ringHalo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight,
    opacity: 0.5,
  },
  core: { width: 92, height: 92, borderRadius: 46, ...shadows.lg },
  coreFill: { flex: 1, borderRadius: 46, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.h1, fontSize: 28, color: colors.text },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    lineHeight: 21,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 52 },
  stepRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepDotActive: { backgroundColor: colors.surface, borderColor: colors.primary },
  stepText: { ...typography.body, flex: 1, color: colors.textSecondary, fontSize: 14 },
  stepTextDone: { color: colors.text },

  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadows.sm,
  },
  route: { flexDirection: 'row' },
  routeRail: { alignItems: 'center', width: 18, marginRight: spacing.md, paddingTop: 5 },
  originDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 3, borderColor: colors.primary },
  routeLine: { flex: 1, width: 2, minHeight: 22, backgroundColor: colors.borderLight, marginVertical: 4 },
  routeText: { flex: 1 },
  routeBlock: { minHeight: 44, justifyContent: 'center' },
  routeLabel: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted, letterSpacing: 0.5 },
  routeValue: { ...typography.subtitle, fontSize: 15, color: colors.text, marginTop: 2 },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  fareLabel: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  fareValue: { ...typography.number, fontSize: 22, color: colors.primary },

  footer: { paddingTop: spacing.md },
  cancelBtn: { width: '100%', borderColor: colors.error },
  tipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  tip: { ...typography.bodySmall, fontSize: 12, color: colors.textMuted },
});

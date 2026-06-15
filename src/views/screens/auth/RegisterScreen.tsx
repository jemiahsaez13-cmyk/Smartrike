import React, { useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radius, shadows } from '@/views/styles/theme';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';

export const RegisterScreen = () => {
  const navigation = useNavigation<any>();

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const panelY = useRef(new Animated.Value(80)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const card1Y = useRef(new Animated.Value(40)).current;
  const card2Y = useRef(new Animated.Value(40)).current;
  const cardsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(heroOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(panelY, { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }),
        Animated.timing(panelOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(card1Y, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(80),
          Animated.spring(card2Y, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Black Hero ── */}
      <Animated.View style={[styles.hero, { opacity: heroOpacity }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
        <TricycleIcon size={44} color="#fff" />
        <Text style={styles.heroTitle}>Join Smart Trike</Text>
        <Text style={styles.heroSub}>Choose how you want to ride with us.</Text>
      </Animated.View>

      {/* ── Animated White Panel ── */}
      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateY: panelY }], opacity: panelOpacity },
        ]}
      >
        <View style={styles.panelHandle} />
        <Text style={styles.panelTitle}>Select account type</Text>

        {/* Passenger Card */}
        <Animated.View
          style={[
            styles.cardWrapper,
            { opacity: cardsOpacity, transform: [{ translateY: card1Y }] },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PassengerRegister')}
            style={styles.roleCard}
          >
            <View style={[styles.roleIcon, { backgroundColor: colors.infoLight }]}>
              <MaterialCommunityIcons name="account-group-outline" size={30} color={colors.accent} />
            </View>
            <View style={styles.roleText}>
              <Text style={styles.roleTitle}>Passenger</Text>
              <Text style={styles.roleDesc}>Book rides and travel safely across the city.</Text>
            </View>
            <View style={styles.roleArrow}>
              <MaterialCommunityIcons name="arrow-right" size={20} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Driver Card */}
        <Animated.View
          style={[
            styles.cardWrapper,
            { opacity: cardsOpacity, transform: [{ translateY: card2Y }] },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('DriverRegister')}
            style={styles.roleCard}
          >
            <View style={[styles.roleIcon, { backgroundColor: colors.secondaryLight }]}>
              <MaterialCommunityIcons name="moped" size={30} color={colors.secondary} />
            </View>
            <View style={styles.roleText}>
              <Text style={styles.roleTitle}>Driver</Text>
              <Text style={styles.roleDesc}>Join our network and start earning today.</Text>
            </View>
            <View style={styles.roleArrow}>
              <MaterialCommunityIcons name="arrow-right" size={20} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?  </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  hero: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h1,
    fontSize: 30,
    color: '#fff',
    marginTop: spacing.sm,
  },
  heroSub: {
    ...typography.body,
    color: 'rgba(255,255,255,0.6)',
  },
  panel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: spacing.lg,
  },
  panelTitle: {
    ...typography.h3,
    fontSize: 20,
    marginBottom: spacing.xl,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  roleIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleText: {
    flex: 1,
  },
  roleTitle: {
    ...typography.h3,
    fontSize: 17,
    marginBottom: 3,
  },
  roleDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  roleArrow: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.bodySmall,
  },
  footerLink: {
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '700',
  },
});

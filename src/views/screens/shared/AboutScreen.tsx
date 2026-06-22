import React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { SERVICE_AREA, SUPPORT, TODA_NAME } from '@/config/constants';
import { notify } from '@/utils/confirm';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const APP_VERSION = '1.0.0';

const FEATURES = [
  { icon: 'map-marker-radius-outline', title: 'Book a ride', text: 'Match with the nearest FEDTODAB tricycle and track it live on the map.' },
  { icon: 'cash-multiple', title: 'Fair, clear fares', text: 'Transparent fare computation with cash, GCash, and PayMaya options.' },
  { icon: 'card-account-details-outline', title: 'MTOP franchises', text: 'Drivers submit and renew tricycle franchises, reviewed by the LGU admin.' },
  { icon: 'shield-check-outline', title: 'Safe & accountable', text: 'Trip records, ratings, and driver verification keep every ride accountable.' },
];

export const AboutScreen = () => {
  const navigation = useNavigation<any>();

  const openLink = async (url: string, fallback: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else notify('Not available', fallback);
    } catch {
      notify('Not available', fallback);
    }
  };

  const Feature = ({ icon, title, text }: { icon: any; title: string; text: string }) => (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.text} />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureText}>{text}</Text>
      </View>
    </View>
  );

  const LinkRow = ({ icon, label, onPress, last }: { icon: any; label: string; onPress: () => void; last?: boolean }) => (
    <TouchableOpacity style={[styles.linkRow, !last && styles.linkBorder]} onPress={onPress} activeOpacity={0.6}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.text} />
      <Text style={styles.linkLabel}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* App bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>About</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Brand hero */}
        <View style={styles.hero}>
          <View style={styles.logo}>
            <TricycleIcon size={44} color="#fff" />
          </View>
          <Text style={styles.brand}>Smart Trike</Text>
          <Text style={styles.tagline}>Smart tricycle booking for {SERVICE_AREA}</Text>
          <View style={styles.versionPill}>
            <Text style={styles.versionText}>Version {APP_VERSION}</Text>
          </View>
        </View>

        {/* Mission */}
        <View style={styles.missionCard}>
          <Text style={styles.missionText}>
            Smart Trike connects passengers with {TODA_NAME} tricycle drivers in {SERVICE_AREA} —
            making everyday trips faster, fares fairer, and franchise management easier for the
            local transport community.
          </Text>
        </View>

        {/* What it does */}
        <Text style={styles.sectionTitle}>What Smart Trike Does</Text>
        <View style={styles.card}>
          {FEATURES.map((f) => (
            <Feature key={f.title} {...f} />
          ))}
        </View>

        {/* Partner */}
        <Text style={styles.sectionTitle}>In Partnership With</Text>
        <View style={styles.partnerCard}>
          <View style={styles.partnerIcon}>
            <MaterialCommunityIcons name="account-group-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.featureCopy}>
            <Text style={styles.featureTitle}>{SUPPORT.office}</Text>
            <Text style={styles.featureText}>{SUPPORT.address}</Text>
          </View>
        </View>

        {/* Links */}
        <Text style={styles.sectionTitle}>Legal & Support</Text>
        <View style={styles.card}>
          <LinkRow
            icon="lifebuoy"
            label="Help & Support"
            onPress={() => navigation.navigate('HelpSupport')}
          />
          <LinkRow
            icon="shield-check-outline"
            label="Privacy Policy"
            onPress={() => navigation.navigate('Legal', { type: 'privacy' })}
          />
          <LinkRow
            icon="file-document-outline"
            label="Terms of Service"
            onPress={() => navigation.navigate('Legal', { type: 'terms' })}
          />
          <LinkRow
            icon="email-outline"
            label="Contact Us"
            onPress={() => openLink(`mailto:${SUPPORT.email}`, `Email us at ${SUPPORT.email}`)}
            last
          />
        </View>

        <Text style={styles.copyright}>
          © {new Date().getFullYear()} Smart Trike · {TODA_NAME}{'\n'}Made for {SERVICE_AREA}
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.screen,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.lg,
  },
  brand: {
    ...typography.h1,
    fontSize: 28,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  versionPill: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  versionText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  missionCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  missionText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  sectionTitle: {
    ...typography.labelSmall,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureCopy: {
    flex: 1,
  },
  featureTitle: {
    ...typography.label,
    fontSize: 14,
  },
  featureText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 19,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  partnerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 54,
  },
  linkBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  linkLabel: {
    flex: 1,
    ...typography.label,
    fontSize: 15,
  },
  copyright: {
    ...typography.bodySmall,
    textAlign: 'center',
    color: colors.textLight,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});

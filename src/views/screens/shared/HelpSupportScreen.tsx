import React, { useState } from 'react';
import {
  LayoutAnimation,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { FAQS, SUPPORT } from '@/config/constants';
import { notify } from '@/utils/confirm';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const HelpSupportScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAppSelector((state) => state.auth);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const openLink = async (url: string, fallback: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else notify('Not available', fallback);
    } catch {
      notify('Not available', fallback);
    }
  };

  const callHotline = () => openLink(`tel:${SUPPORT.hotlineDial}`, `Call us at ${SUPPORT.hotline}`);

  const emailSupport = () => {
    const subject = encodeURIComponent('Smart Trike Support Request');
    const body = encodeURIComponent(
      `\n\n———\nAccount: ${user?.name ?? ''} (${user?.email ?? ''})\nRole: ${user?.user_type ?? ''}`
    );
    openLink(`mailto:${SUPPORT.email}?subject=${subject}&body=${body}`, `Email us at ${SUPPORT.email}`);
  };

  const reportProblem = () => {
    const subject = encodeURIComponent('Report a Problem — Smart Trike');
    const body = encodeURIComponent(
      `Describe the problem here:\n\n\n———\nAccount: ${user?.name ?? ''} (${user?.email ?? ''})\nRole: ${user?.user_type ?? ''}`
    );
    openLink(`mailto:${SUPPORT.email}?subject=${subject}&body=${body}`, `Email us at ${SUPPORT.email}`);
  };

  const toggleFaq = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq((prev) => (prev === i ? null : i));
  };

  const ContactCard = ({
    icon,
    title,
    subtitle,
    onPress,
  }: {
    icon: any;
    title: string;
    subtitle: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.contactCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.contactIcon}>
        <MaterialCommunityIcons name={icon} size={22} color={colors.text} />
      </View>
      <Text style={styles.contactTitle}>{title}</Text>
      <Text style={styles.contactSub} numberOfLines={1}>{subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* App bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="lifebuoy" size={28} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroSub}>
            Reach the {SUPPORT.office} team or browse common questions below.
          </Text>
        </View>

        {/* Quick contact */}
        <View style={styles.contactRow}>
          <ContactCard icon="phone-outline" title="Call" subtitle={SUPPORT.hotline} onPress={callHotline} />
          <ContactCard icon="email-outline" title="Email" subtitle="Send a message" onPress={emailSupport} />
          <ContactCard icon="flag-outline" title="Report" subtitle="An issue" onPress={reportProblem} />
        </View>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <View style={styles.faqCard}>
          {FAQS.map((faq, i) => {
            const open = openFaq === i;
            return (
              <View key={faq.q} style={[styles.faqItem, i === FAQS.length - 1 && { borderBottomWidth: 0 }]}>
                <TouchableOpacity style={styles.faqHeader} onPress={() => toggleFaq(i)} activeOpacity={0.7}>
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <MaterialCommunityIcons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={colors.textLight}
                  />
                </TouchableOpacity>
                {open && <Text style={styles.faqAnswer}>{faq.a}</Text>}
              </View>
            );
          })}
        </View>

        {/* Office info */}
        <Text style={styles.sectionTitle}>Dispatch Office</Text>
        <View style={styles.officeCard}>
          <View style={styles.officeRow}>
            <MaterialCommunityIcons name="office-building-marker-outline" size={20} color={colors.text} />
            <View style={styles.officeCopy}>
              <Text style={styles.officeTitle}>{SUPPORT.office}</Text>
              <Text style={styles.officeText}>{SUPPORT.address}</Text>
            </View>
          </View>
          <View style={styles.officeDivider} />
          <View style={styles.officeRow}>
            <MaterialCommunityIcons name="clock-outline" size={20} color={colors.text} />
            <View style={styles.officeCopy}>
              <Text style={styles.officeTitle}>Office Hours</Text>
              <Text style={styles.officeText}>{SUPPORT.hours}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.version}>Smart Trike • v1.0.0 · {SUPPORT.office}</Text>
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
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  heroTitle: {
    ...typography.h2,
    fontSize: 22,
  },
  heroSub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  contactCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    ...shadows.sm,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  contactTitle: {
    ...typography.label,
    fontSize: 14,
  },
  contactSub: {
    ...typography.labelSmall,
    fontSize: 11,
    color: colors.textLight,
    marginTop: 1,
  },
  sectionTitle: {
    ...typography.labelSmall,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  faqCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: spacing.sm,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: spacing.md,
  },
  faqQuestion: {
    flex: 1,
    ...typography.label,
    fontSize: 14,
  },
  faqAnswer: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingBottom: spacing.sm,
    paddingRight: spacing.lg,
  },
  officeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  officeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  officeCopy: {
    flex: 1,
  },
  officeTitle: {
    ...typography.label,
    fontSize: 14,
  },
  officeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  officeDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  version: {
    ...typography.bodySmall,
    textAlign: 'center',
    color: colors.textLight,
    marginTop: spacing.sm,
  },
});

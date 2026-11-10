import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BAGGAGE_SIZE_HINT, BaggageSize, baggageSummary } from '@/config/constants';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

interface Props {
  booking: { baggage_count?: number | null; baggage_size?: BaggageSize | string | null } | null | undefined;
  /** Driver screens get a highlighted box with what the size means. */
  forDriver?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Baggage the passenger declared (D3). Information only, no extra charge.
 * Renders nothing when the passenger brings no baggage.
 */
export const BaggageNote = ({ booking, forDriver, style }: Props) => {
  const summary = baggageSummary(booking);
  if (!summary) return null;
  const size = booking?.baggage_size as BaggageSize;
  const large = size === 'large';

  if (!forDriver) {
    return (
      <View style={[styles.line, style]}>
        <MaterialCommunityIcons name="bag-suitcase-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.lineText}>Baggage: {summary} · no extra charge</Text>
      </View>
    );
  }

  return (
    <View style={[styles.box, large && styles.boxLarge, style]}>
      <MaterialCommunityIcons name="bag-suitcase" size={18} color={large ? AMBER_TEXT : colors.primary} />
      <View style={styles.boxCopy}>
        <Text style={[styles.boxTitle, large && { color: AMBER_TEXT }]}>Baggage: {summary}</Text>
        <Text style={styles.boxHint}>{BAGGAGE_SIZE_HINT[size]} No extra charge.</Text>
      </View>
    </View>
  );
};

// Amber text on a light fill needs a darker shade than the theme's amber.
const AMBER_TEXT = '#9A6700';

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  lineText: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },
  boxLarge: { backgroundColor: colors.warningLight },
  boxCopy: { flex: 1, minWidth: 0 },
  boxTitle: { ...typography.label, fontSize: 13, color: colors.primary },
  boxHint: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
});

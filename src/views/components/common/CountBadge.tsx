import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '@/views/styles/theme';

interface Props {
  count: number;
  /**
   * corner: pinned to the top-right of an icon (the parent must be the icon's
   * box). inline: a pill in the row, e.g. after a label.
   */
  variant?: 'corner' | 'inline';
  /** Ring colour around a corner badge, to match what is behind it. */
  ringColor?: string;
  max?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one red count badge used across the admin screens, so every
 * "something is waiting here" marker looks and sits the same.
 * Renders nothing at zero.
 */
export const CountBadge = ({ count, variant = 'corner', ringColor = colors.surface, max = 99, style }: Props) => {
  if (!count || count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.base,
        variant === 'corner' ? [styles.corner, { borderColor: ringColor }] : styles.inline,
        label.length > 1 && styles.wide,
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    zIndex: 2,
  },
  inline: {
    marginLeft: 6,
  },
  wide: {
    paddingHorizontal: 5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    includeFontPadding: false,
    textAlign: 'center',
  },
});

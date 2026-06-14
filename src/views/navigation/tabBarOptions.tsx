import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '@/views/styles/theme';

// ────────────────────────────────────────────────────────────────
// Uber-style bottom navigation bar
// Clean white surface, hairline top divider, filled icon on the
// active tab and an outline icon when inactive — black active tint,
// muted gray when inactive.
// ────────────────────────────────────────────────────────────────
export const uberTabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarActiveBackgroundColor: colors.surfaceHover,
  // Floating, rounded "pill" bar that hovers above the content.
  tabBarStyle: {
    position: 'absolute' as const,
    left: 16,
    right: 16,
    bottom: 22,
    height: 66,
    borderRadius: radius.pill,
    borderTopWidth: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 10,
    paddingTop: 0,
    paddingBottom: 0,
    ...shadows.lg,
    elevation: 14,
  },
  // Each item becomes a rounded pill; the active one gets the gray fill.
  tabBarItemStyle: {
    marginVertical: 11,
    marginHorizontal: 5,
    borderRadius: radius.pill,
  },
  tabBarLabelStyle: {
    ...fonts.poppins.medium,
    fontSize: 11,
    letterSpacing: 0.1,
    marginTop: 1,
  },
} as const;

/**
 * Builds a tabBarIcon that swaps between a filled (active) and outline
 * (inactive) glyph — the signature Uber tab interaction. Pass a single
 * name to use it for both states.
 */
export const tabIcon =
  (active: string, inactive?: string) =>
  ({ focused, color, size }: { focused: boolean; color: string; size: number }) =>
    (
      <MaterialCommunityIcons
        name={(focused ? active : inactive ?? active) as any}
        size={size + 3}
        color={color}
      />
    );

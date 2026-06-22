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
  // Always stack the label directly beneath the icon (prevents the label from
  // jumping beside the icon on wider items / larger fonts).
  tabBarLabelPosition: 'below-icon' as const,
  tabBarHideOnKeyboard: true,
  // Floating, rounded bar that hovers above the content. Sized to comfortably
  // fit an icon with its label underneath, even with 5 tabs (admin).
  tabBarStyle: {
    position: 'absolute' as const,
    left: 16,
    right: 16,
    bottom: 20,
    height: 72,
    borderRadius: 28,
    borderTopWidth: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 10,
    ...shadows.lg,
    elevation: 14,
  },
  // Each item is a rounded cell; the active one gets a soft fill behind the
  // icon+label stack.
  tabBarItemStyle: {
    marginHorizontal: 3,
    borderRadius: 18,
    paddingVertical: 4,
  },
  tabBarActiveBackgroundColor: colors.surfaceHover,
  tabBarIconStyle: {
    marginTop: 2,
  },
  tabBarLabelStyle: {
    ...fonts.poppins.medium,
    fontSize: 10.5,
    letterSpacing: 0.1,
    marginTop: 2,
    marginBottom: 0,
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
        size={size + 1}
        color={color}
      />
    );

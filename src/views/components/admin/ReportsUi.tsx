import React from 'react';
import { StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

/**
 * Shared pieces of the admin Reports and Violations screens: one responsive
 * layout (centered column, 1–2 card columns, 2×2 or 1×4 summary tiles) and
 * the summary tile / list heading / empty state they both use.
 */

/** Content never grows wider than this on tablets and desktop browsers. */
export const REPORTS_MAX_WIDTH = 1200;

export const useReportsLayout = () => {
  const { width } = useWindowDimensions();
  return {
    /** Cards side by side on tablets / desktop. */
    columns: width >= 960 ? 2 : 1,
    /** Phone width: buttons stack, labels shorten. */
    compact: width < 600,
    /** Four summary tiles in one row, else 2×2. */
    tilesInRow: width >= 560,
  };
};

export const contentFrame = {
  width: '100%' as const,
  maxWidth: REPORTS_MAX_WIDTH,
  alignSelf: 'center' as const,
};

interface TileProps {
  icon: string;
  label: string;
  value: number;
  color: string;
  bg: string;
  active: boolean;
  inRow: boolean;
  onPress: () => void;
}

/** Count tile that doubles as the list filter; tap the active one to show all. */
export const SummaryTile = ({ icon, label, value, color, bg, active, inRow, onPress }: TileProps) => (
  <TouchableOpacity
    style={[styles.tile, inRow ? styles.tileInRow : styles.tileHalf, active && { borderColor: color, backgroundColor: bg }]}
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    accessibilityLabel={`${value} ${label}${active ? ', filter on' : ''}`}
  >
    <View style={[styles.tileIcon, { backgroundColor: active ? colors.surface : bg }]}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
    </View>
    <View style={styles.tileCopy}>
      <Text style={[styles.tileValue, { color: value > 0 ? color : colors.textMuted }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
    </View>
  </TouchableOpacity>
);

export const SummaryTiles = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.tiles}>{children}</View>
);

/** "OPEN REPORTS · 4" with a Show all link while a filter is on. */
export const ListHeading = ({ title, count, filtered, onClear }: { title: string; count: number; filtered: boolean; onClear: () => void }) => (
  <View style={styles.heading}>
    <Text style={styles.headingText} numberOfLines={1}>
      {title.toUpperCase()} · {count}
    </Text>
    {filtered ? (
      <TouchableOpacity onPress={onClear} hitSlop={8} accessibilityRole="button">
        <Text style={styles.headingLink}>Show all</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

export const EmptyState = ({ icon, title, body }: { icon: string; title: string; body?: React.ReactNode }) => (
  <View style={styles.empty}>
    <View style={styles.emptyIcon}>
      <MaterialCommunityIcons name={icon as any} size={30} color={colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
  </View>
);

/** Initials avatar used on report and violation cards. */
export const Initials = ({ name, color, bg }: { name?: string | null; color: string; bg: string }) => {
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';
  return (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { color }]}>{initials}</Text>
    </View>
  );
};

/** Toolbar under the Reports / Violations tabs: title, subtitle, optional action. */
export const Toolbar = ({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) => (
  <View style={styles.toolbar}>
    <View style={styles.toolbarInner}>
      <View style={styles.toolbarCopy}>
        <Text style={styles.toolbarTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.toolbarSub} numberOfLines={1}>{subtitle}</Text>
      </View>
      {action}
    </View>
  </View>
);

/** Inside of a report / violation card, shared so both tabs look the same. */
export const recordStyles = StyleSheet.create({
  cardFill: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardNames: { flex: 1, minWidth: 0 },
  cardDriverName: { ...typography.label, fontSize: 15, color: colors.text },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  rolePill: {
    ...typography.labelSmall,
    fontSize: 10,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
    marginRight: 4,
  },
  cardDate: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: { ...typography.labelSmall, fontSize: 11 },

  violationTypeRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 2,
  },
  violationType: { ...typography.label, fontSize: 14, color: colors.text, flex: 1 },

  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  penaltyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
  penaltyText: { flexShrink: 1, ...typography.labelSmall, fontSize: 12, color: '#8A5A00' },
  flagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: colors.errorLight,
  },
  flagPillText: { ...typography.labelSmall, fontSize: 11, color: colors.error },
  sourcePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
  },
  sourcePillText: { ...typography.labelSmall, fontSize: 11, color: colors.textSecondary },

  cardFooter: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm, marginTop: 'auto' as any },
  actions: { flexDirection: 'row', gap: spacing.sm },
  dismissBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
  },
  dismissBtnText: { ...typography.label, fontSize: 13, color: colors.error, flexShrink: 1, textAlign: 'center' },
  resolveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  resolveBtnText: { ...typography.label, fontSize: 13, color: '#fff', flexShrink: 1, textAlign: 'center' },
  busyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, minHeight: 44,
  },
  busyText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  closedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  closedNote: {
    ...typography.bodySmall, fontSize: 12,
    color: colors.textMuted,
  },

  linkText: { ...typography.label, fontSize: 13, color: colors.primary },
  closedSpacer: { flex: 1 },
});

export const cardStyles = StyleSheet.create({
  // A card in the list; `columns` decides its width.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  accent: { width: 4 },
  body: { flex: 1, minWidth: 0, padding: spacing.md, gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell1: { width: '100%' },
  // Two columns: each takes half the row minus half the gap.
  cell2: { flexBasis: '48%', flexGrow: 1, maxWidth: '50%' as any, minWidth: 0 },
});

const styles = StyleSheet.create({
  toolbar: { paddingTop: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.surfaceAlt },
  toolbarInner: {
    width: '100%',
    maxWidth: REPORTS_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  toolbarCopy: { flex: 1, minWidth: 0 },
  toolbarTitle: { ...typography.label, fontSize: 15, color: colors.text },
  toolbarSub: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    minWidth: 0,
  },
  tileInRow: { flex: 1 },
  tileHalf: { flexBasis: '45%', flexGrow: 1 },
  tileIcon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tileCopy: { flex: 1, minWidth: 0 },
  tileValue: { ...typography.number, fontSize: 22, lineHeight: 26 },
  tileLabel: { ...typography.labelSmall, fontSize: 11, color: colors.textSecondary },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  headingText: { ...typography.labelSmall, fontSize: 11, letterSpacing: 1, color: colors.textSecondary, flexShrink: 1 },
  headingLink: { ...typography.label, fontSize: 13, color: colors.primary },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.h3, fontSize: 16, textAlign: 'center' },
  emptyBody: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, maxWidth: 360 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.label, fontSize: 14 },
});

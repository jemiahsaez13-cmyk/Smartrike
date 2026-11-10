/**
 * IncomeChart (B8)
 *
 * Daily / monthly / yearly income bars: peso axis with gridlines, an average
 * line, gradient bars with the selected bar's amount on top, the selected
 * period's change from the one before, and range stats (total, average,
 * best period). Tap a bar to look at that period.
 * Used for MTOP collections (admin) and trip earnings (driver).
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '@/views/components/common/Card';
import { colors, radius, spacing, typography } from '@/views/styles/theme';
import {
  IncomeEntry,
  IncomeView,
  PREVIOUS_LABEL,
  buildIncomeBuckets,
  compactPeso,
  incomeChange,
  incomeKey,
  incomeStats,
  niceCeil,
} from '@/utils/incomeUtils';

export interface IncomeBreakdownRow {
  label: string;
  amount: number;
  count: number;
}

interface Props<T extends IncomeEntry> {
  entries: T[];
  /** Singular noun for the count line: "trip", "payment". */
  countNoun: string;
  accent?: string;
  /** Optional split of the selected period (e.g. by TODA, by purpose). */
  breakdown?: (entries: T[]) => IncomeBreakdownRow[];
  breakdownTitle?: string;
  /** Shorter plot and smaller type (list screens). */
  compact?: boolean;
  style?: ViewStyle;
}

const VIEWS: Array<{ key: IncomeView; label: string }> = [
  { key: 'day', label: 'Daily' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' },
];

const UNIT: Record<IncomeView, { per: string; best: string; range: string }> = {
  day: { per: 'day', best: 'Best day', range: 'days' },
  month: { per: 'month', best: 'Best month', range: 'months' },
  year: { per: 'year', best: 'Best year', range: 'years' },
};

const PLOT_HEIGHT = 140;
const PLOT_HEIGHT_COMPACT = 92;
/** Room above the tallest bar for its amount bubble. */
const BUBBLE_ROOM = 24;
const AXIS_WIDTH = 40;

const peso = (n: number) =>
  `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** #RRGGBB + alpha (00–FF); other color formats are returned as-is. */
const withAlpha = (hex: string, alpha: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex);

export function IncomeChart<T extends IncomeEntry>({
  entries,
  countNoun,
  accent = colors.primary,
  breakdown,
  breakdownTitle = 'BREAKDOWN',
  compact = false,
  style,
}: Props<T>) {
  const [view, setView] = useState<IncomeView>('day');
  const buckets = useMemo(() => buildIncomeBuckets(entries, view), [entries, view]);
  const stats = useMemo(() => incomeStats(buckets), [buckets]);
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected ?? buckets.length - 1;
  const current = buckets[index];
  const previous = index > 0 ? buckets[index - 1] : null;

  const plotHeight = compact ? PLOT_HEIGHT_COMPACT : PLOT_HEIGHT;
  // Axis top: a round number above the tallest bar (₱100 when there is no income yet).
  const top = niceCeil(Math.max(100, ...buckets.map((b) => b.total)));
  const ticks = [top, top / 2, 0];
  const barHeight = (amount: number) => (amount > 0 ? Math.max(4, (amount / top) * plotHeight) : 0);

  const change = previous ? incomeChange(current.total, previous.total) : null;
  const up = change ? change.diff > 0 : false;
  const down = change ? change.diff < 0 : false;
  const changeColor = up ? colors.success : down ? colors.error : colors.textSecondary;
  const changeBg = up ? colors.primaryLight : down ? colors.errorLight : colors.surfaceAlt;

  const rows = useMemo(() => {
    if (!breakdown || !current) return [];
    return breakdown(entries.filter((e) => e.at && incomeKey(e.at, view) === current.key))
      .filter((row) => row.amount > 0 || row.count > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [breakdown, entries, view, current]);

  const switchView = (next: IncomeView) => {
    setView(next);
    setSelected(null);
  };

  const unit = UNIT[view];
  const gradient = [accent, withAlpha(accent, 'A6')] as const;

  return (
    <Card variant="elevated" padding={compact ? 'md' : 'lg'} style={style}>
      {/* ── Daily / Monthly / Yearly ── */}
      <View style={[styles.segment, compact && styles.segmentCompact]}>
        {VIEWS.map(({ key, label }) => {
          const active = key === view;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.segmentBtn, compact && styles.segmentBtnCompact, active && { backgroundColor: accent }]}
              onPress={() => switchView(key)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Selected period ── */}
      <View style={styles.headline}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.periodLabel} numberOfLines={1}>
            {current.label.toUpperCase()} · {plural(current.count, countNoun).toUpperCase()}
          </Text>
          <Text style={[styles.amount, compact && styles.amountCompact, typography.currency]} numberOfLines={1}>
            {peso(current.total)}
          </Text>
        </View>
        {change ? (
          <View style={[styles.changePill, { backgroundColor: changeBg }]}>
            <MaterialCommunityIcons
              name={up ? 'arrow-up-bold' : down ? 'arrow-down-bold' : 'equal'}
              size={12}
              color={changeColor}
            />
            <Text style={[styles.changePillText, { color: changeColor }]}>
              {change.diff === 0
                ? 'No change'
                : change.pct != null
                ? `${Math.abs(change.pct).toFixed(0)}%`
                : compactPeso(Math.abs(change.diff))}
            </Text>
          </View>
        ) : null}
      </View>
      {change ? (
        <Text style={styles.changeText} numberOfLines={2}>
          {change.diff === 0
            ? `Same as ${PREVIOUS_LABEL[view]} (${previous!.label})`
            : `${up ? '+' : '−'}${peso(Math.abs(change.diff))} vs ${PREVIOUS_LABEL[view]} (${previous!.label}: ${peso(previous!.total)})`}
        </Text>
      ) : null}

      {/* ── Plot: axis, gridlines, average line, bars ── */}
      <View style={[styles.plotRow, { marginTop: compact ? spacing.sm : spacing.md }]}>
        <View style={[styles.axis, { height: plotHeight + BUBBLE_ROOM }]}>
          {ticks.map((tick) => (
            <Text key={tick} style={[styles.axisLabel, { bottom: (tick / top) * plotHeight - 6 }]} numberOfLines={1}>
              {compactPeso(tick)}
            </Text>
          ))}
        </View>

        <View style={[styles.plot, { height: plotHeight + BUBBLE_ROOM }]}>
          {ticks.map((tick) => (
            <View
              key={tick}
              style={[styles.gridLine, tick === 0 && styles.gridBase, { bottom: (tick / top) * plotHeight }]}
            />
          ))}

          {stats.average > 0 ? (
            <View
              style={[styles.avgLine, { bottom: barHeight(stats.average), borderColor: withAlpha(accent, 'B3') }]}
              pointerEvents="none"
            >
              <Text style={[styles.avgLabel, { color: accent }]}>avg {compactPeso(stats.average)}</Text>
            </View>
          ) : null}

          <View style={styles.bars}>
            {buckets.map((bucket, i) => {
              const active = i === index;
              const h = barHeight(bucket.total);
              return (
                <TouchableOpacity
                  key={bucket.key}
                  style={styles.barCol}
                  onPress={() => setSelected(i)}
                  activeOpacity={0.7}
                  accessibilityLabel={`${bucket.label}: ${peso(bucket.total)}, ${plural(bucket.count, countNoun)}`}
                >
                  {active && bucket.total > 0 ? (
                    <View style={[styles.bubble, { bottom: h + 4, backgroundColor: accent }]} pointerEvents="none">
                      <Text style={styles.bubbleText} numberOfLines={1}>{compactPeso(bucket.total)}</Text>
                    </View>
                  ) : null}
                  {h > 0 ? (
                    <LinearGradient
                      colors={gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[styles.bar, { height: h, opacity: active ? 1 : 0.38 }]}
                    />
                  ) : (
                    <View style={[styles.barEmpty, active && { backgroundColor: withAlpha(accent, '66') }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── X labels ── */}
      <View style={styles.xLabels}>
        {buckets.map((bucket, i) => (
          <TouchableOpacity key={bucket.key} style={styles.xLabelCol} onPress={() => setSelected(i)} activeOpacity={0.7}>
            <Text
              style={[styles.xLabel, i === index && { color: accent, fontWeight: '800' }]}
              numberOfLines={1}
            >
              {i === buckets.length - 1 && view === 'day' ? 'Today' : bucket.shortLabel}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Range stats ── */}
      <View style={[styles.statsRow, compact && { marginTop: spacing.sm }]}>
        <Stat
          compact={compact}
          icon="sigma"
          accent={accent}
          label={`Last ${buckets.length} ${unit.range}`}
          value={peso(stats.total)}
          sub={plural(stats.count, countNoun)}
        />
        <Stat
          compact={compact}
          icon="chart-line-variant"
          accent={accent}
          label={`Avg / ${unit.per}`}
          value={peso(stats.average)}
          sub={`${stats.activeBuckets} of ${buckets.length} with income`}
        />
        <Stat
          compact={compact}
          icon="trophy-outline"
          accent={accent}
          label={unit.best}
          value={stats.best ? peso(stats.best.total) : '—'}
          sub={stats.best ? stats.best.label : 'No income yet'}
          onPress={stats.best ? () => setSelected(buckets.indexOf(stats.best!)) : undefined}
        />
      </View>

      {/* ── Breakdown of the selected period ── */}
      {breakdown && rows.length > 0 ? (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>{breakdownTitle} · {current.label.toUpperCase()}</Text>
          {rows.map((row) => {
            const share = current.total > 0 ? (row.amount / current.total) * 100 : 0;
            return (
              <View key={row.label} style={styles.breakdownRow}>
                <View style={styles.breakdownCopy}>
                  <View style={styles.breakdownHead}>
                    <Text style={styles.breakdownLabel} numberOfLines={1}>{row.label}</Text>
                    <Text style={styles.breakdownShare}>{share.toFixed(0)}%</Text>
                  </View>
                  <View style={styles.breakdownTrack}>
                    <LinearGradient
                      colors={gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.breakdownFill, { width: `${share}%` }]}
                    />
                  </View>
                </View>
                <View style={styles.breakdownValues}>
                  <Text style={styles.breakdownAmount}>{peso(row.amount)}</Text>
                  <Text style={styles.breakdownCount}>{plural(row.count, countNoun)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const Stat = ({
  icon,
  label,
  value,
  sub,
  accent,
  compact,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  accent: string;
  compact: boolean;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    style={[styles.stat, compact && styles.statCompact]}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.75}
  >
    <View style={styles.statHead}>
      <MaterialCommunityIcons name={icon as any} size={12} color={accent} />
      <Text style={styles.statLabel} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
    <Text style={[styles.statValue, compact && { fontSize: 13 }]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text style={styles.statSub} numberOfLines={1}>{sub}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.md,
  },
  segmentCompact: { marginBottom: spacing.sm },
  segmentBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnCompact: { minHeight: 30 },
  segmentText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  segmentTextActive: { color: '#fff' },

  headline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  periodLabel: { ...typography.labelSmall, fontSize: 10, letterSpacing: 1.2, color: colors.textMuted },
  amount: { ...typography.h1, fontSize: 30, color: colors.text, marginTop: 2 },
  amountCompact: { fontSize: 22, marginTop: 0 },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  changePillText: { ...typography.label, fontSize: 12, fontWeight: '800' },
  changeText: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  plotRow: { flexDirection: 'row' },
  axis: { width: AXIS_WIDTH },
  axisLabel: {
    ...typography.labelSmall,
    position: 'absolute',
    left: 0,
    right: 6,
    fontSize: 9,
    color: colors.textLight,
    textAlign: 'right',
  },
  plot: { flex: 1, position: 'relative' },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  gridBase: { backgroundColor: colors.border },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    zIndex: 4, // over the bars so the label stays readable
  },
  avgLabel: {
    ...typography.labelSmall,
    position: 'absolute',
    right: 0,
    bottom: 1,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bars: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    zIndex: 2,
  },
  barCol: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0 },
  bar: {
    width: '72%',
    maxWidth: 28,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  barEmpty: { width: '72%', maxWidth: 28, height: 2, borderRadius: 1, backgroundColor: colors.border },
  bubble: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
    zIndex: 3,
  },
  bubbleText: { ...typography.labelSmall, fontSize: 10, fontWeight: '800', color: '#fff' },

  xLabels: { flexDirection: 'row', marginLeft: AXIS_WIDTH, gap: 4, marginTop: 6 },
  xLabelCol: { flex: 1, alignItems: 'center', minWidth: 0, minHeight: 20, justifyContent: 'center' },
  xLabel: { ...typography.labelSmall, fontSize: 9, color: colors.textMuted },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat: {
    flex: 1,
    minWidth: 0,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  statCompact: { paddingVertical: 6 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statLabel: { ...typography.labelSmall, fontSize: 8, letterSpacing: 0.6, color: colors.textMuted, flexShrink: 1 },
  statValue: { ...typography.label, fontSize: 14, color: colors.text, marginTop: 3 },
  statSub: { ...typography.bodySmall, fontSize: 10, color: colors.textSecondary },

  breakdown: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  breakdownTitle: { ...typography.labelSmall, fontSize: 10, letterSpacing: 1.5, color: colors.textMuted, marginBottom: spacing.xs },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  breakdownCopy: { flex: 1, minWidth: 0 },
  breakdownHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  breakdownLabel: { ...typography.label, fontSize: 13, color: colors.text, flexShrink: 1 },
  breakdownShare: { ...typography.labelSmall, fontSize: 11, color: colors.textSecondary },
  breakdownTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, marginTop: 4, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 4 },
  breakdownValues: { alignItems: 'flex-end', minWidth: 84 },
  breakdownAmount: { ...typography.label, fontSize: 13, color: colors.text },
  breakdownCount: { ...typography.bodySmall, fontSize: 11, color: colors.textSecondary },
});

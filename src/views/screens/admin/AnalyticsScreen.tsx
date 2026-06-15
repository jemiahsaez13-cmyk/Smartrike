import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, SafeAreaView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '@/views/components/common/Card';
import { colors, gradients, radius, shadows, spacing, typography } from '@/views/styles/theme';

const PERIODS = ['Daily', 'Weekly', 'Monthly'] as const;
type Period = typeof PERIODS[number];

const METRICS: Record<Period, { revenue: string; trips: string; drivers: string; avgFare: string; topZone: string }> = {
  Daily: { revenue: '₱12,450', trips: '342', drivers: '38', avgFare: '₱54.20', topZone: 'Boac Market' },
  Weekly: { revenue: '₱78,900', trips: '2,140', drivers: '45', avgFare: '₱52.80', topZone: 'Boac Market' },
  Monthly: { revenue: '₱312,600', trips: '8,780', drivers: '52', avgFare: '₱55.10', topZone: 'MSC Tanza Gate' },
};

const DAILY_BARS = [38, 55, 72, 45, 80, 60, 90];
const WEEKLY_BARS = [310, 420, 380, 500, 290, 450, 520];
const MONTHLY_BARS = [2800, 3200, 2600, 3500, 3100, 2900, 3700];

const BAR_LABELS: Record<Period, string[]> = {
  Daily: ['8h', '10h', '12h', '14h', '16h', '18h', '20h'],
  Weekly: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  Monthly: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
};

const TOP_ROUTES = [
  { from: 'Boac Market', to: 'Town Plaza', trips: 892, pct: 82 },
  { from: 'Terminal', to: 'MSC Tanza', trips: 654, pct: 60 },
  { from: 'Provincial Hospital', to: 'Boac Market', trips: 510, pct: 47 },
  { from: 'MSC Tanza', to: 'Boac Market', trips: 430, pct: 40 },
];

const DRIVER_PERF = [
  { name: 'Juan Dela Cruz', trips: 148, rating: 4.9, earnings: '₱8,240' },
  { name: 'Pedro Santos', trips: 132, rating: 4.8, earnings: '₱7,680' },
  { name: 'Roberto Reyes', trips: 121, rating: 4.7, earnings: '₱6,950' },
];

export const AnalyticsScreen = () => {
  const navigation = useNavigation<any>();
  const [period, setPeriod] = useState<Period>('Daily');
  const metrics = METRICS[period];
  const bars = period === 'Daily' ? DAILY_BARS : period === 'Weekly' ? WEEKLY_BARS : MONTHLY_BARS;
  const maxBar = Math.max(...bars);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={gradients.admin}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Analytics & Reports</Text>
          <Text style={styles.headerSub}>FEDTODAB Performance Overview</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Period Toggle */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, p === period && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.8}
            >
              <Text style={[styles.periodText, p === period && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* KPI Row */}
        <View style={styles.kpiRow}>
          {[
            { label: 'Revenue', value: metrics.revenue, icon: 'cash-multiple', color: colors.secondary },
            { label: 'Trips', value: metrics.trips, icon: 'routes', color: colors.accent },
            { label: 'Drivers', value: metrics.drivers, icon: 'car-hatchback', color: colors.primary },
            { label: 'Avg Fare', value: metrics.avgFare, icon: 'tag', color: colors.warning },
          ].map(kpi => (
            <Card key={kpi.label} variant="elevated" padding="md" style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: kpi.color + '15' }]}>
                <MaterialCommunityIcons name={kpi.icon as any} size={18} color={kpi.color} />
              </View>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </Card>
          ))}
        </View>

        {/* Volume Chart */}
        <Text style={styles.sectionLabel}>TRIP VOLUME</Text>
        <Card variant="elevated" padding="lg" style={styles.chartCard}>
          <View style={styles.chartBars}>
            {bars.map((h, idx) => (
              <View key={idx} style={styles.barCol}>
                <View style={[styles.barTrack, { height: 100 }]}>
                  <View style={[styles.barFill, { height: `${(h / maxBar) * 100}%` }]} />
                </View>
                <Text style={styles.barLabel}>{BAR_LABELS[period][idx]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.chartFooter}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Trip Volume · {period}</Text>
          </View>
        </Card>

        {/* Top Routes */}
        <Text style={styles.sectionLabel}>TOP ROUTES</Text>
        <Card variant="elevated" padding="none" style={styles.routeCard}>
          {TOP_ROUTES.map((route, idx) => (
            <View key={idx} style={[styles.routeRow, idx < TOP_ROUTES.length - 1 && styles.routeRowBorder]}>
              <View style={styles.routeInfo}>
                <Text style={styles.routeName}>{route.from} → {route.to}</Text>
                <Text style={styles.routeTrips}>{route.trips} trips</Text>
              </View>
              <View style={styles.routeBarWrap}>
                <View style={styles.routeBarTrack}>
                  <View style={[styles.routeBarFill, { width: `${route.pct}%` }]} />
                </View>
                <Text style={styles.routePct}>{route.pct}%</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Top Drivers */}
        <Text style={styles.sectionLabel}>TOP DRIVERS</Text>
        <Card variant="elevated" padding="none" style={styles.driverCard}>
          {DRIVER_PERF.map((driver, idx) => (
            <View key={idx} style={[styles.driverRow, idx < DRIVER_PERF.length - 1 && styles.routeRowBorder]}>
              <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? colors.warning : colors.surfaceAlt }]}>
                <Text style={[styles.rankText, { color: idx === 0 ? '#fff' : colors.textSecondary }]}>#{idx + 1}</Text>
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{driver.name}</Text>
                <View style={styles.driverMeta}>
                  <MaterialCommunityIcons name="star" size={12} color={colors.warning} />
                  <Text style={styles.driverMetaText}>{driver.rating} · {driver.trips} trips</Text>
                </View>
              </View>
              <Text style={[styles.driverEarnings, typography.currency]}>{driver.earnings}</Text>
            </View>
          ))}
        </Card>

        {/* Top Zone */}
        <Card variant="elevated" padding="lg" style={styles.zoneCard}>
          <View style={styles.zoneRow}>
            <View style={[styles.zoneIcon, { backgroundColor: colors.successLight }]}>
              <MaterialCommunityIcons name="map-marker-radius" size={28} color={colors.success} />
            </View>
            <View style={styles.zoneInfo}>
              <Text style={styles.zoneLabel}>HIGHEST DEMAND ZONE</Text>
              <Text style={styles.zoneName}>{metrics.topZone}</Text>
              <Text style={styles.zoneSub}>Peak hours: 7–9 AM and 5–7 PM</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: spacing.screen,
    paddingTop: 40,
    paddingBottom: spacing.xl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...typography.h2, color: '#fff', fontSize: 22 },
  headerSub: { ...typography.bodySmall, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  content: { padding: spacing.screen, paddingBottom: 100 },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.xl,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  periodBtnActive: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  periodText: { ...typography.label, color: colors.textSecondary, fontSize: 13 },
  periodTextActive: { color: '#fff' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: spacing.xl },
  kpiCard: { width: '47.5%', alignItems: 'flex-start' },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  kpiValue: { ...typography.h3, color: colors.text, fontSize: 20 },
  kpiLabel: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 4,
  },
  chartCard: { marginBottom: spacing.xl },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 110,
    marginBottom: 12,
  },
  barCol: { alignItems: 'center', flex: 1 },
  barTrack: {
    width: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  barLabel: { ...typography.labelSmall, color: colors.textLight, fontSize: 9, marginTop: 6 },
  chartFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.bodySmall, color: colors.textSecondary },
  routeCard: { marginBottom: spacing.xl, overflow: 'hidden' },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  routeRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  routeInfo: { flex: 1 },
  routeName: { ...typography.label, color: colors.text, fontSize: 13 },
  routeTrips: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  routeBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 120 },
  routeBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  routeBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  routePct: { ...typography.labelSmall, color: colors.textSecondary, width: 32, textAlign: 'right' },
  driverCard: { marginBottom: spacing.xl, overflow: 'hidden' },
  driverRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: { ...typography.label, fontSize: 12, fontWeight: '800' },
  driverInfo: { flex: 1 },
  driverName: { ...typography.label, color: colors.text, fontSize: 14 },
  driverMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  driverMetaText: { ...typography.bodySmall, color: colors.textSecondary },
  driverEarnings: { ...typography.label, color: colors.secondary, fontSize: 14 },
  zoneCard: { marginBottom: spacing.xl },
  zoneRow: { flexDirection: 'row', alignItems: 'center' },
  zoneIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  zoneInfo: { flex: 1 },
  zoneLabel: { ...typography.labelSmall, color: colors.textMuted, fontSize: 9, letterSpacing: 1.5 },
  zoneName: { ...typography.h3, color: colors.text, marginTop: 2 },
  zoneSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
});

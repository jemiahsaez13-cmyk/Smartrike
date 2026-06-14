import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, SafeAreaView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors, gradients, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

const kpiData = [
  { id: '1', title: 'Total Revenue', value: '₱45,230', trend: '+12.5%', isPositive: true, icon: 'cash-multiple' },
  { id: '2', title: 'Active Drivers', value: '42', trend: '+4', isPositive: true, icon: 'car-hatchback' },
  { id: '3', title: 'Completed Trips', value: '1,284', trend: '+8.2%', isPositive: true, icon: 'check-circle-outline' },
  { id: '4', title: 'Avg. Wait Time', value: '4.2m', trend: '-1.5m', isPositive: true, icon: 'timer-outline' },
];

const recentActivity = [
  { id: '1', action: 'System Alert', details: 'High demand in Boac Market area', time: '2 mins ago', type: 'alert' },
  { id: '2', action: 'Driver Onboarded', details: 'Juan Dela Cruz (Plate: XYZ-123) verified', time: '15 mins ago', type: 'success' },
  { id: '3', action: 'Trip Cancelled', details: 'User cancelled booking #1029', time: '45 mins ago', type: 'warning' },
];

const operationalQueue = [
  { id: '1', title: '3 driver renewals need MTOP review', level: 'Compliance', icon: 'shield-alert-outline', color: colors.warning },
  { id: '2', title: 'Market zone queue exceeded 10 minutes', level: 'Dispatch', icon: 'map-clock-outline', color: colors.coral },
  { id: '3', title: '2 cancelled trips require audit', level: 'Support', icon: 'clipboard-search-outline', color: colors.secondary },
];

export const AdminDashboard = () => {
  const navigation = useNavigation<any>();

  const KPICard = ({ item }: { item: typeof kpiData[0] }) => (
    <Card variant="elevated" padding="md" style={styles.kpiCard}>
      <View style={styles.kpiHeader}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.primary} />
        </View>
        <View style={[styles.trendBadge, { backgroundColor: item.isPositive ? colors.successLight : colors.errorLight }]}>
          <MaterialCommunityIcons
            name={item.isPositive ? 'arrow-up-right' : 'arrow-down-right'}
            size={12}
            color={item.isPositive ? colors.success : colors.error}
          />
          <Text style={[styles.trendText, { color: item.isPositive ? colors.success : colors.error }]}>
            {item.trend}
          </Text>
        </View>
      </View>
      <Text style={[styles.kpiValue, typography.currency]}>{item.value}</Text>
      <Text style={styles.kpiTitle}>{item.title}</Text>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={gradients.admin} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Command Center</Text>
            <View style={styles.liveIndicatorRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live data syncing</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('UserManagement')}
            activeOpacity={0.76}
          >
            <MaterialCommunityIcons name="account-group-outline" size={21} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>PLATFORM PERFORMANCE</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.seeAllText}>Reports</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {kpiData.map(item => <KPICard key={item.id} item={item} />)}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>VOLUME OVERVIEW</Text>
          </View>
          <Card variant="elevated" padding="lg" style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={[styles.chartTotal, typography.number]}>342</Text>
                <Text style={styles.chartSubtitle}>Total rides completed today</Text>
              </View>
              <View style={styles.chartBadge}>
                <MaterialCommunityIcons name="trending-up" size={14} color={colors.success} />
                <Text style={styles.chartBadgeText}>HEALTHY</Text>
              </View>
            </View>
            <View style={styles.chartBars}>
              {[40, 60, 45, 80, 50, 70, 90].map((barHeight, idx) => (
                <View key={idx} style={styles.barColumn}>
                  <View style={[styles.barTrack, { height: 100 }]}>
                    <View style={[styles.bar, { height: `${barHeight}%` }]} />
                  </View>
                  <Text style={styles.barLabel}>{idx * 2 + 8}h</Text>
                </View>
              ))}
            </View>
          </Card>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>OPERATIONS QUEUE</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('UserManagement')}>
              <Text style={styles.seeAllText}>Manage</Text>
            </TouchableOpacity>
          </View>
          <Card variant="elevated" padding="none" style={styles.queueCard}>
            {operationalQueue.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity style={styles.queueItem} activeOpacity={0.76}>
                  <View style={[styles.queueIcon, { backgroundColor: `${item.color}12` }]}>
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <View style={styles.queueCopy}>
                    <Text style={styles.queueTitle}>{item.title}</Text>
                    <Text style={styles.queueLevel}>{item.level}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
                </TouchableOpacity>
                {index < operationalQueue.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </Card>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>RECENT SYSTEM ACTIVITY</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('ActivityLogs')}>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <Card variant="elevated" padding="none" style={styles.logCard}>
            {recentActivity.map((log, index) => {
              const statusColor = log.type === 'success' ? colors.success : log.type === 'alert' ? colors.warning : colors.error;
              const statusBg = log.type === 'success' ? colors.successLight : log.type === 'alert' ? colors.warningLight : colors.errorLight;
              return (
                <View key={log.id}>
                  <View style={styles.logItem}>
                    <View style={[styles.logIndicator, { backgroundColor: statusBg }]}>
                      <View style={[styles.logDot, { backgroundColor: statusColor }]} />
                    </View>
                    <View style={styles.logContent}>
                      <View style={styles.logTitleRow}>
                        <Text style={styles.logAction}>{log.action}</Text>
                        <Text style={styles.logTime}>{log.time}</Text>
                      </View>
                      <Text style={styles.logDetails}>{log.details}</Text>
                    </View>
                  </View>
                  {index < recentActivity.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: 40,
    paddingBottom: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h1,
    color: '#FFFFFF',
    fontSize: 28,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 8,
  },
  liveText: {
    ...typography.labelSmall,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    letterSpacing: 1,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  body: {
    marginTop: -20,
    paddingHorizontal: spacing.screen,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: spacing.xl,
  },
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  seeAllText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  kpiCard: {
    width: '47.5%',
    minHeight: 130,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  trendText: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 2,
  },
  kpiValue: {
    ...typography.h2,
    color: colors.text,
    fontSize: 24,
  },
  kpiTitle: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chartCard: {
    marginBottom: spacing.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  chartTotal: {
    ...typography.h1,
    color: colors.text,
    fontSize: 34,
  },
  chartSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successLight,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chartBadgeText: {
    ...typography.labelSmall,
    color: colors.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  barColumn: {
    alignItems: 'center',
    width: 30,
  },
  barTrack: {
    width: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  barLabel: {
    ...typography.labelSmall,
    color: colors.textLight,
    fontSize: 9,
    marginTop: 8,
  },
  queueCard: {
    marginBottom: spacing.sm,
  },
  queueItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  queueIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  queueCopy: {
    flex: 1,
  },
  queueTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 14,
  },
  queueLevel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  logCard: {
    marginBottom: spacing.sm,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  logIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logContent: {
    flex: 1,
  },
  logTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  logAction: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
  },
  logTime: {
    ...typography.bodySmall,
    color: colors.textLight,
    fontSize: 11,
  },
  logDetails: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
});

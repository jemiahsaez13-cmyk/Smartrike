import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors, gradients, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

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
    <Surface style={styles.kpiCard} elevation={1}>
      <View style={styles.kpiHeader}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={item.icon as any} size={22} color={colors.primary} />
        </View>
        <View style={[styles.trendBadge, { backgroundColor: item.isPositive ? colors.successLight : colors.errorLight }]}>
          <MaterialCommunityIcons
            name={item.isPositive ? 'arrow-up-right' : 'arrow-down-right'}
            size={13}
            color={item.isPositive ? colors.success : colors.error}
          />
          <Text style={[styles.trendText, { color: item.isPositive ? colors.success : colors.error }]}>
            {item.trend}
          </Text>
        </View>
      </View>
      <Text style={[styles.kpiValue, typography.currency]}>{item.value}</Text>
      <Text style={styles.kpiTitle}>{item.title}</Text>
    </Surface>
  );

  return (
    <View style={styles.container}>
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
          accessibilityLabel="Open user management"
        >
          <MaterialCommunityIcons name="account-group-outline" size={21} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.seeAllText}>Reports</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.grid}>
          {kpiData.map(item => <KPICard key={item.id} item={item} />)}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trips Today</Text>
        </View>
        <Surface style={styles.chartCard} elevation={1}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTotal}>342</Text>
              <Text style={styles.chartSubtitle}>Total rides completed</Text>
            </View>
            <View style={styles.chartBadge}>
              <MaterialCommunityIcons name="trending-up" size={16} color={colors.success} />
              <Text style={styles.chartBadgeText}>Healthy</Text>
            </View>
          </View>
          <View style={styles.chartBars} accessibilityLabel="Trips by time of day">
            {[40, 60, 45, 80, 50, 70, 90].map((barHeight, idx) => (
              <View key={idx} style={styles.barColumn}>
                <View style={[styles.barTrack, { height: 112 }]}>
                  <View style={[styles.bar, { height: `${barHeight}%` }]} />
                </View>
                <Text style={styles.barLabel}>{idx * 2 + 8}h</Text>
              </View>
            ))}
          </View>
        </Surface>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Operations Queue</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('UserManagement')}>
            <Text style={styles.seeAllText}>Manage</Text>
          </TouchableOpacity>
        </View>
        <Surface style={styles.queueCard} elevation={1}>
          {operationalQueue.map((item, index) => (
            <View key={item.id}>
              <TouchableOpacity style={styles.queueItem} activeOpacity={0.76}>
                <View style={[styles.queueIcon, { backgroundColor: `${item.color}18` }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.queueCopy}>
                  <Text style={styles.queueTitle}>{item.title}</Text>
                  <Text style={styles.queueLevel}>{item.level}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textLight} />
              </TouchableOpacity>
              {index < operationalQueue.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </Surface>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        <Surface style={styles.logCard} elevation={1}>
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
        </Surface>
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  headerTitle: {
    ...typography.display,
    color: '#FFFFFF',
    fontSize: 25,
    letterSpacing: 0,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  liveText: {
    ...typography.label,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  body: {
    padding: spacing.lg,
    paddingBottom: 130,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 17,
    letterSpacing: 0,
  },
  seeAllText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  kpiCard: {
    width: '47.8%',
    minHeight: 142,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 2,
  },
  kpiValue: {
    ...typography.number,
    color: colors.text,
    fontSize: 24,
    letterSpacing: 0,
  },
  kpiTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  chartTotal: {
    ...typography.number,
    color: colors.text,
    fontSize: 34,
    letterSpacing: 0,
  },
  chartSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
  },
  chartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chartBadgeText: {
    ...typography.label,
    color: colors.success,
    fontSize: 12,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  barColumn: {
    alignItems: 'center',
    width: 32,
  },
  barTrack: {
    width: 14,
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
    ...typography.label,
    color: colors.textLight,
    fontSize: 10,
    marginTop: spacing.sm,
  },
  queueCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  queueItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  queueIcon: {
    width: 42,
    height: 42,
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
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  logCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  logIndicator: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
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
    marginBottom: 4,
    gap: spacing.sm,
  },
  logAction: {
    ...typography.subtitle,
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  logTime: {
    ...typography.body,
    color: colors.textLight,
    fontSize: 11,
  },
  logDetails: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 42,
  },
});

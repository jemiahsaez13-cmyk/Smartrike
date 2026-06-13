import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Mock data for analytics
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

export const AdminDashboard = () => {
  const KPICard = ({ item }: { item: typeof kpiData[0] }) => (
    <Surface style={styles.kpiCard} elevation={1}>
      <View style={styles.kpiHeader}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.primary} />
        </View>
        <View style={[styles.trendBadge, { backgroundColor: item.isPositive ? '#DCFCE7' : '#FEE2E2' }]}>
          <MaterialCommunityIcons 
            name={item.isPositive ? 'arrow-up-right' : 'arrow-down-right'} 
            size={12} 
            color={item.isPositive ? '#166534' : '#991B1B'} 
          />
          <Text style={[styles.trendText, { color: item.isPositive ? '#166534' : '#991B1B' }]}>
            {item.trend}
          </Text>
        </View>
      </View>
      <Text style={styles.kpiValue}>{item.value}</Text>
      <Text style={styles.kpiTitle}>{item.title}</Text>
    </Surface>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>System Overview</Text>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live Data Syncing</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.actionBtn}>
          <MaterialCommunityIcons name="export-variant" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* KPI Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
          <TouchableOpacity><Text style={styles.seeAllText}>Reports</Text></TouchableOpacity>
        </View>
        <View style={styles.grid}>
          {kpiData.map(item => <KPICard key={item.id} item={item} />)}
        </View>

        {/* Operational Chart Placeholder */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trips Overview (Today)</Text>
        </View>
        <Surface style={styles.chartCard} elevation={1}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTotal}>342</Text>
            <Text style={styles.chartSubtitle}>Total rides today</Text>
          </View>
          {/* Minimalist Bar Chart Representation */}
          <View style={styles.chartBars}>
            {[40, 60, 45, 80, 50, 70, 90].map((height, idx) => (
              <View key={idx} style={styles.barColumn}>
                <View style={[styles.bar, { height: `${height}%` }]} />
                <Text style={styles.barLabel}>{idx * 2 + 8}h</Text>
              </View>
            ))}
          </View>
        </Surface>

        {/* Audit Log / Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Activity Log & Audit Trail</Text>
          <TouchableOpacity><Text style={styles.seeAllText}>View All</Text></TouchableOpacity>
        </View>
        <Surface style={styles.logCard} elevation={1}>
          {recentActivity.map((log, index) => (
            <View key={log.id}>
              <View style={styles.logItem}>
                <View style={[
                  styles.logIndicator, 
                  { backgroundColor: log.type === 'alert' ? '#FEF08A' : log.type === 'success' ? '#DCFCE7' : '#FEE2E2' }
                ]}>
                  <View style={[
                    styles.logDot, 
                    { backgroundColor: log.type === 'alert' ? '#D97706' : log.type === 'success' ? '#16A34A' : '#DC2626' }
                  ]} />
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
          ))}
        </Surface>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: spacing.lg, 
    paddingTop: 60, 
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  liveIndicatorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 6 },
  liveText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  actionBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  seeAllText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  kpiCard: { 
    width: (width - spacing.lg * 2 - spacing.md) / 2, 
    backgroundColor: colors.surface, 
    borderRadius: 16, 
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  iconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  trendBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12 },
  trendText: { fontSize: 10, fontWeight: '700', marginLeft: 2 },
  kpiValue: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  kpiTitle: { fontSize: 12, color: colors.textSecondary, fontWeight: '500', marginTop: 2 },
  chartCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.borderLight },
  chartHeader: { marginBottom: spacing.lg },
  chartTotal: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  chartSubtitle: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, paddingTop: 20 },
  barColumn: { alignItems: 'center', width: 30 },
  bar: { width: 12, backgroundColor: colors.primary, borderRadius: 6, opacity: 0.8 },
  barLabel: { fontSize: 10, color: colors.textLight, marginTop: 8, fontWeight: '600' },
  logCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  logItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm },
  logIndicator: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md, marginTop: 2 },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logContent: { flex: 1 },
  logTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  logAction: { fontSize: 14, fontWeight: '700', color: colors.text },
  logTime: { fontSize: 11, color: colors.textLight, fontWeight: '500' },
  logDetails: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginLeft: 40 }
});

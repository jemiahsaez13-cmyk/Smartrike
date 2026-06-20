import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, SafeAreaView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AdminService } from '@/models/services/AdminService';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

const adminService = new AdminService();

interface HealthMetric {
  name: string;
  value: string;
  status: 'healthy' | 'warning' | 'critical';
  icon: string;
  description: string;
}

export const SystemHealthScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [reachable, setReachable] = useState(true);
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);

  const load = useCallback(async () => {
    try {
      const h = await adminService.getHealth();
      setReachable(h.reachable);
      const latencyStatus: HealthMetric['status'] =
        h.latency < 400 ? 'healthy' : h.latency < 1000 ? 'warning' : 'critical';
      setMetrics([
        { name: 'API Response Time', value: `${h.latency}ms`, status: latencyStatus, icon: 'flash', description: 'Live database round-trip' },
        { name: 'Backend Status', value: h.reachable ? 'Online' : 'Down', status: h.reachable ? 'healthy' : 'critical', icon: 'server', description: 'Supabase connection' },
        { name: 'Active Users', value: `${h.activeUsers}`, status: 'healthy', icon: 'account-group', description: 'Accounts in good standing' },
        { name: 'Active Drivers', value: `${h.activeDrivers}`, status: 'healthy', icon: 'car', description: 'Online or on a trip' },
        { name: 'Total Bookings', value: `${h.totalBookings}`, status: 'healthy', icon: 'map-marker-path', description: `${h.completedTrips} completed` },
        { name: 'Pending MTOP', value: `${h.pendingFranchises}`, status: h.pendingFranchises > 0 ? 'warning' : 'healthy', icon: 'card-account-details', description: 'Franchises awaiting review' },
      ]);
    } catch (e) {
      console.error('Health load failed:', e);
      setReachable(false);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return colors.success;
      case 'warning': return colors.warning;
      case 'critical': return colors.error;
      default: return colors.textLight;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Platform Health</Text>
        <View style={[styles.statusIndicator, !reachable && { backgroundColor: colors.errorLight }]}>
          <View style={[styles.statusDot, { backgroundColor: reachable ? colors.success : colors.error }]} />
          <Text style={[styles.statusText, !reachable && { color: colors.error }]}>
            {reachable ? 'ALL SYSTEMS OPERATIONAL' : 'CONNECTION ISSUE'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.sectionLabel}>REAL-TIME METRICS</Text>
        <View style={styles.grid}>
          {metrics.map((metric, index) => (
            <Card key={index} variant="elevated" padding="md" style={styles.metricCard}>
              <View style={[styles.iconBox, { backgroundColor: getStatusColor(metric.status) + '10' }]}>
                <MaterialCommunityIcons
                  name={metric.icon as any}
                  size={22}
                  color={getStatusColor(metric.status)}
                />
              </View>
              <Text style={[styles.metricValue, typography.number]}>{metric.value}</Text>
              <Text style={styles.metricName}>{metric.name}</Text>
              <Text style={styles.metricDesc}>{metric.description}</Text>
              <View style={[styles.statusBar, { backgroundColor: getStatusColor(metric.status) }]} />
            </Card>
          ))}
        </View>

        <Card variant="outlined" padding="md" style={styles.infoCard}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.info} />
          <Text style={styles.infoText}>
            Live metrics from the database. Pull down to refresh.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  headerTitle: { 
    ...typography.h1,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  statusIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  statusDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    marginRight: 8 
  },
  statusText: { 
    ...typography.labelSmall,
    fontSize: 10, 
    color: colors.success,
    fontWeight: '800',
    letterSpacing: 1,
  },
  content: { 
    flex: 1 
  },
  scrollContent: { 
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
    fontSize: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  metricCard: {
    width: '47%',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 140,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  metricValue: {
    ...typography.h2,
    fontSize: 22,
    color: colors.text,
    marginBottom: 2
  },
  metricName: {
    ...typography.label,
    fontSize: 13,
    color: colors.text,
    marginBottom: 4
  },
  metricDesc: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textLight,
    lineHeight: 14
  },
  statusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderLight,
  },
  infoText: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  }
});

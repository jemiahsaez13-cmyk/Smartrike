import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '@/views/styles/theme';

interface HealthMetric {
  name: string;
  value: string;
  status: 'healthy' | 'warning' | 'critical';
  icon: string;
  description: string;
}

export const SystemHealthScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<HealthMetric[]>([
    { name: 'API Response Time', value: '45ms', status: 'healthy', icon: 'flash', description: 'Average API latency' },
    { name: 'Active Users', value: '1,247', status: 'healthy', icon: 'account-group', description: 'Currently online' },
    { name: 'System Uptime', value: '99.8%', status: 'healthy', icon: 'server', description: 'Last 30 days' },
    { name: 'Error Rate', value: '0.02%', status: 'healthy', icon: 'alert-circle', description: 'Last 24 hours' },
    { name: 'Database Load', value: '42%', status: 'healthy', icon: 'database', description: 'Current utilization' },
    { name: 'Active Drivers', value: '89', status: 'healthy', icon: 'car', description: 'Currently online' },
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => setRefreshing(false), 1000);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>System Health</Text>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
          <Text style={styles.statusText}>All Systems Operational</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.grid}>
          {metrics.map((metric, index) => (
            <Surface key={index} style={styles.metricCard} elevation={1}>
              <View style={[styles.iconBox, { backgroundColor: getStatusColor(metric.status) + '20' }]}>
                <MaterialCommunityIcons
                  name={metric.icon as any}
                  size={24}
                  color={getStatusColor(metric.status)}
                />
              </View>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricName}>{metric.name}</Text>
              <Text style={styles.metricDesc}>{metric.description}</Text>
              <View style={[styles.statusBar, { backgroundColor: getStatusColor(metric.status) }]} />
            </Surface>
          ))}
        </View>

        <Surface style={styles.infoCard} elevation={1}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.info} />
          <Text style={styles.infoText}>
            Metrics are updated every 60 seconds. Pull down to refresh manually.
          </Text>
        </Surface>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  statusIndicator: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  statusText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  content: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  metricCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    position: 'relative',
    overflow: 'hidden'
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs
  },
  metricName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs
  },
  metricDesc: {
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
    backgroundColor: colors.info + '10',
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.info + '30'
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18
  }
});

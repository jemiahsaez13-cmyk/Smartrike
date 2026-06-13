import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Surface, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import { ActivityLog } from '@/models/entities/ActivityLog';
import { ExportService } from '@/models/services/ExportService';
import { colors, spacing } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';

export const ActivityLogsScreen = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [severityFilter, logs]);

  const loadLogs = async () => {
    try {
      const data = await ActivityLogService.getRecentLogs(100);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    if (severityFilter === 'all') {
      setFilteredLogs(logs);
    } else {
      setFilteredLogs(logs.filter(log => log.severity === severityFilter));
    }
  };

  const handleExport = async () => {
    try {
      await ExportService.exportLogsToCSV(filteredLogs);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return colors.success;
      case 'warning': return colors.warning;
      case 'error': return colors.error;
      default: return colors.info;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'booking_created': return 'plus-circle';
      case 'booking_completed': return 'check-circle';
      case 'booking_cancelled': return 'close-circle';
      case 'driver_status_changed': return 'car-settings';
      case 'system_alert': return 'alert';
      default: return 'information';
    }
  };

  if (loading) return <Loading message="Loading activity logs..." />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity Logs</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <MaterialCommunityIcons name="download" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filters}>
          <Chip selected={severityFilter === 'all'} onPress={() => setSeverityFilter('all')}>
            All
          </Chip>
          <Chip selected={severityFilter === 'info'} onPress={() => setSeverityFilter('info')}>
            Info
          </Chip>
          <Chip selected={severityFilter === 'success'} onPress={() => setSeverityFilter('success')}>
            Success
          </Chip>
          <Chip selected={severityFilter === 'warning'} onPress={() => setSeverityFilter('warning')}>
            Warning
          </Chip>
          <Chip selected={severityFilter === 'error'} onPress={() => setSeverityFilter('error')}>
            Error
          </Chip>
        </View>
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.resultCount}>{filteredLogs.length} log entries</Text>

        {filteredLogs.map((log, index) => (
          <Surface key={log.id || index} style={styles.logCard} elevation={1}>
            <View style={styles.logHeader}>
              <View style={[styles.iconBox, { backgroundColor: getSeverityColor(log.severity) + '20' }]}>
                <MaterialCommunityIcons
                  name={getActionIcon(log.action_type) as any}
                  size={20}
                  color={getSeverityColor(log.severity)}
                />
              </View>
              <View style={styles.logInfo}>
                <Text style={styles.logAction}>{log.action_type.replace(/_/g, ' ')}</Text>
                <Text style={styles.logTime}>
                  {new Date(log.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
              <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(log.severity) + '20' }]}>
                <Text style={[styles.severityText, { color: getSeverityColor(log.severity) }]}>
                  {log.severity}
                </Text>
              </View>
            </View>
            <Text style={styles.logDesc}>{log.description}</Text>
          </Surface>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterScroll: { maxHeight: 50, marginVertical: spacing.sm },
  filters: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm },
  content: { flex: 1 },
  scrollContent: { padding: spacing.md },
  resultCount: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontWeight: '600'
  },
  logCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  logInfo: { flex: 1 },
  logAction: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
    marginBottom: 2
  },
  logTime: { fontSize: 12, color: colors.textLight },
  severityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8
  },
  severityText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  logDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginLeft: 48
  }
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import { ActivityLog } from '@/models/entities/ActivityLog';
import { ExportService } from '@/models/services/ExportService';
import { supabase, isSupabaseConfigured } from '@/config/supabase';
import { notify } from '@/utils/confirm';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { Card } from '@/views/components/common/Card';

// Shared choice-chip design (matches TripHistory / Earnings filters).
const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export const ActivityLogsScreen = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const loadLogs = useCallback(async () => {
    try {
      const data = await ActivityLogService.getRecentLogs(100);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the admin opens / returns to the Logs tab.
  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  // Live updates: prepend new events as they are written to activity_logs.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let channel: any;
    try {
      channel = supabase
        .channel('activity_logs_admin')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'activity_logs' },
          (payload: any) => {
            setLogs((prev) => {
              if (prev.some((l) => l.id === payload.new.id)) return prev;
              return [payload.new, ...prev].slice(0, 100);
            });
          }
        )
        .subscribe();
    } catch {
      // Realtime unavailable (e.g. mock backend) — refresh still works.
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [severityFilter, logs]);

  const applyFilters = () => {
    if (severityFilter === 'all') {
      setFilteredLogs(logs);
    } else {
      setFilteredLogs(logs.filter(log => log.severity === severityFilter));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const handleExport = async () => {
    if (filteredLogs.length === 0) {
      notify('No events', 'There are no logs to export in this view.');
      return;
    }
    setExporting(true);
    try {
      await ExportService.exportLogsToCSV(filteredLogs);
      if (Platform.OS === 'web') {
        notify('Exported', `Downloaded ${filteredLogs.length} events as a CSV file.`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      notify('Export failed', 'Could not export the logs. Please try again.');
    } finally {
      setExporting(false);
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>System Logs</Text>
          <Text style={styles.headerSubtitle}>Monitor real-time platform activity</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.exportBtn} onPress={onRefresh} disabled={refreshing}>
            <MaterialCommunityIcons name="refresh" size={22} color={refreshing ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport} disabled={exporting}>
            <MaterialCommunityIcons name="download" size={22} color={exporting ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filters}>
            {['all', 'info', 'success', 'warning', 'error'].map((s) => (
              <FilterChip
                key={s}
                label={s.charAt(0).toUpperCase() + s.slice(1)}
                active={severityFilter === s}
                onPress={() => setSeverityFilter(s)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={styles.resultCount}>SHOWING {filteredLogs.length} EVENTS</Text>

        {filteredLogs.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="text-box-search-outline" size={56} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyText}>
              {severityFilter === 'all'
                ? 'System events from bookings, franchises, and sign-ins will appear here as they happen.'
                : `No ${severityFilter} events in this view.`}
            </Text>
          </View>
        )}

        {filteredLogs.map((log, index) => (
          <Card key={log.id || index} variant="elevated" padding="md" style={styles.logCard}>
            <View style={styles.logHeader}>
              <View style={[styles.iconBox, { backgroundColor: getSeverityColor(log.severity) + '10' }]}>
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
              <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(log.severity) + '15' }]}>
                <Text style={[styles.severityText, { color: getSeverityColor(log.severity) }]}>
                  {log.severity}
                </Text>
              </View>
            </View>
            <View style={styles.logBody}>
              <View style={styles.logLine} />
              <Text style={styles.logDesc}>{log.description}</Text>
            </View>
          </Card>
        ))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: { 
    ...typography.h1,
    fontSize: 28,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exportBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    fontSize: 17,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  filterScroll: { 
    maxHeight: 52, 
    marginVertical: spacing.sm 
  },
  filters: { 
    flexDirection: 'row', 
    paddingHorizontal: spacing.screen, 
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.label,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  content: { 
    flex: 1 
  },
  scrollContent: { 
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: 100 
  },
  resultCount: {
    ...typography.labelSmall,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
    fontSize: 10,
  },
  logCard: {
    marginBottom: spacing.md,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  logInfo: { 
    flex: 1 
  },
  logAction: {
    ...typography.label,
    color: colors.text,
    textTransform: 'capitalize',
    fontSize: 15,
  },
  logTime: { 
    ...typography.bodySmall,
    color: colors.textLight,
    fontSize: 11,
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  severityText: {
    ...typography.labelSmall,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  logBody: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingLeft: 4,
  },
  logLine: {
    width: 2,
    backgroundColor: colors.borderLight,
    borderRadius: 1,
    marginRight: spacing.md,
    marginLeft: 18,
  },
  logDesc: {
    flex: 1,
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  }
});

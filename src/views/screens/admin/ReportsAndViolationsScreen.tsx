import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AdminReportsScreen } from './AdminReportsScreen';
import { ViolationManagementScreen } from './ViolationManagementScreen';
import { useAdminPendingCounts } from '@/controllers/hooks/useAdminPendingCounts';
import { CountBadge } from '@/views/components/common/CountBadge';
import { REPORTS_MAX_WIDTH } from '@/views/components/admin/ReportsUi';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

type Tab = 'reports' | 'violations';

const TABS: Array<{ key: Tab; label: string; short: string; icon: string; hint: string }> = [
  { key: 'reports', label: 'User Reports', short: 'Reports', icon: 'flag-outline', hint: 'Complaints from riders and drivers' },
  { key: 'violations', label: 'Violations', short: 'Violations', icon: 'shield-alert-outline', hint: 'Recorded offenses and resolution' },
];

export const ReportsAndViolationsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const narrow = width < 380;
  const pending = useAdminPendingCounts();
  const [tab, setTab] = useState<Tab>(route.name === 'ViolationManagement' ? 'violations' : 'reports');
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.inner}>
          <View style={styles.titleRow}>
            <TouchableOpacity accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.back}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.titleCopy}>
              <Text style={styles.title} numberOfLines={1}>Reports and Violations</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{active.hint}</Text>
            </View>
          </View>

          <View style={styles.segment} accessibilityRole="tablist">
            {TABS.map((t) => {
              const selected = tab === t.key;
              const badge = t.key === 'reports' ? pending.reports : 0;
              return (
                <TouchableOpacity
                  key={t.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={badge ? `${t.label}, ${badge} open` : t.label}
                  style={[styles.segmentItem, selected && styles.segmentItemActive]}
                  onPress={() => setTab(t.key)}
                  activeOpacity={0.8}
                >
                  <View>
                    <MaterialCommunityIcons name={t.icon as any} size={18} color={selected ? colors.primary : colors.textSecondary} />
                    <CountBadge count={badge} ringColor={selected ? colors.surface : colors.surfaceAlt} />
                  </View>
                  <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]} numberOfLines={1}>
                    {narrow ? t.short : t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {tab === 'reports'
        ? <AdminReportsScreen embedded onViolationRecorded={() => setTab('violations')} />
        : <ViolationManagementScreen embedded />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  header: {
    backgroundColor: colors.surface,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  inner: { width: '100%', maxWidth: REPORTS_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { ...typography.h3, fontSize: 20 },
  subtitle: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  segment: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  segmentItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  segmentItemActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentLabel: { ...typography.label, fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  segmentLabelActive: { color: colors.primary },
});

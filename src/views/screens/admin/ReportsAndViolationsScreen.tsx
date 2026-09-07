import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AdminReportsScreen } from './AdminReportsScreen';
import { ViolationManagementScreen } from './ViolationManagementScreen';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

export const ReportsAndViolationsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [tab, setTab] = useState<'reports' | 'violations'>(route.name === 'ViolationManagement' ? 'violations' : 'reports');
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Reports and Violations</Text>
      </View>
      <View style={styles.tabs}>
        {(['reports', 'violations'] as const).map((key) => (
          <TouchableOpacity key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}
            style={[styles.tab, tab === key && styles.activeTab]} onPress={() => setTab(key)}>
            <Text style={[styles.label, tab === key && styles.activeLabel]}>{key === 'reports' ? 'User Reports' : 'Violations'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'reports' ? <AdminReportsScreen embedded onViolationRecorded={() => setTab('violations')} /> : <ViolationManagementScreen embedded />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: layout.headerTop, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.surface },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, flex: 1, fontSize: 20, paddingRight: spacing.sm },
  tabs: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface },
  tab: { flex: 1, minHeight: 44, padding: spacing.sm, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  activeTab: { backgroundColor: colors.primary },
  label: { ...typography.label, textAlign: 'center', color: colors.textSecondary },
  activeLabel: { color: '#fff' },
});

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { fetchAllApplications, advanceApplication } from '@/controllers/slices/franchiseSlice';
import {
  FranchiseApplication,
  FranchiseStatus,
  FRANCHISE_STATUS_LABEL,
} from '@/models/entities/Franchise';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { Card } from '@/views/components/common/Card';

// Maps the current status to the next admin action.
const NEXT: Record<string, { label: string; status: FranchiseStatus; patch?: Partial<FranchiseApplication> }> = {
  submitted: { label: 'Start Verification', status: 'document_verification' },
  document_verification: { label: 'Approve Documents', status: 'inspection' },
  inspection: { label: 'Record Inspection: Pass', status: 'payment', patch: { inspection_result: 'passed' } },
  payment: { label: 'Confirm Payment', status: 'approved', patch: { payment_status: 'paid' } },
  approved: { label: 'Issue MTOP', status: 'issued' },
};

const STATUS_COLOR: Record<FranchiseStatus, string> = {
  submitted: colors.info,
  document_verification: colors.warning,
  inspection: colors.warning,
  payment: colors.warning,
  approved: colors.primary,
  issued: colors.success,
  rejected: colors.error,
};

// Shared choice-chip design (matches TripHistory / Earnings filters).
const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export const FranchiseManagementScreen = () => {
  const dispatch = useAppDispatch();
  const { applications, loading } = useAppSelector((state) => state.franchise);
  const [filter, setFilter] = useState<'all' | 'pending' | 'issued'>('all');

  useEffect(() => {
    dispatch(fetchAllApplications());
  }, []);

  const advance = (app: FranchiseApplication) => {
    const next = NEXT[app.status];
    if (!next) return;
    const doIt = () => {
      const patch = { ...next.patch };
      if (next.status === 'issued') {
        patch.mtop_number = `MTOP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      dispatch(advanceApplication({ id: app.id, status: next.status, patch }));
    };
    if (next.status === 'issued') {
      Alert.alert('Issue MTOP', `Issue franchise certificate to ${app.driver_name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Issue', onPress: doIt },
      ]);
    } else {
      doIt();
    }
  };

  const reject = (app: FranchiseApplication) => {
    Alert.alert('Reject Application', `Reject ${app.driver_name}'s application?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () =>
          dispatch(
            advanceApplication({
              id: app.id,
              status: 'rejected',
              patch: { remarks: 'Rejected by administrator.' },
            })
          ),
      },
    ]);
  };

  const filtered = applications.filter((a) => {
    if (filter === 'pending') return a.status !== 'issued' && a.status !== 'rejected';
    if (filter === 'issued') return a.status === 'issued';
    return true;
  });

  if (loading && applications.length === 0) return <Loading message="Loading applications..." />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Franchise / MTOP</Text>
        <Text style={styles.headerSub}>{applications.length} active requests</Text>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filters}>
            <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterChip label="Pending" active={filter === 'pending'} onPress={() => setFilter('pending')} />
            <FilterChip label="Issued" active={filter === 'issued'} onPress={() => setFilter('issued')} />
          </View>
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.resultCount}>SHOWING {filtered.length} APPLICATIONS</Text>
        {filtered.map((app) => {
          const next = NEXT[app.status];
          return (
            <Card key={app.id} variant="elevated" padding="md" style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.driverInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{app.driver_name.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.driverName}>{app.driver_name}</Text>
                    <Text style={styles.driverMeta}>
                      {app.plate_number} • {app.type === 'renewal' ? 'Renewal' : 'New'} • {app.toda}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[app.status] + '15' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[app.status] }]}>
                    {FRANCHISE_STATUS_LABEL[app.status]}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="file-document-outline" size={16} color={colors.textLight} />
                  <Text style={styles.metaText}>
                    {app.documents.filter((d) => d.uploaded).length}/{app.documents.length} docs
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={16} color={colors.textLight} />
                  <Text style={styles.metaText}>{app.inspection_result || 'pending'}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="cash" size={16} color={colors.textLight} />
                  <Text style={[styles.metaText, typography.currency, { fontSize: 11 }]}>
                    {app.payment_status === 'paid' ? `₱${app.fees.toFixed(2)} paid` : `₱${app.fees.toFixed(2)} due`}
                  </Text>
                </View>
              </View>

              {app.mtop_number ? (
                <View style={styles.mtopRow}>
                  <MaterialCommunityIcons name="shield-check" size={16} color={colors.success} />
                  <Text style={styles.mtopText}>{app.mtop_number}</Text>
                </View>
              ) : null}

              {next ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(app)} activeOpacity={0.8}>
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.advanceBtn} onPress={() => advance(app)} activeOpacity={0.8}>
                    <Text style={styles.advanceText}>{next.label}</Text>
                    <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.terminalContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.terminalNote}>
                    {app.status === 'issued' ? 'Franchise issued and active.' : 'Application closed.'}
                  </Text>
                </View>
              )}
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="file-search-outline" size={56} color={colors.textLight} />
            <Text style={styles.emptyText}>No applications in this view</Text>
          </View>
        )}
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
  },
  headerSub: { 
    ...typography.body,
    fontSize: 14, 
    color: colors.textSecondary, 
    marginTop: 2,
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
    alignItems: 'center' 
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
  scroll: { 
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
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: spacing.md 
  },
  driverInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.h3,
    color: '#fff',
    fontSize: 16,
  },
  driverName: { 
    ...typography.label,
    fontSize: 15,
    color: colors.text 
  },
  driverMeta: { 
    ...typography.bodySmall,
    fontSize: 11, 
    color: colors.textSecondary, 
    marginTop: 2 
  },
  statusBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: radius.sm 
  },
  statusText: { 
    ...typography.labelSmall,
    fontSize: 9, 
    fontWeight: '800', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  metaRow: { 
    flexDirection: 'row', 
    gap: spacing.lg, 
    marginBottom: spacing.sm, 
    flexWrap: 'wrap' 
  },
  metaItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  metaText: { 
    ...typography.bodySmall,
    fontSize: 12, 
    color: colors.textSecondary, 
    textTransform: 'capitalize' 
  },
  mtopRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginBottom: spacing.sm,
    backgroundColor: colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  mtopText: { 
    ...typography.labelSmall,
    fontSize: 11, 
    fontWeight: '800', 
    color: colors.success, 
    letterSpacing: 1 
  },
  actions: { 
    flexDirection: 'row', 
    gap: spacing.sm, 
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  rejectBtn: {
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.error,
    justifyContent: 'center',
  },
  rejectText: { 
    ...typography.labelSmall,
    color: colors.error, 
    fontWeight: '800', 
    fontSize: 12 
  },
  advanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  advanceText: { 
    ...typography.labelSmall,
    color: '#fff', 
    fontWeight: '800', 
    fontSize: 12 
  },
  terminalContainer: {
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.sm,
  },
  terminalNote: { 
    ...typography.bodySmall,
    fontSize: 12, 
    color: colors.textMuted, 
    fontStyle: 'italic', 
  },
  empty: { 
    alignItems: 'center', 
    paddingVertical: spacing.xl * 2 
  },
  emptyText: { 
    ...typography.subtitle,
    color: colors.textSecondary, 
    marginTop: spacing.md, 
  },
});

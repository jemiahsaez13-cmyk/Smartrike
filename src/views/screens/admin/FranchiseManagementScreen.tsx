import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Surface, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { fetchAllApplications, advanceApplication } from '@/controllers/slices/franchiseSlice';
import {
  FranchiseApplication,
  FranchiseStatus,
  FRANCHISE_STATUS_LABEL,
} from '@/models/entities/Franchise';
import { colors, spacing, shadows, typography } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Franchise / MTOP</Text>
        <Text style={styles.headerSub}>{applications.length} applications</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filters}>
          <Chip selected={filter === 'all'} onPress={() => setFilter('all')} style={styles.chip}>All</Chip>
          <Chip selected={filter === 'pending'} onPress={() => setFilter('pending')} style={styles.chip}>Pending</Chip>
          <Chip selected={filter === 'issued'} onPress={() => setFilter('issued')} style={styles.chip}>Issued</Chip>
        </View>
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {filtered.map((app) => {
          const next = NEXT[app.status];
          return (
            <Surface key={app.id} style={styles.card} elevation={1}>
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
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[app.status] + '20' }]}>
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
                  <Text style={[styles.metaText, typography.currency, { fontSize: 12 }]}>
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
                <Text style={styles.terminalNote}>
                  {app.status === 'issued' ? 'Franchise issued and active.' : 'Application closed.'}
                </Text>
              )}
            </Surface>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="file-search-outline" size={56} color={colors.textLight} />
            <Text style={styles.emptyText}>No applications in this view</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2, fontWeight: '600' },
  filterScroll: { maxHeight: 56, marginVertical: spacing.sm },
  filters: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: {},
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  driverInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  driverName: { fontSize: 15, fontWeight: '700', color: colors.text },
  driverMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  metaRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500', textTransform: 'capitalize' },
  mtopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  mtopText: { fontSize: 13, fontWeight: '800', color: colors.success, letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  rejectBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.error,
    justifyContent: 'center',
  },
  rejectText: { color: colors.error, fontWeight: '700', fontSize: 13 },
  advanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  advanceText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  terminalNote: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.xs },
  empty: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyText: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.md, fontWeight: '600' },
});

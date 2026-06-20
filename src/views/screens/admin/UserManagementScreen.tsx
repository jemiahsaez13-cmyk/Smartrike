import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput as RNTextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AdminService } from '@/models/services/AdminService';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import { confirm, notify } from '@/utils/confirm';
import { useAppSelector } from '@/controllers/store';
import { User } from '@/models/types';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { Card } from '@/views/components/common/Card';

const adminService = new AdminService();

type Filter = 'all' | 'driver' | 'passenger' | 'pending' | 'suspended';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'driver', label: 'Drivers' },
  { key: 'passenger', label: 'Passengers' },
  { key: 'pending', label: 'Pending' },
  { key: 'suspended', label: 'Suspended' },
];

export const UserManagementScreen = () => {
  const navigation = useNavigation<any>();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<User | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminService.getAllUsers();
      setUsers(data);
    } catch (e: any) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
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

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.id?.toLowerCase().includes(q);
    const d = u as any;
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'driver'
        ? u.user_type === 'driver'
        : filter === 'passenger'
        ? u.user_type === 'passenger'
        : filter === 'pending'
        ? u.user_type === 'driver' && d.verification_status === 'pending'
        : filter === 'suspended'
        ? u.status === 'suspended'
        : true;
    return matchesQuery && matchesFilter;
  });

  const applyStatus = async (user: User, status: 'active' | 'suspended') => {
    setWorking(true);
    try {
      const updated = await adminService.updateUserStatus(user.id, status);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      setSelected(updated);
      void ActivityLogService.logActivity({
        action_type: 'user_action',
        entity_type: 'user',
        entity_id: user.id,
        description: `Admin ${status === 'suspended' ? 'suspended' : 'reactivated'} ${user.name}.`,
        severity: status === 'suspended' ? 'warning' : 'success',
      });
    } catch (e: any) {
      notify('Action failed', e?.message || 'Could not update the user.');
    } finally {
      setWorking(false);
    }
  };

  const applyVerification = async (user: User, verification: 'verified' | 'rejected') => {
    setWorking(true);
    try {
      const updated = await adminService.setDriverVerification(user.id, verification);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      setSelected(updated);
      void ActivityLogService.logActivity({
        action_type: 'driver_status_changed',
        entity_type: 'driver',
        entity_id: user.id,
        description: `Admin ${verification} driver ${user.name}.`,
        severity: verification === 'verified' ? 'success' : 'warning',
      });
    } catch (e: any) {
      notify('Action failed', e?.message || 'Could not update the driver.');
    } finally {
      setWorking(false);
    }
  };

  const deleteAccount = async (user: User) => {
    if (user.id === currentUser?.id) {
      notify('Not allowed', 'You cannot delete your own account.');
      return;
    }
    const ok = await confirm(
      'Delete Account',
      `Permanently delete ${user.name}'s account? This removes their profile and cannot be undone.`,
      { confirmText: 'Delete', destructive: true }
    );
    if (!ok) return;
    setWorking(true);
    try {
      await adminService.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSelected(null);
      void ActivityLogService.logActivity({
        action_type: 'user_action',
        entity_type: 'user',
        entity_id: user.id,
        description: `Admin deleted ${user.user_type} account: ${user.name}.`,
        severity: 'warning',
      });
    } catch (e: any) {
      notify('Delete failed', e?.message || 'Could not delete the account.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Loading message="Loading users..." />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>User Operations</Text>
          <Text style={styles.headerSubtitle}>Manage platform access and roles</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
          <RNTextInput
            placeholder="Search name, email, or ID..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.resultCount}>SHOWING {filtered.length} RECORDS</Text>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-search-outline" size={52} color={colors.textLight} />
            <Text style={styles.emptyText}>No users match this view</Text>
          </View>
        )}

        {filtered.map((user) => {
          const d = user as any;
          const isDriver = user.user_type === 'driver';
          const roleLabel = user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1);
          const statusColor =
            user.status === 'active' ? colors.success : user.status === 'suspended' ? colors.error : colors.warning;
          return (
            <Card key={user.id} variant="elevated" padding="md" style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarInitial}>{user.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
                </View>
                <View style={styles.details}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                </View>
                <TouchableOpacity style={styles.moreBtn} onPress={() => setSelected(user)} hitSlop={8}>
                  <MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.textLight} />
                </TouchableOpacity>
              </View>

              <View style={styles.metaRow}>
                <View style={[styles.roleBadge, { backgroundColor: isDriver ? colors.primaryLight : colors.surfaceAlt }]}>
                  <Text style={[styles.roleText, { color: isDriver ? colors.primary : colors.textSecondary }]}>{roleLabel}</Text>
                </View>
                {isDriver && d.verification_status && (
                  <View style={styles.verifyChip}>
                    <MaterialCommunityIcons
                      name={d.verification_status === 'verified' ? 'check-decagram' : d.verification_status === 'rejected' ? 'close-octagon' : 'clock-outline'}
                      size={13}
                      color={d.verification_status === 'verified' ? colors.success : d.verification_status === 'rejected' ? colors.error : colors.warning}
                    />
                    <Text style={styles.verifyText}>{d.verification_status}</Text>
                  </View>
                )}
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={styles.statusText}>{user.status}</Text>
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {/* Action sheet */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => !working && setSelected(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {selected && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetAvatar}>
                    <Text style={styles.avatarInitial}>{selected.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetName}>{selected.name}</Text>
                    <Text style={styles.sheetEmail} numberOfLines={1}>{selected.email}</Text>
                  </View>
                </View>

                <View style={styles.sheetStats}>
                  <View style={styles.sheetStat}>
                    <Text style={styles.sheetStatValue}>{selected.user_type}</Text>
                    <Text style={styles.sheetStatLabel}>Role</Text>
                  </View>
                  <View style={styles.sheetDivider} />
                  <View style={styles.sheetStat}>
                    <Text style={styles.sheetStatValue}>{(selected.rating ?? 5).toFixed(1)}</Text>
                    <Text style={styles.sheetStatLabel}>Rating</Text>
                  </View>
                  <View style={styles.sheetDivider} />
                  <View style={styles.sheetStat}>
                    <Text style={styles.sheetStatValue}>{selected.total_trips ?? 0}</Text>
                    <Text style={styles.sheetStatLabel}>Trips</Text>
                  </View>
                </View>

                {selected.user_type === 'driver' && (selected as any).verification_status !== 'verified' && (
                  <TouchableOpacity style={styles.actionRow} disabled={working} onPress={() => applyVerification(selected, 'verified')}>
                    <MaterialCommunityIcons name="check-decagram" size={20} color={colors.text} />
                    <Text style={styles.actionLabel}>Verify Driver</Text>
                  </TouchableOpacity>
                )}
                {selected.user_type === 'driver' && (selected as any).verification_status !== 'rejected' && (
                  <TouchableOpacity style={styles.actionRow} disabled={working} onPress={() => applyVerification(selected, 'rejected')}>
                    <MaterialCommunityIcons name="close-octagon-outline" size={20} color={colors.text} />
                    <Text style={styles.actionLabel}>Reject Driver Verification</Text>
                  </TouchableOpacity>
                )}
                {selected.status !== 'suspended' ? (
                  <TouchableOpacity style={styles.actionRow} disabled={working} onPress={() => applyStatus(selected, 'suspended')}>
                    <MaterialCommunityIcons name="account-cancel-outline" size={20} color={colors.error} />
                    <Text style={[styles.actionLabel, { color: colors.error }]}>Suspend Account</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.actionRow} disabled={working} onPress={() => applyStatus(selected, 'active')}>
                    <MaterialCommunityIcons name="account-check-outline" size={20} color={colors.success} />
                    <Text style={[styles.actionLabel, { color: colors.success }]}>Reactivate Account</Text>
                  </TouchableOpacity>
                )}

                {selected.id !== currentUser?.id && (
                  <TouchableOpacity style={[styles.actionRow, styles.actionRowLast]} disabled={working} onPress={() => deleteAccount(selected)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                    <Text style={[styles.actionLabel, { color: colors.error }]}>Delete Account</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.closeBtn} disabled={working} onPress={() => setSelected(null)}>
                  <Text style={styles.closeText}>{working ? 'Working…' : 'Close'}</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCopy: { flex: 1 },
  headerTitle: { ...typography.h1, fontSize: 28 },
  headerSubtitle: { ...typography.body, color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  searchContainer: { flexDirection: 'row', paddingHorizontal: spacing.screen, paddingBottom: spacing.sm, gap: spacing.sm, alignItems: 'center' },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { ...typography.body, flex: 1, color: colors.text, fontSize: 14, height: 48, padding: 0 },
  filterBar: { borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingBottom: spacing.sm },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.screen },
  chip: { height: 32, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, justifyContent: 'center' },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.labelSmall, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, paddingBottom: 100 },
  resultCount: { ...typography.labelSmall, color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, fontSize: 10 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyText: { ...typography.subtitle, color: colors.textSecondary, marginTop: spacing.md },
  userCard: { marginBottom: spacing.md },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarInitial: { ...typography.h3, color: '#fff', fontSize: 18 },
  details: { flex: 1 },
  userName: { ...typography.label, fontSize: 16, color: colors.text },
  userEmail: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.sm },
  roleText: { ...typography.labelSmall, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  verifyChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  verifyText: { ...typography.labelSmall, fontSize: 10, color: colors.textSecondary, textTransform: 'capitalize' },
  statusRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' },
  moreBtn: { padding: 4 },
  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  sheetAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sheetName: { ...typography.h3, fontSize: 18 },
  sheetEmail: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  sheetStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  sheetStat: { flex: 1, alignItems: 'center' },
  sheetStatValue: { ...typography.h3, fontSize: 16, textTransform: 'capitalize' },
  sheetStatLabel: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  sheetDivider: { width: 1, height: 28, backgroundColor: colors.border },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 54,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  actionRowLast: { borderBottomWidth: 0 },
  actionLabel: { ...typography.label, fontSize: 15, color: colors.text },
  closeBtn: { height: 50, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  closeText: { ...typography.button, fontSize: 15, color: colors.text },
});

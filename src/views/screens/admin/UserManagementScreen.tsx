import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput as RNTextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { AdminService } from '@/models/services/AdminService';
import { ConductService, ConductSummary } from '@/models/services/ConductService';
import { CONDUCT_WINDOW_DAYS } from '@/config/constants';
import { formatDate } from '@/utils/dateUtils';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import { supabase } from '@/config/supabase';
import { confirm, notify } from '@/utils/confirm';
import { useAppSelector } from '@/controllers/store';
import { User } from '@/models/types';
import { CountBadge } from '@/views/components/common/CountBadge';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { Card } from '@/views/components/common/Card';
import { DriverDocumentReviewModal } from '@/views/components/admin/DriverDocumentReviewModal';
import { DriverDocumentsStatus } from '@/models/entities/DriverDocument';

const DOCS_LABEL: Record<DriverDocumentsStatus, string> = {
  missing: 'Docs missing',
  pending: 'Docs to review',
  rejected: 'Docs rejected',
  approved: 'Docs approved',
};
const DOCS_SHORT: Record<DriverDocumentsStatus, string> = {
  missing: 'Missing',
  pending: 'Pending',
  rejected: 'Rejected',
  approved: 'Approved',
};

const adminService = new AdminService();
const conductService = new ConductService();

type Filter = 'all' | 'driver' | 'passenger' | 'admin' | 'pending' | 'suspended' | 'flagged' | 'deactivated';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'driver', label: 'Drivers' },
  { key: 'passenger', label: 'Passengers' },
  { key: 'admin', label: 'Admins' },
  { key: 'pending', label: 'Pending' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'deactivated', label: 'Deactivated' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const UserManagementScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [users, setUsers] = useState<User[]>([]);
  const [conduct, setConduct] = useState<Map<string, ConductSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>((route.params?.filter as Filter) ?? 'all');
  const [selected, setSelected] = useState<User | null>(null);
  const [working, setWorking] = useState(false);

  // New-admin invite form
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviting, setInviting] = useState(false);

  // Permanent deactivation form
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  // Registration document review (migration 078)
  const [reviewTarget, setReviewTarget] = useState<User | null>(null);

  // Opened again from the Violations review list with a filter preset.
  useEffect(() => {
    if (route.params?.filter) setFilter(route.params.filter as Filter);
  }, [route.params?.filter]);

  const load = useCallback(async () => {
    try {
      const [data, weekly] = await Promise.all([
        adminService.getAllUsers(),
        // Advisory only: the user list still loads if the tally cannot.
        conductService.getWeeklySummaries().catch((e) => {
          console.warn('weekly conduct tally unavailable:', e);
          return null;
        }),
      ]);
      setUsers(data);
      if (weekly) setConduct(weekly.summaries);
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

  // Red counts on the filter chips that need the admin's attention.
  const chipAlert: Partial<Record<Filter, number>> = {
    pending: users.filter((u) => u.user_type === 'driver' && (u as any).driver_documents_status === 'pending').length,
    flagged: users.filter((u) => !!conduct.get(u.id)?.flagged || !!conduct.get(u.id)?.repeatedCancellations).length,
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
        : filter === 'admin'
        ? u.user_type === 'admin'
        : filter === 'pending'
        ? u.user_type === 'driver' && d.verification_status === 'pending'
        : filter === 'suspended'
        ? u.status === 'suspended'
        : filter === 'flagged'
        ? !!conduct.get(u.id)?.flagged || !!conduct.get(u.id)?.repeatedCancellations
        : filter === 'deactivated'
        ? u.status === 'deactivated'
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

  const openDocuments = async (user: User) => {
    // Close the action sheet first; only one modal can show at a time.
    setSelected(null);
    await new Promise((r) => setTimeout(r, 300));
    setReviewTarget(user);
  };

  // The database keeps users.driver_documents_status in step; mirror it here
  // so the list and the Verify action update without a reload.
  const onDocumentsChanged = (driverId: string, status: DriverDocumentsStatus) => {
    setUsers((prev) => prev.map((u) => (u.id === driverId ? ({ ...u, driver_documents_status: status } as User) : u)));
    setReviewTarget((prev) => (prev && prev.id === driverId ? ({ ...prev, driver_documents_status: status } as User) : prev));
  };

  const resetInvite = () => {
    setInviteName('');
    setInviteEmail('');
    setInvitePhone('');
  };

  const submitInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!inviteName.trim()) {
      notify('Name required', 'Enter the new administrator’s name.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      notify('Invalid email', 'Enter a valid email address.');
      return;
    }
    setInviting(true);
    try {
      await adminService.inviteAdmin({ name: inviteName, email, phone: invitePhone });
      void ActivityLogService.logActivity({
        user_id: currentUser?.id,
        action_type: 'user_action',
        entity_type: 'user',
        description: `Admin invited a new administrator: ${inviteName.trim()} (${email}).`,
        severity: 'success',
      });
      setInviteVisible(false);
      resetInvite();
      notify(
        'Administrator invited',
        `${inviteName.trim()} was added as an admin. They can sign in via the emailed link, or use “Forgot Password” to set a password.`
      );
      // Give the DB trigger a moment to create the profile row, then refresh.
      setTimeout(load, 1200);
    } catch (e: any) {
      notify('Invite failed', e?.message || 'Could not create the administrator.');
    } finally {
      setInviting(false);
    }
  };

  // Formal warning: lands in the user's notification feed (heads-up banner +
  // bell) and is recorded in the activity log.
  const sendWarning = async (user: User) => {
    setSelected(null);
    await new Promise((r) => setTimeout(r, 300));
    const ok = await confirm(
      `Warn ${user.name}?`,
      'They will receive an official warning notification from the TODA admin. Repeated violations can lead to suspension.',
      { confirmText: 'Send Warning', cancelText: 'Cancel', destructive: true }
    );
    if (!ok) return;
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'system_alert',
        title: 'Official warning from TODA Admin',
        body:
          user.user_type === 'driver'
            ? 'A report or policy violation has been recorded against your account. Please follow TODA rules — further violations may lead to suspension.'
            : 'A report or policy violation has been recorded against your account. Please follow the community rules — further violations may lead to suspension.',
        read: false,
      });
      if (error) throw error;
      void ActivityLogService.logActivity({
        user_id: currentUser?.id,
        action_type: 'user_action',
        entity_type: 'user',
        entity_id: user.id,
        description: `Admin issued a warning to ${user.user_type} ${user.name}.`,
        severity: 'warning',
      });
      notify('Warning sent', `${user.name} has been notified.`);
    } catch (e: any) {
      notify('Could not send warning', e?.message || 'Please try again.');
    }
  };

  const openDeactivate = async (user: User) => {
    // Close the action sheet first; only one modal can show at a time.
    setSelected(null);
    await new Promise((r) => setTimeout(r, 300));
    setDeactivateReason('');
    setDeactivateTarget(user);
  };

  const submitDeactivate = async () => {
    const user = deactivateTarget;
    const reason = deactivateReason.trim();
    if (!user) return;
    if (reason.length < 5) {
      notify('Reason required', 'Describe the confirmed violations that justify the deactivation.');
      return;
    }
    setDeactivateTarget(null);
    await new Promise((r) => setTimeout(r, 300));
    const ok = await confirm(
      'Permanently deactivate?',
      `${user.name} will be signed out and can never use this account again. This cannot be undone. Their rides, payments and violation records are kept.`,
      { confirmText: 'Deactivate', destructive: true }
    );
    if (!ok) return;

    setWorking(true);
    try {
      const updated = await adminService.deactivateUser(user.id, reason);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
      void ActivityLogService.logActivity({
        user_id: currentUser?.id,
        action_type: 'user_action',
        entity_type: 'user',
        entity_id: user.id,
        description: `Admin permanently deactivated ${user.user_type} ${user.name}. Reason: ${reason}`,
        severity: 'error',
      });
      notify('Account deactivated', `${user.name}'s account has been permanently deactivated.`);
    } catch (e: any) {
      notify('Deactivation failed', e?.message || 'Could not deactivate the account.');
    } finally {
      setWorking(false);
    }
  };

  const deleteAccount = async (user: User) => {
    if (user.id === currentUser?.id) {
      notify('Not allowed', 'You cannot delete your own account.');
      return;
    }
    // Close the action sheet first — iOS/Android show only one modal at a time,
    // so the confirm dialog would otherwise never appear over the open sheet.
    setSelected(null);
    await new Promise((r) => setTimeout(r, 300));

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
      void ActivityLogService.logActivity({
        action_type: 'user_action',
        entity_type: 'user',
        entity_id: user.id,
        description: `Admin deleted ${user.user_type} account: ${user.name}.`,
        severity: 'warning',
      });
      notify('Account deleted', `${user.name}'s account has been removed.`);
    } catch (e: any) {
      notify('Delete failed', e?.message || 'Could not delete the account.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Loading message="Loading users..." />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>User Operations</Text>
          <Text style={styles.headerSubtitle}>Manage platform access and roles</Text>
        </View>
        <TouchableOpacity
          style={styles.addAdminBtn}
          onPress={() => setInviteVisible(true)}
          activeOpacity={0.85}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="shield-plus" size={18} color="#fff" />
          <Text style={styles.addAdminText}>New Admin</Text>
        </TouchableOpacity>
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
              <CountBadge count={chipAlert[f.key] ?? 0} variant="inline" />
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
            user.status === 'active' ? colors.success
            : user.status === 'suspended' || user.status === 'deactivated' ? colors.error
            : colors.warning;
          const weekly = conduct.get(user.id);
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
                {isDriver && d.verification_status !== 'verified' && d.driver_documents_status && d.driver_documents_status !== 'approved' && (
                  <View style={[styles.verifyChip, d.driver_documents_status === 'rejected' && { backgroundColor: colors.errorLight }]}>
                    <MaterialCommunityIcons
                      name="file-document-outline"
                      size={13}
                      color={d.driver_documents_status === 'rejected' ? colors.error : colors.textSecondary}
                    />
                    <Text style={[styles.verifyText, d.driver_documents_status === 'rejected' && { color: colors.error }]}>
                      {DOCS_LABEL[d.driver_documents_status as DriverDocumentsStatus]}
                    </Text>
                  </View>
                )}
                {(weekly?.flagged || weekly?.repeatedCancellations) && (
                  <View style={styles.flagChip}>
                    <MaterialCommunityIcons name="flag" size={12} color={colors.error} />
                    <Text style={styles.flagChipText}>Flagged</Text>
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
                  {selected.user_type === 'admin' ? (
                    <View style={styles.sheetStat}>
                      <Text style={styles.sheetStatValue}>{selected.status}</Text>
                      <Text style={styles.sheetStatLabel}>Status</Text>
                    </View>
                  ) : selected.user_type === 'driver' ? (
                    <>
                      <View style={styles.sheetStat}>
                        <Text style={styles.sheetStatValue}>
                          {(selected.total_trips ?? 0) > 0 ? (selected.rating ?? 5).toFixed(1) : 'New'}
                        </Text>
                        <Text style={styles.sheetStatLabel}>Rating</Text>
                      </View>
                      <View style={styles.sheetDivider} />
                      <View style={styles.sheetStat}>
                        <Text style={styles.sheetStatValue}>{selected.total_trips ?? 0}</Text>
                        <Text style={styles.sheetStatLabel}>Trips</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.sheetStat}>
                        <Text style={styles.sheetStatValue}>{selected.total_trips ?? 0}</Text>
                        <Text style={styles.sheetStatLabel}>Trips</Text>
                      </View>
                      <View style={styles.sheetDivider} />
                      <View style={styles.sheetStat}>
                        <Text style={styles.sheetStatValue}>{selected.status}</Text>
                        <Text style={styles.sheetStatLabel}>Status</Text>
                      </View>
                    </>
                  )}
                </View>

                {(() => {
                  const weekly = conduct.get(selected.id);
                  if (!weekly?.flagged && !weekly?.repeatedCancellations) return null;
                  return (
                    <View style={styles.flagBanner}>
                      <MaterialCommunityIcons name="flag" size={18} color={colors.error} />
                      <Text style={styles.flagBannerText}>
                        Flagged for review · last {CONDUCT_WINDOW_DAYS} days:
                        {weekly.flagged ? ` ${weekly.confirmedViolations} confirmed violations.` : ''}
                        {weekly.repeatedCancellations ? ` ${weekly.invalidCancellations} cancellations without a valid reason.` : ''}
                        {' '}Review the records before imposing a restriction.
                      </Text>
                    </View>
                  );
                })()}

                {selected.status === 'deactivated' && (
                  <View style={styles.deactivatedBox}>
                    <Text style={styles.deactivatedTitle}>
                      Permanently deactivated{selected.deactivated_at ? ` · ${formatDate(selected.deactivated_at)}` : ''}
                    </Text>
                    {!!selected.deactivation_reason && (
                      <Text style={styles.deactivatedReason}>{selected.deactivation_reason}</Text>
                    )}
                    <Text style={styles.deactivatedNote}>Ride, payment and violation records are kept.</Text>
                  </View>
                )}

                {selected.user_type === 'driver' && (
                  <TouchableOpacity
                    style={styles.actionRow}
                    disabled={working}
                    onPress={() => {
                      const driver = selected;
                      setSelected(null);
                      navigation.navigate('DriverProfile', { driverId: driver.id });
                    }}
                  >
                    <MaterialCommunityIcons name="card-account-details-outline" size={20} color={colors.text} />
                    <Text style={styles.actionLabel}>View Driver Profile (details, photos, reviews)</Text>
                  </TouchableOpacity>
                )}
                {selected.user_type !== 'admin' && selected.status !== 'deactivated' && (
                  <TouchableOpacity style={styles.actionRow} disabled={working} onPress={() => sendWarning(selected)}>
                    <MaterialCommunityIcons name="alert-outline" size={20} color={colors.warning} />
                    <Text style={[styles.actionLabel, { color: colors.warning }]}>Issue Warning</Text>
                  </TouchableOpacity>
                )}
                {selected.user_type === 'driver' && selected.status !== 'deactivated' && (
                  <TouchableOpacity style={styles.actionRow} disabled={working} onPress={() => openDocuments(selected)}>
                    <MaterialCommunityIcons name="file-document-check-outline" size={20} color={colors.text} />
                    <Text style={styles.actionLabel}>
                      Review Documents
                      {(selected as any).driver_documents_status
                        ? ` · ${DOCS_SHORT[(selected as any).driver_documents_status as DriverDocumentsStatus]}`
                        : ''}
                    </Text>
                  </TouchableOpacity>
                )}
                {selected.user_type === 'driver' && selected.status !== 'deactivated' && (selected as any).verification_status !== 'verified' && (() => {
                  // The database refuses verification until all four documents are approved.
                  const docsApproved = (selected as any).driver_documents_status === 'approved';
                  return (
                    <TouchableOpacity
                      style={[styles.actionRow, !docsApproved && { opacity: 0.5 }]}
                      disabled={working || !docsApproved}
                      onPress={() => applyVerification(selected, 'verified')}
                    >
                      <MaterialCommunityIcons name="check-decagram" size={20} color={colors.text} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.actionLabel}>Verify Driver</Text>
                        {!docsApproved && (
                          <Text style={styles.actionHint}>Approve all four documents first</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })()}
                {selected.user_type === 'driver' && selected.status !== 'deactivated' && (selected as any).verification_status !== 'rejected' && (
                  <TouchableOpacity style={styles.actionRow} disabled={working} onPress={() => applyVerification(selected, 'rejected')}>
                    <MaterialCommunityIcons name="close-octagon-outline" size={20} color={colors.text} />
                    <Text style={styles.actionLabel}>Reject Driver Verification</Text>
                  </TouchableOpacity>
                )}
                {selected.status === 'deactivated' ? null : selected.status !== 'suspended' ? (
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

                {selected.user_type !== 'admin' && selected.status !== 'deactivated' && selected.id !== currentUser?.id && (
                  <TouchableOpacity style={styles.actionRow} disabled={working} onPress={() => openDeactivate(selected)}>
                    <MaterialCommunityIcons name="account-off-outline" size={20} color={colors.error} />
                    <Text style={[styles.actionLabel, { color: colors.error }]}>Permanently Deactivate</Text>
                  </TouchableOpacity>
                )}

                {selected.id !== currentUser?.id && selected.status !== 'deactivated' && (
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

      <DriverDocumentReviewModal
        driver={reviewTarget}
        onClose={() => setReviewTarget(null)}
        onChanged={onDocumentsChanged}
      />

      {/* Permanent deactivation form */}
      <Modal visible={!!deactivateTarget} transparent animationType="slide" onRequestClose={() => setDeactivateTarget(null)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setDeactivateTarget(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.inviteHeader}>
              <View style={[styles.inviteIcon, { backgroundColor: colors.errorLight }]}>
                <MaterialCommunityIcons name="account-off" size={22} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetName}>Permanently Deactivate</Text>
                <Text style={styles.sheetEmail} numberOfLines={1}>{deactivateTarget?.name}</Text>
              </View>
            </View>

            <Text style={styles.inviteLabel}>REASON (REQUIRED)</Text>
            <RNTextInput
              style={[styles.inviteInput, styles.reasonInput]}
              placeholder="e.g. Repeated confirmed violations: fake bookings on May 2, 4 and 6"
              placeholderTextColor={colors.textMuted}
              value={deactivateReason}
              onChangeText={setDeactivateReason}
              multiline
              maxLength={500}
            />

            <Text style={styles.inviteHint}>
              Use this only after confirming repeated or serious violations. The account can never be reactivated or deleted, and its ride, payment and violation records are kept for accountability.
            </Text>

            <TouchableOpacity style={[styles.inviteSubmit, { backgroundColor: colors.error }]} onPress={submitDeactivate} activeOpacity={0.85}>
              <Text style={styles.inviteSubmitText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setDeactivateTarget(null)}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* New-admin invite form */}
      <Modal visible={inviteVisible} transparent animationType="slide" onRequestClose={() => !inviting && setInviteVisible(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => !inviting && setInviteVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.inviteHeader}>
              <View style={styles.inviteIcon}>
                <MaterialCommunityIcons name="shield-account" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetName}>Add Administrator</Text>
                <Text style={styles.sheetEmail}>Create a new admin account with full access.</Text>
              </View>
            </View>

            <Text style={styles.inviteLabel}>FULL NAME</Text>
            <RNTextInput
              style={styles.inviteInput}
              placeholder="e.g. Maria Santos"
              placeholderTextColor={colors.textMuted}
              value={inviteName}
              onChangeText={setInviteName}
              autoCapitalize="words"
              editable={!inviting}
            />

            <Text style={styles.inviteLabel}>EMAIL</Text>
            <RNTextInput
              style={styles.inviteInput}
              placeholder="name@example.com"
              placeholderTextColor={colors.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!inviting}
            />

            <Text style={styles.inviteLabel}>PHONE (OPTIONAL)</Text>
            <RNTextInput
              style={styles.inviteInput}
              placeholder="+63 9XX XXX XXXX"
              placeholderTextColor={colors.textMuted}
              value={invitePhone}
              onChangeText={setInvitePhone}
              keyboardType="phone-pad"
              editable={!inviting}
            />

            <Text style={styles.inviteHint}>
              The new admin is created as an active account. They’ll receive a sign-in link by email, or can use “Forgot Password” to set a password.
            </Text>

            <TouchableOpacity
              style={[styles.inviteSubmit, inviting && { opacity: 0.6 }]}
              onPress={submitInvite}
              disabled={inviting}
              activeOpacity={0.85}
            >
              <Text style={styles.inviteSubmitText}>{inviting ? 'Creating…' : 'Create Administrator'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} disabled={inviting} onPress={() => setInviteVisible(false)}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
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
  addAdminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.pill,
  },
  addAdminText: { ...typography.label, color: '#fff', fontSize: 13 },
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
  chip: { height: 32, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
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
  flagChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.errorLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  flagChipText: { ...typography.labelSmall, fontSize: 10, color: colors.error },
  flagBanner: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.errorLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  flagBannerText: { ...typography.bodySmall, flex: 1, fontSize: 13, color: colors.error, lineHeight: 19 },
  deactivatedBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: 4 },
  deactivatedTitle: { ...typography.label, fontSize: 14, color: colors.error },
  deactivatedReason: { ...typography.body, fontSize: 13, color: colors.text },
  deactivatedNote: { ...typography.bodySmall, fontSize: 12, color: colors.textMuted },
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
  actionHint: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  closeBtn: { height: 50, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  closeText: { ...typography.button, fontSize: 15, color: colors.text },
  // Invite form
  inviteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  inviteIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  inviteLabel: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted, letterSpacing: 1, marginBottom: 6, marginTop: spacing.sm },
  inviteInput: {
    ...typography.body,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  reasonInput: { height: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  inviteHint: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12, marginTop: spacing.md, lineHeight: 18 },
  inviteSubmit: { height: 52, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  inviteSubmitText: { ...typography.button, color: '#fff', fontSize: 15 },
});

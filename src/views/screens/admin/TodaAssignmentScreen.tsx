/**
 * TodaAssignmentScreen — Module 9
 *
 * Single-step assignment flow:
 *  - Tap a driver → bottom sheet opens with all TODAs listed immediately
 *  - Tap a TODA row → assigns right away (no intermediate confirm modal)
 *  - Long-press the current TODA row or tap "Remove" to clear membership
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '@/config/supabase';
import { Driver } from '@/models/types';
import { TodaAssociation, TodaRoute } from '@/models/entities/Toda';
import { TodaService } from '@/models/services/TodaService';
import { confirm, notify } from '@/utils/confirm';
import { NotificationService } from '@/models/services/NotificationService';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriverWithFranchise extends Driver {
  plate_number?: string | null;
  body_number?: string | null;
  mtop_number?: string | null;
}

type Tab = 'unassigned' | 'assigned' | 'all';

const todaService = new TodaService();
const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

// ─── Service helpers ──────────────────────────────────────────────────────────

async function fetchDriversWithFranchise(): Promise<DriverWithFranchise[]> {
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('*')
    .eq('user_type', 'driver')
    .order('name', { ascending: true });
  if (usersErr) throw usersErr;
  const drivers = (users ?? []) as DriverWithFranchise[];

  const driverIds = drivers.map((d) => d.id);
  if (driverIds.length) {
    const { data: franchises } = await supabase
      .from('franchise_applications')
      .select('driver_id, plate_number, body_number, mtop_number, status')
      .in('driver_id', driverIds)
      .eq('status', 'issued')
      .order('created_at', { ascending: false });

    const byDriver = new Map<string, { plate_number?: string; body_number?: string; mtop_number?: string }>();
    for (const fr of (franchises ?? []) as any[]) {
      if (!byDriver.has(fr.driver_id)) {
        byDriver.set(fr.driver_id, {
          plate_number: fr.plate_number,
          body_number: fr.body_number,
          mtop_number: fr.mtop_number,
        });
      }
    }
    drivers.forEach((d) => {
      const fr = byDriver.get(d.id);
      if (fr) {
        d.plate_number = fr.plate_number;
        d.body_number = fr.body_number;
        d.mtop_number = fr.mtop_number;
      }
    });
  }

  return drivers;
}

async function saveTodaMembership(driverId: string, toda: string | null): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ toda_membership: toda || null })
    .eq('id', driverId);
  if (error) throw error;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export const TodaAssignmentScreen = () => {
  const navigation = useNavigation<any>();

  const [drivers, setDrivers] = useState<DriverWithFranchise[]>([]);
  const [todas, setTodas] = useState<TodaAssociation[]>([]);
  const [routeCache, setRouteCache] = useState<Record<string, TodaRoute[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('unassigned');
  const [search, setSearch] = useState('');

  // Single assignment sheet
  const [sheetDriver, setSheetDriver] = useState<DriverWithFranchise | null>(null);
  const [expandedToda, setExpandedToda] = useState<string | null>(null); // id of expanded TODA row
  const [saving, setSaving] = useState(false);
  const [savingTodaId, setSavingTodaId] = useState<string | null>(null); // which row is saving

  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [driverData, todaData] = await Promise.all([
        fetchDriversWithFranchise(),
        todaService.listAll(),
      ]);
      setDrivers(driverData);
      setTodas(todaData);

      const counts: Record<string, number> = {};
      for (const d of driverData) {
        if (d.toda_membership) {
          counts[d.toda_membership] = (counts[d.toda_membership] ?? 0) + 1;
        }
      }
      setMemberCounts(counts);
    } catch (e: any) {
      console.error('TodaAssignment load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  // ── Fetch routes (cached) ─────────────────────────────────────────────────
  const routeCacheRef = React.useRef<Record<string, TodaRoute[]>>({});

  const fetchRoutes = useCallback(async (toda: TodaAssociation) => {
    if (routeCacheRef.current[toda.id] !== undefined) return;
    try {
      const routes = await todaService.listRoutes(toda.id);
      routeCacheRef.current = { ...routeCacheRef.current, [toda.id]: routes };
      setRouteCache((prev) => ({ ...prev, [toda.id]: routes }));
    } catch {
      routeCacheRef.current = { ...routeCacheRef.current, [toda.id]: [] };
      setRouteCache((prev) => ({ ...prev, [toda.id]: [] }));
    }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const unassignedCount = drivers.filter((d) => !d.toda_membership).length;
  const assignedCount   = drivers.filter((d) => !!d.toda_membership).length;

  const lowerSearch = search.toLowerCase().trim();
  const displayed = drivers.filter((d) => {
    const matchTab =
      tab === 'all'          ? true
      : tab === 'unassigned' ? !d.toda_membership
      : !!d.toda_membership;
    if (!matchTab) return false;
    if (!lowerSearch) return true;
    return (
      d.name?.toLowerCase().includes(lowerSearch) ||
      d.toda_membership?.toLowerCase().includes(lowerSearch) ||
      d.plate_number?.toLowerCase().includes(lowerSearch) ||
      d.body_number?.toLowerCase().includes(lowerSearch) ||
      d.mtop_number?.toLowerCase().includes(lowerSearch)
    );
  });

  // ── Open sheet for a driver ───────────────────────────────────────────────
  const openSheet = (driver: DriverWithFranchise) => {
    setSheetDriver(driver);
    setExpandedToda(null);
    setSavingTodaId(null);
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetDriver(null);
    setExpandedToda(null);
  };

  // ── Tap TODA row: expand/collapse details ─────────────────────────────────
  const toggleExpand = (toda: TodaAssociation) => {
    const next = expandedToda === toda.id ? null : toda.id;
    setExpandedToda(next);
    if (next) void fetchRoutes(toda);
  };

  // ── Assign a TODA to the driver (single tap on assign button) ─────────────
  const assignToda = async (toda: TodaAssociation) => {
    if (!sheetDriver || saving) return;
    setSaving(true);
    setSavingTodaId(toda.id);
    try {
      await saveTodaMembership(sheetDriver.id, toda.name);

      // Notify the driver — fire and forget, non-blocking
      void new NotificationService().notifyPassenger(
        sheetDriver.id,
        'TODA Assignment',
        `You have been assigned to ${toda.name}.${toda.area_barangays?.length ? ` Service area: ${toda.area_barangays.slice(0, 3).join(', ')}${toda.area_barangays.length > 3 ? ` +${toda.area_barangays.length - 3} more` : ''}.` : ''}`
      ).catch(() => {/* non-critical */});

      setDrivers((prev) =>
        prev.map((d) =>
          d.id === sheetDriver.id ? { ...d, toda_membership: toda.name } : d
        )
      );
      setMemberCounts((prev) => {
        const next = { ...prev };
        if (sheetDriver.toda_membership) {
          next[sheetDriver.toda_membership] = Math.max(0, (next[sheetDriver.toda_membership] ?? 1) - 1);
        }
        next[toda.name] = (next[toda.name] ?? 0) + 1;
        return next;
      });

      setSheetDriver(null);
      setExpandedToda(null);
    } catch (e: any) {
      await notify('Save failed', e?.message || 'Could not assign TODA.');
    } finally {
      setSaving(false);
      setSavingTodaId(null);
    }
  };

  // ── Remove TODA from driver ───────────────────────────────────────────────
  const removeToda = async () => {
    if (!sheetDriver || saving) return;
    const ok = await confirm(
      'Remove TODA membership?',
      `This will clear the TODA assignment for ${sheetDriver.name}.`,
      { confirmText: 'Remove', destructive: true }
    );
    if (!ok) return;
    setSaving(true);
    try {
      await saveTodaMembership(sheetDriver.id, null);

      setDrivers((prev) =>
        prev.map((d) =>
          d.id === sheetDriver.id ? { ...d, toda_membership: undefined } : d
        )
      );
      setMemberCounts((prev) => {
        const next = { ...prev };
        if (sheetDriver.toda_membership) {
          next[sheetDriver.toda_membership] = Math.max(0, (next[sheetDriver.toda_membership] ?? 1) - 1);
        }
        return next;
      });

      setSheetDriver(null);
      setExpandedToda(null);
    } catch (e: any) {
      await notify('Remove failed', e?.message || 'Could not remove TODA membership.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>TODA Assignment</Text>
          <Text style={styles.headerSub}>Tap a driver to assign their TODA</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Summary stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.errorLight }]}>
            <MaterialCommunityIcons name="account-alert-outline" size={20} color={colors.error} />
            <Text style={[styles.statValue, { color: colors.error }]}>{unassignedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.error }]}>Unassigned</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.successLight }]}>
            <MaterialCommunityIcons name="account-check-outline" size={20} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.success }]}>{assignedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.success }]}>Assigned</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.primaryLight }]}>
            <MaterialCommunityIcons name="account-group-outline" size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.primary }]}>{drivers.length}</Text>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Total</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, TODA, plate, body no…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab filter */}
        <View style={styles.tabRow}>
          {([
            { key: 'unassigned', label: `Unassigned (${unassignedCount})` },
            { key: 'assigned',   label: `Assigned (${assignedCount})` },
            { key: 'all',        label: `All (${drivers.length})` },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.resultCount}>
          SHOWING {displayed.length} DRIVER{displayed.length !== 1 ? 'S' : ''}
        </Text>

        {/* Driver list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-search-outline" size={52} color={colors.textLight} />
            <Text style={styles.emptyTitle}>
              {tab === 'unassigned' ? 'All drivers assigned' : 'No drivers found'}
            </Text>
            <Text style={styles.emptyText}>
              {tab === 'unassigned'
                ? 'Every registered driver has a TODA membership assigned.'
                : 'Try a different search or tab.'}
            </Text>
          </View>
        ) : (
          <Card variant="elevated" padding="none" style={styles.listCard}>
            {displayed.map((driver, index) => (
              <View key={driver.id}>
                <TouchableOpacity
                  style={styles.driverRow}
                  onPress={() => openSheet(driver)}
                  activeOpacity={0.76}
                >
                  <View style={[
                    styles.avatar,
                    { backgroundColor: driver.toda_membership ? colors.primaryLight : colors.errorLight },
                  ]}>
                    <Text style={[
                      styles.avatarText,
                      { color: driver.toda_membership ? colors.primary : colors.error },
                    ]}>
                      {(driver.name ?? 'D').charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName} numberOfLines={1}>{driver.name}</Text>

                    {driver.toda_membership ? (
                      <View style={styles.todaBadge}>
                        <MaterialCommunityIcons name="account-group" size={12} color={colors.primary} />
                        <Text style={styles.todaBadgeText}>{driver.toda_membership}</Text>
                      </View>
                    ) : (
                      <View style={styles.unassignedBadge}>
                        <MaterialCommunityIcons name="account-alert" size={12} color={colors.error} />
                        <Text style={styles.unassignedBadgeText}>No TODA assigned</Text>
                      </View>
                    )}

                    <View style={styles.identifierRow}>
                      {driver.plate_number ? (
                        <View style={styles.identChip}>
                          <MaterialCommunityIcons name="card-text-outline" size={11} color={colors.textMuted} />
                          <Text style={styles.identChipText}>{driver.plate_number}</Text>
                        </View>
                      ) : null}
                      {driver.body_number ? (
                        <View style={styles.identChip}>
                          <MaterialCommunityIcons name="motorbike" size={11} color={colors.textMuted} />
                          <Text style={styles.identChipText}>Body #{driver.body_number}</Text>
                        </View>
                      ) : null}
                      {driver.mtop_number ? (
                        <View style={styles.identChip}>
                          <MaterialCommunityIcons name="shield-check-outline" size={11} color={colors.textMuted} />
                          <Text style={styles.identChipText}>{driver.mtop_number}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <MaterialCommunityIcons
                    name={driver.toda_membership ? 'pencil-outline' : 'plus-circle-outline'}
                    size={20}
                    color={driver.toda_membership ? colors.textLight : colors.primary}
                  />
                </TouchableOpacity>
                {index < displayed.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* ══ TODA ASSIGNMENT SHEET ══
          Single step: shows all TODAs immediately.
          Tap a TODA → assign. Expand row to see details first.  */}
      <Modal
        visible={!!sheetDriver}
        animationType="slide"
        transparent
        onRequestClose={closeSheet}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {/* Driver header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetAvatar}>
                <Text style={styles.sheetAvatarText}>
                  {(sheetDriver?.name ?? 'D').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.sheetTitleBlock}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {sheetDriver?.name ?? 'Driver'}
                </Text>
                <View style={styles.sheetSubRow}>
                  {sheetDriver?.toda_membership ? (
                    <View style={styles.currentTodaBadge}>
                      <MaterialCommunityIcons name="account-group" size={12} color={colors.primary} />
                      <Text style={styles.currentTodaBadgeText}>{sheetDriver.toda_membership}</Text>
                    </View>
                  ) : (
                    <Text style={styles.sheetSub}>No TODA assigned — tap one below</Text>
                  )}
                  {(sheetDriver?.plate_number || sheetDriver?.body_number) ? (
                    <Text style={styles.sheetSubMeta}>
                      {[
                        sheetDriver?.plate_number,
                        sheetDriver?.body_number ? `Body #${sheetDriver.body_number}` : null,
                      ].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.sheetHeaderActions}>
                {sheetDriver?.toda_membership ? (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={removeToda}
                    activeOpacity={0.8}
                    disabled={saving}
                  >
                    {saving && !savingTodaId ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <MaterialCommunityIcons name="account-remove-outline" size={16} color={colors.error} />
                    )}
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.sheetClose} onPress={closeSheet} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Instruction hint */}
            <View style={styles.hintRow}>
              <MaterialCommunityIcons name="gesture-tap" size={14} color={colors.textMuted} />
              <Text style={styles.hintText}>
                Tap a TODA to assign · tap the row name to see details
              </Text>
            </View>

            {/* TODA list */}
            {todas.length === 0 ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="account-group-outline" size={40} color={colors.textLight} />
                <Text style={styles.emptyTitle}>No TODAs registered</Text>
                <Text style={styles.emptyText}>Go to TODA Management to register one first.</Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.todaList}
                showsVerticalScrollIndicator={false}
              >
                {todas.map((toda, index) => {
                  const isCurrent = sheetDriver?.toda_membership === toda.name;
                  const isExpanded = expandedToda === toda.id;
                  const routes = routeCache[toda.id] ?? null;
                  const count = memberCounts[toda.name] ?? 0;
                  const isSavingThis = savingTodaId === toda.id;

                  return (
                    <View
                      key={toda.id}
                      style={[
                        styles.todaCard,
                        isCurrent && styles.todaCardCurrent,
                        index === todas.length - 1 && { marginBottom: spacing.lg },
                      ]}
                    >
                      {/* Main row */}
                      <View style={styles.todaCardRow}>
                        {/* Avatar */}
                        <View style={[
                          styles.todaAvatar,
                          { backgroundColor: isCurrent ? colors.primary : toda.is_active ? colors.primaryLight : colors.surfaceAlt },
                        ]}>
                          <MaterialCommunityIcons
                            name="account-group"
                            size={20}
                            color={isCurrent ? '#fff' : toda.is_active ? colors.primary : colors.textMuted}
                          />
                        </View>

                        {/* Info — tap to expand */}
                        <TouchableOpacity
                          style={styles.todaCardInfo}
                          onPress={() => toggleExpand(toda)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.todaNameRow}>
                            <Text style={[styles.todaName, isCurrent && styles.todaNameCurrent]}>
                              {toda.name}
                            </Text>
                            {isCurrent && (
                              <View style={styles.currentPill}>
                                <Text style={styles.currentPillText}>Current</Text>
                              </View>
                            )}
                            {!toda.is_active && (
                              <View style={styles.inactivePill}>
                                <Text style={styles.inactivePillText}>Inactive</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.todaMeta}>
                            {count} member{count !== 1 ? 's' : ''}
                            {toda.area_barangays?.length
                              ? ` · ${toda.area_barangays.length} barangay${toda.area_barangays.length > 1 ? 's' : ''}`
                              : ''}
                            {toda.contact_name ? ` · ${toda.contact_name}` : ''}
                          </Text>
                        </TouchableOpacity>

                        {/* Chevron expand + Assign button */}
                        <TouchableOpacity
                          style={styles.expandBtn}
                          onPress={() => toggleExpand(toda)}
                          activeOpacity={0.6}
                        >
                          <MaterialCommunityIcons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>

                        {!isCurrent && (
                          <TouchableOpacity
                            style={[styles.assignBtn, isSavingThis && { opacity: 0.6 }]}
                            onPress={() => assignToda(toda)}
                            disabled={saving}
                            activeOpacity={0.8}
                          >
                            {isSavingThis ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <MaterialCommunityIcons name="check" size={16} color="#fff" />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Expanded details */}
                      {isExpanded && (
                        <View style={styles.todaExpanded}>
                          {/* Barangays */}
                          {toda.area_barangays?.length > 0 && (
                            <View style={styles.expandSection}>
                              <Text style={styles.expandSectionTitle}>
                                SERVICE AREA ({toda.area_barangays.length})
                              </Text>
                              <View style={styles.barangayChips}>
                                {toda.area_barangays.map((brgy) => (
                                  <View key={brgy} style={styles.barangayChip}>
                                    <Text style={styles.barangayChipText}>{brgy}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}

                          {/* Routes */}
                          <View style={styles.expandSection}>
                            <Text style={styles.expandSectionTitle}>ROUTES & FARES</Text>
                            {routes === null ? (
                              <View style={styles.routesLoading}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.routesLoadingText}>Loading…</Text>
                              </View>
                            ) : routes.length === 0 ? (
                              <Text style={styles.emptyDetailText}>No routes set.</Text>
                            ) : (
                              routes.map((route, idx) => (
                                <View
                                  key={route.id}
                                  style={[
                                    styles.routeRow,
                                    idx < routes.length - 1 && styles.routeRowBorder,
                                  ]}
                                >
                                  <View style={styles.routeIcon}>
                                    <MaterialCommunityIcons name="map-marker-path" size={13} color={colors.primary} />
                                  </View>
                                  <View style={styles.routeNames}>
                                    <Text style={styles.routePoint}>{route.from_barangay}</Text>
                                    <MaterialCommunityIcons name="arrow-right-thin" size={15} color={colors.textMuted} />
                                    <Text style={styles.routePoint}>{route.to_barangay}</Text>
                                  </View>
                                  <Text style={styles.routeFare}>{peso(route.fare)}</Text>
                                </View>
                              ))
                            )}
                          </View>

                          {/* Assign from expanded state too */}
                          {!isCurrent && (
                            <TouchableOpacity
                              style={[styles.assignExpandedBtn, saving && { opacity: 0.6 }]}
                              onPress={() => assignToda(toda)}
                              disabled={saving}
                              activeOpacity={0.85}
                            >
                              {isSavingThis ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <>
                                  <MaterialCommunityIcons name="check" size={17} color="#fff" />
                                  <Text style={styles.assignExpandedBtnText}>
                                    Assign {sheetDriver?.name?.split(' ')[0] ?? 'Driver'} to {toda.name}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: layout.headerTop, paddingBottom: spacing.md,
    paddingRight: spacing.screen,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { ...typography.h2, fontSize: 22 },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 1 },

  scrollContent: { paddingBottom: 100 },

  statsRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  statBox: {
    flex: 1, alignItems: 'center',
    paddingVertical: spacing.md, borderRadius: radius.lg, gap: 4,
  },
  statValue: { fontSize: 24, fontWeight: '800', fontFamily: 'Poppins_700Bold' },
  statLabel: {
    ...typography.labelSmall, fontSize: 10, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.screen, marginTop: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, ...typography.body, fontSize: 14, color: colors.text, paddingVertical: 0 },

  tabRow: {
    flexDirection: 'row', marginHorizontal: spacing.screen, marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3, gap: 3,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tabText: { ...typography.labelSmall, fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.text, fontWeight: '700' },

  resultCount: {
    ...typography.labelSmall, color: colors.textMuted,
    fontSize: 10, letterSpacing: 1.5,
    marginHorizontal: spacing.screen, marginTop: spacing.md, marginBottom: spacing.sm,
  },

  listCard: { marginHorizontal: spacing.screen, marginBottom: spacing.md },
  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 72,
  },
  avatar: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', fontFamily: 'Poppins_700Bold' },
  driverInfo: { flex: 1, minWidth: 0 },
  driverName: { ...typography.label, fontSize: 15, color: colors.text, marginBottom: 3 },

  todaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, marginBottom: 4,
  },
  todaBadgeText: { ...typography.labelSmall, fontSize: 11, color: colors.primary, fontWeight: '700' },
  unassignedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: colors.errorLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, marginBottom: 4,
  },
  unassignedBadgeText: { ...typography.labelSmall, fontSize: 11, color: colors.error, fontWeight: '700' },

  identifierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  identChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  identChipText: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted },

  divider: { height: 1, backgroundColor: colors.borderLight },

  center: { alignItems: 'center', paddingVertical: 60 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: spacing.screen },
  emptyTitle: { ...typography.h3, marginTop: spacing.md },
  emptyText: {
    ...typography.body, color: colors.textMuted,
    textAlign: 'center', marginTop: spacing.xs, lineHeight: 20,
  },

  // ── Assignment Sheet ───────────────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    maxHeight: '88%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginTop: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md, paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  sheetAvatar: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sheetAvatarText: { fontSize: 18, fontWeight: '800', fontFamily: 'Poppins_700Bold', color: '#fff' },
  sheetTitleBlock: { flex: 1, minWidth: 0 },
  sheetTitle: { ...typography.h3, fontSize: 17, color: colors.text },
  sheetSubRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 3 },
  currentTodaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
  },
  currentTodaBadgeText: { ...typography.labelSmall, fontSize: 11, color: colors.primary, fontWeight: '700' },
  sheetSub: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  sheetSubMeta: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted },
  sheetHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  removeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.errorLight,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetClose: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },

  hintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.screen, paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  hintText: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted },

  // TODA list
  todaList: { paddingHorizontal: spacing.screen, paddingTop: spacing.md },

  todaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  todaCardCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
  },

  todaCardRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    gap: spacing.sm,
  },
  todaAvatar: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  todaCardInfo: { flex: 1, minWidth: 0 },
  todaNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  todaName: { ...typography.label, fontSize: 15, color: colors.text },
  todaNameCurrent: { color: colors.primary },
  currentPill: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: colors.primary, borderRadius: radius.pill,
  },
  currentPillText: { ...typography.labelSmall, fontSize: 9, color: '#fff', fontWeight: '700', letterSpacing: 0.5 },
  inactivePill: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
  },
  inactivePillText: { ...typography.labelSmall, fontSize: 9, color: colors.textMuted },
  todaMeta: { ...typography.bodySmall, fontSize: 11, color: colors.textSecondary },

  expandBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  assignBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Expanded details
  todaExpanded: {
    borderTopWidth: 1, borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  expandSection: { marginTop: spacing.sm },
  expandSectionTitle: {
    ...typography.labelSmall, fontSize: 10, letterSpacing: 1.2,
    color: colors.primary, fontWeight: '700',
    marginBottom: spacing.xs,
  },

  barangayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  barangayChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: colors.primaryLight, borderRadius: radius.pill,
  },
  barangayChipText: { ...typography.labelSmall, fontSize: 11, color: colors.primary, fontWeight: '600' },

  routeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 8,
  },
  routeRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  routeIcon: {
    width: 24, height: 24, borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  routeNames: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  routePoint: { ...typography.bodySmall, fontSize: 12, color: colors.text, fontWeight: '600' },
  routeFare: { ...typography.label, fontSize: 13, color: colors.primary, fontWeight: '700', flexShrink: 0 },
  routesLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  routesLoadingText: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12 },
  emptyDetailText: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12, fontStyle: 'italic', paddingVertical: 4 },

  assignExpandedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 44, borderRadius: radius.md,
    backgroundColor: colors.primary, marginTop: spacing.md,
  },
  assignExpandedBtnText: { ...typography.label, fontSize: 14, color: '#fff' },
});

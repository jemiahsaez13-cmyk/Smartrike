/**
 * TodaManagementScreen — Module 9
 *
 * Lists all TODA associations. Per TODA the admin can:
 *  - View members (drivers assigned to this TODA)
 *  - View / add / delete point-to-point routes with fares
 *  - Create a new TODA or edit an existing one
 *  - Activate / deactivate a TODA
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { TodaAssociation, TodaRoute, SaveTodaInput } from '@/models/entities/Toda';
import { TodaService } from '@/models/services/TodaService';
import { confirm, notify } from '@/utils/confirm';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

// ─── Boac barangays only (app scope) ─────────────────────────────────────────
const BOAC_BARANGAYS = [
  'Agot','Agumaymayan','Amoingon','Apitong','Balagasan','Balaring','Balimbing',
  'Balogo','Bamban','Bangbangalon','Bantad','Bantay','Bayuti','Binunga','Boi',
  'Boton','Buliasnin','Bunganay','Caganhao','Canat','Catubugan','Cawit','Daig',
  'Daypay','Duyay','Hinapulan','Ihatub','Isok I','Isok II Poblacion','Laylay',
  'Lupac','Mahinhin','Mainit','Malbog','Maligaya','Malusak','Mansiwat',
  'Mataas na Bayan','Maybo','Mercado','Murallon','Ogbac','Pawa','Pili','Poctoy',
  'Poras','Puting Buhangin','Puyog','Sabong','San Miguel','Santol','Sawi','Tabi',
  'Tabigue','Tagwak','Tambunan','Tampus','Tanza','Tugos','Tumagabok','Tumapon',
];

const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

const service = new TodaService();

// ─── View modes ───────────────────────────────────────────────────────────────
type View = 'list' | 'detail';

// ─── Screen ───────────────────────────────────────────────────────────────────
type PassengerType = 'regular' | 'senior' | 'pwd' | 'student';

const PASSENGER_TYPES: { key: PassengerType; label: string; icon: string }[] = [
  { key: 'regular', label: 'Regular', icon: 'account-outline' },
  { key: 'senior',  label: 'Senior',  icon: 'account-heart-outline' },
  { key: 'pwd',     label: 'PWD',     icon: 'wheelchair-accessibility' },
  { key: 'student', label: 'Student', icon: 'school-outline' },
];

function getDiscountPct(route: TodaRoute, type: PassengerType): number {
  if (type === 'senior')  return route.senior_discount  ?? 0;
  if (type === 'pwd')     return route.pwd_discount     ?? 0;
  if (type === 'student') return route.student_discount ?? 0;
  return 0;
}

const RoutesDetailTab = ({
  routes,
  onAdd,
  onDelete,
}: {
  routes: TodaRoute[];
  onAdd: () => void;
  onDelete: (r: TodaRoute) => void;
}) => {
  const [passengerType, setPassengerType] = React.useState<PassengerType>('regular');

  return (
    <>
      {/* Header row: label + Add button */}
      <View style={styles.routesHeader}>
        <Text style={styles.detailSectionLabel}>POINT-TO-POINT FARES</Text>
        <TouchableOpacity style={styles.addRouteBtn} onPress={onAdd} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={16} color="#fff" />
          <Text style={styles.addRouteBtnText}>Add Route</Text>
        </TouchableOpacity>
      </View>

      {routes.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={40} color={colors.textLight} />
          <Text style={styles.emptyTitle}>No routes yet</Text>
          <Text style={styles.emptyText}>
            Tap "Add Route" to set point-to-point fares between barangays.
          </Text>
        </View>
      ) : (
        <>
          {/* Passenger type — single scrollable row of pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ptRow}
            style={styles.ptScroll}
          >
            {PASSENGER_TYPES.map(({ key, label, icon }) => {
              const active = passengerType === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.ptPill, active && styles.ptPillActive]}
                  onPress={() => setPassengerType(key)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons
                    name={icon as any}
                    size={14}
                    color={active ? '#fff' : colors.primary}
                  />
                  <Text style={[styles.ptPillText, active && styles.ptPillTextActive]}>
                    {label}
                  </Text>
                  {key !== 'regular' && (() => {
                    const pct = routes[0] ? getDiscountPct(routes[0], key) : 0;
                    return pct > 0 ? (
                      <View style={[styles.ptPct, active && styles.ptPctActive]}>
                        <Text style={[styles.ptPctText, active && styles.ptPctTextActive]}>
                          -{pct}%
                        </Text>
                      </View>
                    ) : null;
                  })()}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Route list */}
          <Card variant="elevated" padding="none" style={styles.listCard}>
            {routes.map((route, index) => {
              const discPct   = getDiscountPct(route, passengerType);
              const discounted = route.fare * (1 - discPct / 100);
              const hasDiscount = discPct > 0;
              return (
                <View key={route.id}>
                  <View style={styles.routeRow}>
                    {/* Icon */}
                    <View style={styles.routeIcon}>
                      <MaterialCommunityIcons name="map-marker-path" size={16} color={colors.primary} />
                    </View>

                    {/* From → To (single line, truncated) */}
                    <Text style={styles.routeLabel} numberOfLines={1} ellipsizeMode="tail">
                      {route.from_barangay}
                      <Text style={styles.routeArrow}> → </Text>
                      {route.to_barangay}
                    </Text>

                    {/* Fare — strikethrough + discounted, or plain */}
                    <View style={styles.routeFareCol}>
                      {hasDiscount && (
                        <Text style={styles.routeFareOriginal}>{peso(route.fare)}</Text>
                      )}
                      <Text style={[styles.routeFare, hasDiscount && styles.routeFareGreen]}>
                        {peso(discounted)}
                      </Text>
                    </View>

                    {/* Delete */}
                    <TouchableOpacity
                      style={styles.routeDelete}
                      onPress={() => onDelete(route)}
                      activeOpacity={0.75}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={17} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  {index < routes.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </Card>
        </>
      )}
    </>
  );
};

export const TodaManagementScreen = () => {
  const navigation = useNavigation<any>();
  const actor = useAppSelector((state) => state.auth.user);
  const insets = useSafeAreaInsets();

  // List state
  const [todas, setTodas] = useState<TodaAssociation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail / view state
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<TodaAssociation | null>(null);
  const [routes, setRoutes] = useState<TodaRoute[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; plate_number?: string; body_number?: string; verification_status?: string }[]>([]);
  const [detailTab, setDetailTab] = useState<'members' | 'routes'>('members');
  const [detailLoading, setDetailLoading] = useState(false);

  // TODA create / edit modal
  const [todaModal, setTodaModal] = useState(false);
  const [editingToda, setEditingToda] = useState<TodaAssociation | null>(null);
  const [todaName, setTodaName] = useState('');
  const [todaAreaBarangays, setTodaAreaBarangays] = useState<string[]>([]);
  const [todaContact, setTodaContact] = useState('');
  const [todaPhone, setTodaPhone] = useState('');
  const [todaNotes, setTodaNotes] = useState('');
  const [todaSaving, setTodaSaving] = useState(false);
  const [areaPickerVisible, setAreaPickerVisible] = useState(false);

  // Route add modal
  const [routeModal, setRouteModal] = useState(false);
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [routeFare, setRouteFare] = useState('');
  const [routeNotes, setRouteNotes] = useState('');
  const [routeSeniorDiscount, setRouteSeniorDiscount] = useState('20');
  const [routePwdDiscount, setRoutePwdDiscount] = useState('20');
  const [routeStudentDiscount, setRouteStudentDiscount] = useState('0');
  const [routeSaving, setRouteSaving] = useState(false);
  const [barangayPicker, setBarangayPicker] = useState<'from' | 'to' | null>(null);

  // ── Load all TODAs ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setTodas(await service.listAll());
    } catch (e: any) {
      console.error('TodaManagement load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load]));

  // ── Open detail for a TODA ──────────────────────────────────────────────────
  const openDetail = async (toda: TodaAssociation) => {
    setSelected(toda);
    setView('detail');
    setDetailTab('members');
    setDetailLoading(true);
    try {
      const [r, m] = await Promise.all([
        service.listRoutes(toda.id),
        service.getMembers(toda.name),
      ]);
      setRoutes(r);
      setMembers(m);
    } catch (e: any) {
      console.error('Detail load failed:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── TODA create / edit ──────────────────────────────────────────────────────
  const openTodaModal = (toda?: TodaAssociation) => {
    setEditingToda(toda ?? null);
    setTodaName(toda?.name ?? '');
    setTodaAreaBarangays(toda?.area_barangays ?? []);
    setTodaContact(toda?.contact_name ?? '');
    setTodaPhone(toda?.contact_phone ?? '');
    setTodaNotes(toda?.notes ?? '');
    setTodaModal(true);
  };

  const saveToda = async () => {
    setTodaSaving(true);
    try {
      const input: SaveTodaInput = {
        id: editingToda?.id,
        name: todaName,
        area: todaAreaBarangays.length > 0 ? todaAreaBarangays.join(', ') : undefined,
        area_barangays: todaAreaBarangays,
        contact_name: todaContact,
        contact_phone: todaPhone,
        notes: todaNotes,
        is_active: editingToda?.is_active ?? true,
      };
      const saved = await service.save(input, actor?.id);
      if (editingToda) {
        setTodas((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
        if (selected?.id === saved.id) setSelected(saved);
      } else {
        setTodas((prev) => [...prev, saved]);
      }
      setTodaModal(false);
      setTodaSaving(false);
      void notify(
        editingToda ? 'TODA updated' : 'TODA created',
        `${saved.name} has been ${editingToda ? 'updated' : 'registered'}.`
      );
    } catch (e: any) {
      setTodaSaving(false);
      void notify('Save failed', e?.message || 'Could not save the TODA.');
    }
  };

  // ── Toggle active ───────────────────────────────────────────────────────────
  const toggleActive = async (toda: TodaAssociation) => {
    const next = !toda.is_active;
    const ok = await confirm(
      next ? 'Activate TODA?' : 'Deactivate TODA?',
      next
        ? `${toda.name} will be marked as active.`
        : `${toda.name} will be marked inactive. Members will still be visible.`,
      { confirmText: next ? 'Activate' : 'Deactivate', destructive: !next }
    );
    if (!ok) return;
    try {
      await service.setActive(toda.id, next);
      const updated = { ...toda, is_active: next };
      setTodas((prev) => prev.map((t) => (t.id === toda.id ? updated : t)));
      if (selected?.id === toda.id) setSelected(updated);
    } catch (e: any) {
      await notify('Update failed', e?.message || 'Could not update the TODA.');
    }
  };

  // ── Route add ───────────────────────────────────────────────────────────────
  const openRouteModal = () => {
    setRouteFrom('');
    setRouteTo('');
    setRouteFare('');
    setRouteNotes('');
    setRouteSeniorDiscount('20');
    setRoutePwdDiscount('20');
    setRouteStudentDiscount('0');
    setRouteModal(true);
  };

  const saveRoute = async () => {
    if (!selected) return;
    if (!routeFrom) { await notify('Missing field', 'Please select a From barangay.'); return; }
    if (!routeTo) { await notify('Missing field', 'Please select a To barangay.'); return; }
    if (routeFrom === routeTo) { await notify('Invalid route', 'From and To barangay must be different.'); return; }
    const fare = parseFloat(routeFare);
    if (!routeFare || isNaN(fare) || fare <= 0) { await notify('Invalid fare', 'Please enter a valid fare amount.'); return; }
    const seniorDiscount  = Math.min(100, Math.max(0, parseFloat(routeSeniorDiscount)  || 0));
    const pwdDiscount     = Math.min(100, Math.max(0, parseFloat(routePwdDiscount)     || 0));
    const studentDiscount = Math.min(100, Math.max(0, parseFloat(routeStudentDiscount) || 0));
    setRouteSaving(true);
    try {
      const saved = await service.saveRoute({
        toda_id: selected.id,
        from_barangay: routeFrom,
        to_barangay: routeTo,
        fare,
        notes: routeNotes,
        senior_discount:  seniorDiscount,
        pwd_discount:     pwdDiscount,
        student_discount: studentDiscount,
      });
      setRoutes((prev) => [...prev, saved]);
      setRouteModal(false);
      setRouteSaving(false);
      // fire-and-forget — don't block on the user tapping OK
      void notify('Route added', `${saved.from_barangay} → ${saved.to_barangay} at ${peso(saved.fare)}`);
    } catch (e: any) {
      setRouteSaving(false);
      void notify('Save failed', e?.message || 'Could not save the route.');
    }
  };

  const deleteRoute = async (route: TodaRoute) => {
    const ok = await confirm(
      'Delete route?',
      `Remove ${route.from_barangay} → ${route.to_barangay} (${peso(route.fare)})?`,
      { confirmText: 'Delete', destructive: true }
    );
    if (!ok) return;
    try {
      await service.deleteRoute(route.id);
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));
    } catch (e: any) {
      await notify('Delete failed', e?.message || 'Could not delete the route.');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => {
            if (view === 'detail') { setView('list'); setSelected(null); }
            else navigation.goBack();
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>
            {view === 'detail' ? selected?.name ?? 'TODA' : 'TODA Management'}
          </Text>
          <Text style={styles.headerSub}>
            {view === 'detail'
              ? selected?.area_barangays?.length
            ? `${selected.area_barangays.length} barangay${selected.area_barangays.length > 1 ? 's' : ''} · Boac`
            : selected?.area ?? 'Boac, Marinduque'
              : `${todas.length} association${todas.length !== 1 ? 's' : ''} registered`}
          </Text>
        </View>
        {view === 'list' && (
          <TouchableOpacity style={styles.addBtn} onPress={() => openTodaModal()} activeOpacity={0.8}>
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={styles.addBtnText}>New TODA</Text>
          </TouchableOpacity>
        )}
        {view === 'detail' && (
          <TouchableOpacity style={styles.editBtn} onPress={() => openTodaModal(selected!)} activeOpacity={0.8}>
            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ══ LIST VIEW ══ */}
      {view === 'list' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(); }}
              tintColor={colors.primary}
            />
          }
        >
          {/* Summary */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.successLight }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
              <Text style={[styles.statValue, { color: colors.success }]}>
                {todas.filter((t) => t.is_active).length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.success }]}>Active</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceAlt }]}>
              <MaterialCommunityIcons name="pause-circle-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.statValue, { color: colors.textMuted }]}>
                {todas.filter((t) => !t.is_active).length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Inactive</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.primaryLight }]}>
              <MaterialCommunityIcons name="account-group-outline" size={20} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.primary }]}>{todas.length}</Text>
              <Text style={[styles.statLabel, { color: colors.primary }]}>Total</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
          ) : todas.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-group-outline" size={52} color={colors.textLight} />
              <Text style={styles.emptyTitle}>No TODAs registered</Text>
              <Text style={styles.emptyText}>Tap "New TODA" to register the first association.</Text>
            </View>
          ) : (
            <Card variant="elevated" padding="none" style={styles.listCard}>
              {todas.map((toda, index) => (
                <View key={toda.id}>
                  <TouchableOpacity
                    style={styles.todaRow}
                    onPress={() => openDetail(toda)}
                    activeOpacity={0.76}
                  >
                    <View style={[styles.todaAvatar, { backgroundColor: toda.is_active ? colors.primaryLight : colors.surfaceAlt }]}>
                      <MaterialCommunityIcons
                        name="account-group"
                        size={22}
                        color={toda.is_active ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <View style={styles.todaInfo}>
                      <View style={styles.todaNameRow}>
                        <Text style={styles.todaName}>{toda.name}</Text>
                        {!toda.is_active && (
                          <View style={styles.inactivePill}>
                            <Text style={styles.inactivePillText}>Inactive</Text>
                          </View>
                        )}
                      </View>
                      {toda.area || toda.area_barangays?.length ? (
                        <Text style={styles.todaArea} numberOfLines={1}>
                          {toda.area_barangays?.length
                            ? `${toda.area_barangays.length} barangay${toda.area_barangays.length > 1 ? 's' : ''} · ${toda.area_barangays.slice(0, 3).join(', ')}${toda.area_barangays.length > 3 ? '…' : ''}`
                            : toda.area}
                        </Text>
                      ) : null}
                      {toda.contact_name ? (
                        <Text style={styles.todaMeta} numberOfLines={1}>
                          Contact: {toda.contact_name}{toda.contact_phone ? ` · ${toda.contact_phone}` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
                  </TouchableOpacity>
                  {index < todas.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}

      {/* ══ DETAIL VIEW ══ */}
      {view === 'detail' && selected && (
        <View style={styles.detailContainer}>
          {/* Status bar */}
          <View style={styles.detailStatus}>
            <View style={styles.detailStatusLeft}>
              <View style={[styles.statusDot, { backgroundColor: selected.is_active ? colors.success : colors.textMuted }]} />
              <Text style={styles.statusText}>{selected.is_active ? 'Active' : 'Inactive'}</Text>
              {selected.contact_name ? (
                <>
                  <Text style={styles.statusSep}>·</Text>
                  <MaterialCommunityIcons name="account-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.statusText}>{selected.contact_name}</Text>
                </>
              ) : null}
              {selected.contact_phone ? (
                <>
                  <Text style={styles.statusSep}>·</Text>
                  <Text style={styles.statusText}>{selected.contact_phone}</Text>
                </>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => toggleActive(selected)}
              activeOpacity={0.75}
            >
              <Text style={[styles.toggleLabel, { color: selected.is_active ? colors.success : colors.textMuted }]}>
                {selected.is_active ? 'Active' : 'Inactive'}
              </Text>
              <Switch
                value={selected.is_active}
                onValueChange={() => toggleActive(selected)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={selected.is_active ? '#fff' : colors.textMuted}
                ios_backgroundColor={colors.border}
              />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, detailTab === 'members' && styles.tabActive]}
              onPress={() => setDetailTab('members')}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons
                name="account-group-outline"
                size={16}
                color={detailTab === 'members' ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabText, detailTab === 'members' && styles.tabTextActive]}>
                Members ({members.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, detailTab === 'routes' && styles.tabActive]}
              onPress={() => setDetailTab('routes')}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons
                name="map-marker-path"
                size={16}
                color={detailTab === 'routes' ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabText, detailTab === 'routes' && styles.tabTextActive]}>
                Routes ({routes.length})
              </Text>
            </TouchableOpacity>
          </View>

          {detailLoading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
          ) : (
            <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
              {/* ── Members tab ── */}
              {detailTab === 'members' && (
                <>
                  <Text style={styles.detailSectionLabel}>
                    DRIVERS ASSIGNED TO {selected.name.toUpperCase()}
                  </Text>
                  {members.length === 0 ? (
                    <View style={styles.empty}>
                      <MaterialCommunityIcons name="account-off-outline" size={40} color={colors.textLight} />
                      <Text style={styles.emptyTitle}>No members yet</Text>
                      <Text style={styles.emptyText}>
                        Assign drivers to this TODA via the TODA Assignment screen.
                      </Text>
                    </View>
                  ) : (
                    <Card variant="elevated" padding="none" style={styles.listCard}>
                      {members.map((m, index) => (
                        <View key={m.id}>
                          <View style={styles.memberRow}>
                            <View style={styles.memberAvatar}>
                              <Text style={styles.memberAvatarText}>
                                {(m.name ?? 'D').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.memberInfo}>
                              <Text style={styles.memberName}>{m.name}</Text>
                              <View style={styles.memberChips}>
                                {m.plate_number ? (
                                  <View style={styles.identChip}>
                                    <MaterialCommunityIcons name="card-text-outline" size={11} color={colors.textMuted} />
                                    <Text style={styles.identChipText}>{m.plate_number}</Text>
                                  </View>
                                ) : null}
                                {m.body_number ? (
                                  <View style={styles.identChip}>
                                    <MaterialCommunityIcons name="motorbike" size={11} color={colors.textMuted} />
                                    <Text style={styles.identChipText}>Body #{m.body_number}</Text>
                                  </View>
                                ) : null}
                                <View style={[
                                  styles.identChip,
                                  { backgroundColor: m.verification_status === 'verified' ? colors.successLight : colors.warningLight },
                                ]}>
                                  <Text style={[
                                    styles.identChipText,
                                    { color: m.verification_status === 'verified' ? colors.success : colors.warning },
                                  ]}>
                                    {m.verification_status ?? 'pending'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                          {index < members.length - 1 && <View style={styles.divider} />}
                        </View>
                      ))}
                    </Card>
                  )}
                </>
              )}

              {/* ── Routes tab ── */}
              {detailTab === 'routes' && (
                <RoutesDetailTab
                  routes={routes}
                  onAdd={openRouteModal}
                  onDelete={deleteRoute}
                />
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ══ CREATE / EDIT TODA MODAL ══ */}
      <Modal
        visible={todaModal && !areaPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { if (!todaSaving && !areaPickerVisible) setTodaModal(false); }}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingToda ? 'Edit TODA' : 'New TODA Association'}
              </Text>
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={() => { if (!todaSaving) setTodaModal(false); }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Field label="TODA NAME *" value={todaName} onChangeText={setTodaName} placeholder="e.g. FEDTODAB" />

              {/* ── Service Area multi-select ── */}
              <Text style={fieldStyles.label}>SERVICE AREA (BARANGAYS)</Text>
              <TouchableOpacity
                style={styles.areaPickerBtn}
                onPress={() => setAreaPickerVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="map-marker-multiple-outline" size={18} color={colors.primary} />
                <Text style={[styles.areaPickerText, todaAreaBarangays.length === 0 && { color: colors.textMuted }]}>
                  {todaAreaBarangays.length === 0
                    ? 'Select barangays…'
                    : `${todaAreaBarangays.length} barangay${todaAreaBarangays.length > 1 ? 's' : ''} selected`}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textLight} />
              </TouchableOpacity>
              {todaAreaBarangays.length > 0 && (
                <View style={styles.areaChipsWrap}>
                  {todaAreaBarangays.map((brgy) => (
                    <TouchableOpacity
                      key={brgy}
                      style={styles.areaChip}
                      onPress={() => setTodaAreaBarangays((prev) => prev.filter((b) => b !== brgy))}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.areaChipText}>{brgy}</Text>
                      <MaterialCommunityIcons name="close" size={12} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Field label="CONTACT PERSON" value={todaContact} onChangeText={setTodaContact} placeholder="President / Rep name" />
              <Field label="CONTACT PHONE" value={todaPhone} onChangeText={setTodaPhone} placeholder="09XXXXXXXXX" keyboardType="phone-pad" />
              <Field label="NOTES" value={todaNotes} onChangeText={setTodaNotes} placeholder="Additional information…" multiline />
            </ScrollView>

            <View style={[styles.sheetFooter, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md }]}>
              <TouchableOpacity
                style={[styles.saveBtn, todaSaving && { opacity: 0.65 }]}
                onPress={saveToda}
                disabled={todaSaving}
                activeOpacity={0.85}
              >
                {todaSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>
                      {editingToda ? 'Save Changes' : 'Create TODA'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ AREA BARANGAY MULTI-SELECT PICKER ══ */}
      <Modal
        visible={areaPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAreaPickerVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '88%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Select Service Area</Text>
                <Text style={[styles.sheetTitle, { fontSize: 13, fontWeight: '400', color: colors.textSecondary }]}>
                  {todaAreaBarangays.length} selected · tap to toggle
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.sheetClose, { backgroundColor: colors.primary }]}
                onPress={() => setAreaPickerVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Select all / Clear all */}
            <View style={styles.areaPickerActions}>
              <TouchableOpacity
                style={styles.areaActionBtn}
                onPress={() => setTodaAreaBarangays([...BOAC_BARANGAYS])}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="check-all" size={15} color={colors.primary} />
                <Text style={styles.areaActionText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.areaActionBtn}
                onPress={() => setTodaAreaBarangays([])}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="close" size={15} color={colors.error} />
                <Text style={[styles.areaActionText, { color: colors.error }]}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.barangayList} showsVerticalScrollIndicator={false}>
              {BOAC_BARANGAYS.map((brgy) => {
                const selected = todaAreaBarangays.includes(brgy);
                return (
                  <TouchableOpacity
                    key={brgy}
                    style={[styles.barangayRow, selected && styles.barangayRowActive]}
                    onPress={() =>
                      setTodaAreaBarangays((prev) =>
                        selected ? prev.filter((b) => b !== brgy) : [...prev, brgy]
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.barangayText, selected && styles.barangayTextActive]}>
                      {brgy}
                    </Text>
                    <MaterialCommunityIcons
                      name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={20}
                      color={selected ? colors.primary : colors.border}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ ADD ROUTE MODAL ══ */}
      <Modal
        visible={routeModal}
        animationType="slide"
        transparent
        onRequestClose={() => { if (!routeSaving) setRouteModal(false); }}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add Route</Text>
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={() => { if (!routeSaving) setRouteModal(false); }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* From barangay picker */}
              <Text style={styles.fieldLabel}>FROM BARANGAY *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setBarangayPicker('from')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.primary} />
                <Text style={[styles.pickerText, !routeFrom && { color: colors.textMuted }]}>
                  {routeFrom || 'Select barangay…'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textLight} />
              </TouchableOpacity>

              {/* To barangay picker */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>TO BARANGAY *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setBarangayPicker('to')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="map-marker" size={18} color={colors.error} />
                <Text style={[styles.pickerText, !routeTo && { color: colors.textMuted }]}>
                  {routeTo || 'Select barangay…'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textLight} />
              </TouchableOpacity>

              {/* Fare */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>FARE (₱) *</Text>
              <View style={styles.fareInputRow}>
                <Text style={styles.pesoSign}>₱</Text>
                <TextInput
                  style={styles.fareInput}
                  value={routeFare}
                  onChangeText={(v) => setRouteFare(v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Notes */}
              <Field
                label="NOTES (OPTIONAL)"
                value={routeNotes}
                onChangeText={setRouteNotes}
                placeholder="e.g. Terminal to Laylay"
                multiline
              />

              {/* Discounts */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>DISCOUNTS (%)</Text>
              <View style={styles.discountRow}>
                {[
                  { label: 'Senior',  icon: 'account-heart-outline',     value: routeSeniorDiscount,  onChange: setRouteSeniorDiscount,  placeholder: '20' },
                  { label: 'PWD',     icon: 'wheelchair-accessibility',   value: routePwdDiscount,     onChange: setRoutePwdDiscount,     placeholder: '20' },
                  { label: 'Student', icon: 'school-outline',             value: routeStudentDiscount, onChange: setRouteStudentDiscount, placeholder: '0'  },
                ].map(({ label, icon, value, onChange, placeholder }) => (
                  <View key={label} style={styles.discountField}>
                    <View style={styles.discountLabelRow}>
                      <MaterialCommunityIcons name={icon as any} size={13} color={colors.primary} />
                      <Text style={styles.discountLabel}>{label}</Text>
                    </View>
                    <View style={styles.discountInputWrap}>
                      <TextInput
                        style={styles.discountInput}
                        value={value}
                        onChangeText={onChange}
                        placeholder={placeholder}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.discountPct}>%</Text>
                    </View>
                  </View>
                ))}
              </View>
              {/* Live preview of discounted fares */}
              {routeFare && !isNaN(parseFloat(routeFare)) && parseFloat(routeFare) > 0 && (
                <View style={styles.discountPreview}>
                  {[
                    { label: 'Senior',  pct: parseFloat(routeSeniorDiscount)  || 0, icon: 'account-heart-outline' },
                    { label: 'PWD',     pct: parseFloat(routePwdDiscount)     || 0, icon: 'wheelchair-accessibility' },
                    { label: 'Student', pct: parseFloat(routeStudentDiscount) || 0, icon: 'school-outline' },
                  ].map(({ label, pct, icon }) => {
                    const base = parseFloat(routeFare);
                    const discounted = base * (1 - Math.min(100, Math.max(0, pct)) / 100);
                    return (
                      <View key={label} style={styles.discountPreviewRow}>
                        <MaterialCommunityIcons name={icon as any} size={14} color={colors.textMuted} />
                        <Text style={styles.discountPreviewLabel}>{label} ({pct}% off)</Text>
                        <Text style={styles.discountPreviewFare}>{peso(discounted)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View style={[styles.sheetFooter, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md }]}>
              <TouchableOpacity
                style={[styles.saveBtn, routeSaving && { opacity: 0.65 }]}
                onPress={saveRoute}
                disabled={routeSaving}
                activeOpacity={0.85}
              >
                {routeSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>Add Route</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ BARANGAY PICKER ══ */}
      <Modal
        visible={!!barangayPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setBarangayPicker(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '80%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  {barangayPicker === 'from' ? 'Select From Barangay' : 'Select To Barangay'}
                </Text>
                {selected?.area_barangays && selected.area_barangays.length > 0 && (
                  <Text style={[styles.sheetTitle, { fontSize: 12, fontWeight: '400', color: colors.textSecondary }]}>
                    Barangays covered by {selected.name}
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setBarangayPicker(null)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.barangayList} showsVerticalScrollIndicator={false}>
              {(selected?.area_barangays && selected.area_barangays.length > 0
                ? selected.area_barangays
                : BOAC_BARANGAYS
              ).map((brgy) => (
                <TouchableOpacity
                  key={brgy}
                  style={[
                    styles.barangayRow,
                    (barangayPicker === 'from' ? routeFrom : routeTo) === brgy && styles.barangayRowActive,
                  ]}
                  onPress={() => {
                    if (barangayPicker === 'from') setRouteFrom(brgy);
                    else setRouteTo(brgy);
                    setBarangayPicker(null);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.barangayText,
                    (barangayPicker === 'from' ? routeFrom : routeTo) === brgy && styles.barangayTextActive,
                  ]}>
                    {brgy}
                  </Text>
                  {(barangayPicker === 'from' ? routeFrom : routeTo) === brgy && (
                    <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Shared field component ───────────────────────────────────────────────────
const Field = ({
  label, value, onChangeText, placeholder, multiline, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
}) => (
  <View style={{ marginBottom: spacing.sm }}>
    <Text style={fieldStyles.label}>{label}</Text>
    <TextInput
      style={[fieldStyles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      keyboardType={keyboardType}
    />
  </View>
);

const fieldStyles = StyleSheet.create({
  label: { ...typography.labelSmall, color: colors.textMuted, fontSize: 10, letterSpacing: 1, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    ...typography.body, fontSize: 14, color: colors.text,
    backgroundColor: colors.surface,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: spacing.md,
    paddingRight: spacing.screen,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { ...typography.h2, fontSize: 22 },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, paddingHorizontal: spacing.md,
    height: 38, borderRadius: radius.md,
  },
  addBtnText: { ...typography.label, color: '#fff', fontSize: 13 },
  editBtn: {
    width: 38, height: 38, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

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
  statLabel: { ...typography.labelSmall, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  listCard: { marginHorizontal: spacing.screen, marginBottom: spacing.md },

  todaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 72,
  },
  todaAvatar: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  todaInfo: { flex: 1, minWidth: 0 },
  todaNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  todaName: { ...typography.label, fontSize: 15, color: colors.text },
  inactivePill: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  inactivePillText: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted },
  todaArea: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginBottom: 1 },
  todaMeta: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted },

  divider: { height: 1, backgroundColor: colors.borderLight },

  // Detail
  detailContainer: { flex: 1 },
  detailStatus: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screen, paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  detailStatusLeft: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, flexWrap: 'wrap' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  statusSep: { color: colors.textMuted, fontSize: 11 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { ...typography.label, fontSize: 12, fontWeight: '700' },

  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...typography.label, fontSize: 13, color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  detailScroll: { padding: spacing.screen, paddingBottom: 100 },
  detailSectionLabel: {
    ...typography.labelSmall, color: colors.textMuted,
    fontSize: 10, letterSpacing: 1.5, marginBottom: spacing.sm,
  },

  // Members
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 64,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 16, fontWeight: '800', fontFamily: 'Poppins_700Bold', color: '#fff' },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { ...typography.label, fontSize: 14, color: colors.text, marginBottom: 4 },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  identChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderLight,
  },
  identChipText: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted },

  // Routes
  routesHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  addRouteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, height: 34, borderRadius: radius.md,
  },
  addRouteBtnText: { ...typography.label, color: '#fff', fontSize: 12 },

  // Passenger type selector — horizontal pill slider
  ptScroll: { marginBottom: spacing.sm },
  ptRow: {
    flexDirection: 'row',
    paddingHorizontal: 2,
    gap: spacing.xs,
    alignItems: 'center',
  },
  ptPill: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ptPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ptPillText: {
    ...typography.labelSmall,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  ptPillTextActive: {
    color: '#fff',
  },
  ptPct: {
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.successLight,
  },
  ptPctActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  ptPctText: {
    ...typography.labelSmall,
    fontSize: 10,
    color: colors.success,
    fontWeight: '700',
  },
  ptPctTextActive: {
    color: '#fff',
  },
  discountBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.successLight,
    borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  discountBannerText: { ...typography.bodySmall, fontSize: 12, color: colors.success, fontWeight: '600' },
  routeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 56,
  },
  routeIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  routeInfo: { flex: 1, minWidth: 0 },
  routeLabel: { ...typography.label, fontSize: 13, color: colors.text, flex: 1, minWidth: 0 },
  routeArrow: { color: colors.primary },
  routeNotes: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  routeFare: { ...typography.label, fontSize: 15, color: colors.primary, fontWeight: '700' },
  routeFareGreen: { color: colors.success },
  routeFareCol: { alignItems: 'flex-end', flexShrink: 0, minWidth: 56 },
  routeFareOriginal: {
    ...typography.bodySmall, fontSize: 10, color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  routeDiscountChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3 },
  routeDiscountChip: {
    paddingHorizontal: 5, paddingVertical: 1,
    backgroundColor: colors.successLight, borderRadius: radius.pill,
  },
  routeDiscountChipText: { ...typography.labelSmall, fontSize: 9, color: colors.success, fontWeight: '700' },
  routeDelete: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  // States
  center: { alignItems: 'center', paddingVertical: 60 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: spacing.screen },
  emptyTitle: { ...typography.h3, marginTop: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    maxHeight: '92%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginTop: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screen, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  sheetTitle: { ...typography.h2, fontSize: 20 },
  sheetClose: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: spacing.screen, paddingBottom: spacing.md },
  sheetFooter: {
    paddingHorizontal: spacing.screen, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 50, borderRadius: radius.md, backgroundColor: colors.primary,
  },
  saveBtnText: { ...typography.button, fontSize: 15, color: '#fff' },

  fieldLabel: {
    ...typography.labelSmall, color: colors.textMuted,
    fontSize: 10, letterSpacing: 1, marginBottom: spacing.xs,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: 48, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  pickerText: { ...typography.label, flex: 1, fontSize: 14, color: colors.text },
  fareInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, backgroundColor: colors.surface, minHeight: 50,
  },
  pesoSign: { ...typography.label, fontSize: 16, color: colors.primary, marginRight: 4 },
  fareInput: { flex: 1, ...typography.label, fontSize: 16, color: colors.text, paddingVertical: 0 },

  // Discount fields — responsive 3-column, min 72px each so nothing clips
  discountRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  discountField: { flex: 1, minWidth: 72 },
  discountLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: spacing.xs,
  },
  discountLabel: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.3, flexShrink: 1 },
  discountInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.xs, backgroundColor: colors.surface, height: 44,
  },
  discountInput: { flex: 1, ...typography.label, fontSize: 14, color: colors.text, paddingVertical: 0, textAlign: 'center' },
  discountPct: { ...typography.label, fontSize: 13, color: colors.primary, marginLeft: 2 },
  discountPreview: {
    marginTop: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    gap: 4,
  },
  discountPreviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  discountPreviewLabel: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, flex: 1 },
  discountPreviewFare: { ...typography.label, fontSize: 13, color: colors.primary, fontWeight: '700' },

  // Barangay picker
  barangayList: { paddingHorizontal: spacing.screen, paddingBottom: spacing.lg },
  barangayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  barangayRowActive: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  barangayText: { ...typography.body, fontSize: 14, color: colors.text },
  barangayTextActive: { color: colors.primary, fontWeight: '700' },

  // Area multi-select
  areaPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: 48, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, marginBottom: spacing.sm,
  },
  areaPickerText: { ...typography.label, flex: 1, fontSize: 14, color: colors.text },
  areaChipsWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  areaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.primary,
  },
  areaChipText: { ...typography.labelSmall, fontSize: 12, color: colors.primary, fontWeight: '600' },
  areaPickerActions: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.screen, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  areaActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border,
  },
  areaActionText: { ...typography.labelSmall, fontSize: 12, color: colors.primary, fontWeight: '600' },
});

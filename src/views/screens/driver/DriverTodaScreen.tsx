/**
 * DriverTodaScreen
 *
 * Shows the logged-in driver's TODA association details (read-only).
 * Tabs:
 *  - Info  : TODA name, status (Switch — view only), service area barangays, contact
 *  - Routes: Point-to-point fares with pill-style passenger type slider
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { TodaAssociation, TodaRoute } from '@/models/entities/Toda';
import { TodaService } from '@/models/services/TodaService';
import { colors, radius, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

type TabKey = 'info' | 'routes';
type PassengerType = 'regular' | 'senior' | 'pwd' | 'student';

const PASSENGER_TYPES: { key: PassengerType; label: string; icon: string }[] = [
  { key: 'regular', label: 'Regular', icon: 'account-outline' },
  { key: 'senior',  label: 'Senior',  icon: 'account-heart-outline' },
  { key: 'pwd',     label: 'PWD',     icon: 'wheelchair-accessibility' },
  { key: 'student', label: 'Student', icon: 'school-outline' },
];

const todaService = new TodaService();
const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

function getDiscountedFare(route: TodaRoute, type: PassengerType): { fare: number; pct: number } {
  const pct =
    type === 'senior'  ? (route.senior_discount  ?? 0)
    : type === 'pwd'   ? (route.pwd_discount     ?? 0)
    : type === 'student' ? (route.student_discount ?? 0)
    : 0;
  return { fare: route.fare * (1 - pct / 100), pct };
}

// ─── Pill slider shared component ────────────────────────────────────────────
const PassengerPills = ({
  selected,
  onSelect,
  routes,
}: {
  selected: PassengerType;
  onSelect: (t: PassengerType) => void;
  routes: TodaRoute[];
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.ptScroll}
    contentContainerStyle={styles.ptRow}
  >
    {PASSENGER_TYPES.map(({ key, label, icon }) => {
      const active = selected === key;
      const pct =
        key === 'senior'  ? (routes[0]?.senior_discount  ?? 0)
        : key === 'pwd'   ? (routes[0]?.pwd_discount     ?? 0)
        : key === 'student' ? (routes[0]?.student_discount ?? 0)
        : 0;
      return (
        <TouchableOpacity
          key={key}
          style={[styles.ptPill, active && styles.ptPillActive]}
          onPress={() => onSelect(key)}
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
          {key !== 'regular' && pct > 0 && (
            <View style={[styles.ptPct, active && styles.ptPctActive]}>
              <Text style={[styles.ptPctText, active && styles.ptPctTextActive]}>
                -{pct}%
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

// ─── Main screen ─────────────────────────────────────────────────────────────
export const DriverTodaScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);

  const [toda, setToda] = useState<TodaAssociation | null>(null);
  const [routes, setRoutes] = useState<TodaRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('info');
  const [passengerType, setPassengerType] = useState<PassengerType>('regular');

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const membership = (user as any)?.toda_membership as string | null | undefined;
    if (!membership) {
      setToda(null);
      setRoutes([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const all = await todaService.listAll();
      const found = all.find((t) => t.name === membership) ?? null;
      setToda(found);
      if (found) {
        setRoutes(await todaService.listRoutes(found.id));
      } else {
        setRoutes([]);
      }
    } catch (e: any) {
      console.error('DriverTodaScreen load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>My TODA</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {toda ? toda.name : (user as any)?.toda_membership ?? 'Not assigned'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !toda ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="account-group-outline" size={56} color={colors.textLight} />
          <Text style={styles.emptyTitle}>No TODA assigned</Text>
          <Text style={styles.emptyText}>
            Wait for your admin to assign you to a TODA association. You'll receive a notification once it's done.
          </Text>
        </View>
      ) : (
        <>
          {/* ── Banner ── */}
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <MaterialCommunityIcons name="account-group" size={28} color="#fff" />
            </View>
            <View style={styles.bannerBody}>
              <Text style={styles.bannerName}>{toda.name}</Text>
              <View style={styles.bannerMeta}>
                {/* Status — read-only Switch */}
                <View style={styles.statusRow}>
                  <Switch
                    value={toda.is_active}
                    disabled
                    trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(255,255,255,0.6)' }}
                    thumbColor={toda.is_active ? '#fff' : 'rgba(255,255,255,0.4)'}
                    ios_backgroundColor="rgba(255,255,255,0.2)"
                  />
                  <Text style={styles.statusLabel}>
                    {toda.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                {toda.area_barangays?.length > 0 && (
                  <Text style={styles.bannerMetaText}>
                    {toda.area_barangays.length} barangay{toda.area_barangays.length > 1 ? 's' : ''}
                  </Text>
                )}
                <Text style={styles.bannerMetaText}>
                  {routes.length} route{routes.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Tabs ── */}
          <View style={styles.tabBar}>
            {([
              { key: 'info',   label: 'Info',   icon: 'information-outline' },
              { key: 'routes', label: 'Routes', icon: 'map-marker-path' },
            ] as { key: TabKey; label: string; icon: string }[]).map(({ key, label, icon }) => (
              <TouchableOpacity
                key={key}
                style={[styles.tabItem, tab === key && styles.tabItemActive]}
                onPress={() => setTab(key)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons
                  name={icon as any}
                  size={16}
                  color={tab === key ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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
            {/* ── INFO TAB ── */}
            {tab === 'info' && (
              <>
                {(toda.contact_name || toda.contact_phone) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>CONTACT</Text>
                    <Card variant="elevated" padding="none" style={styles.infoCard}>
                      {toda.contact_name ? (
                        <View style={styles.infoRow}>
                          <View style={styles.infoIconBox}>
                            <MaterialCommunityIcons name="account-outline" size={18} color={colors.primary} />
                          </View>
                          <View style={styles.infoRowText}>
                            <Text style={styles.infoRowLabel}>Contact Person</Text>
                            <Text style={styles.infoRowValue}>{toda.contact_name}</Text>
                          </View>
                        </View>
                      ) : null}
                      {toda.contact_phone ? (
                        <View style={[styles.infoRow, toda.contact_name ? styles.infoRowBorder : null]}>
                          <View style={styles.infoIconBox}>
                            <MaterialCommunityIcons name="phone-outline" size={18} color={colors.primary} />
                          </View>
                          <View style={styles.infoRowText}>
                            <Text style={styles.infoRowLabel}>Phone</Text>
                            <Text style={styles.infoRowValue}>{toda.contact_phone}</Text>
                          </View>
                        </View>
                      ) : null}
                    </Card>
                  </View>
                )}

                {toda.area_barangays?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>
                      SERVICE AREA · {toda.area_barangays.length} BARANGAY{toda.area_barangays.length > 1 ? 'S' : ''}
                    </Text>
                    <View style={styles.barangayGrid}>
                      {toda.area_barangays.map((brgy) => (
                        <View key={brgy} style={styles.barangayChip}>
                          <MaterialCommunityIcons name="map-marker" size={11} color={colors.primary} />
                          <Text style={styles.barangayChipText}>{brgy}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {toda.notes ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>NOTES</Text>
                    <Card variant="elevated" padding="md">
                      <Text style={styles.notesText}>{toda.notes}</Text>
                    </Card>
                  </View>
                ) : null}
              </>
            )}

            {/* ── ROUTES TAB ── */}
            {tab === 'routes' && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  FARES · {routes.length} ROUTE{routes.length !== 1 ? 'S' : ''}
                </Text>

                {routes.length === 0 ? (
                  <View style={styles.emptyRoutes}>
                    <MaterialCommunityIcons name="map-marker-off-outline" size={40} color={colors.textLight} />
                    <Text style={styles.emptyTitle}>No routes set</Text>
                    <Text style={styles.emptyText}>
                      Your TODA admin hasn't added any routes yet.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Pill slider */}
                    <PassengerPills
                      selected={passengerType}
                      onSelect={setPassengerType}
                      routes={routes}
                    />

                    {/* Discount info banner */}
                    {passengerType !== 'regular' && (() => {
                      const pct =
                        passengerType === 'senior'  ? (routes[0]?.senior_discount  ?? 0)
                        : passengerType === 'pwd'   ? (routes[0]?.pwd_discount     ?? 0)
                        : (routes[0]?.student_discount ?? 0);
                      const label = PASSENGER_TYPES.find((p) => p.key === passengerType)!;
                      return (
                        <View style={styles.discountBanner}>
                          <MaterialCommunityIcons name={label.icon as any} size={15} color={colors.success} />
                          <Text style={styles.discountBannerText}>
                            {pct > 0
                              ? `${pct}% ${label.label} discount applied`
                              : `No discount set for ${label.label}`}
                          </Text>
                        </View>
                      );
                    })()}

                    {/* Route list */}
                    <Card variant="elevated" padding="none" style={styles.routesCard}>
                      {routes.map((route, idx) => {
                        const { fare: discounted, pct } = getDiscountedFare(route, passengerType);
                        const hasDiscount = pct > 0;
                        return (
                          <View key={route.id}>
                            <View style={styles.routeRow}>
                              <View style={styles.routeIconBox}>
                                <MaterialCommunityIcons name="map-marker-path" size={16} color={colors.primary} />
                              </View>
                              <View style={styles.routeInfo}>
                                <View style={styles.routePoints}>
                                  <Text style={styles.routePoint} numberOfLines={1}>{route.from_barangay}</Text>
                                  <MaterialCommunityIcons name="arrow-right" size={13} color={colors.primary} />
                                  <Text style={styles.routePoint} numberOfLines={1}>{route.to_barangay}</Text>
                                </View>
                                {route.notes ? (
                                  <Text style={styles.routeNotes} numberOfLines={1}>{route.notes}</Text>
                                ) : null}
                              </View>
                              <View style={styles.fareCol}>
                                {hasDiscount && (
                                  <Text style={styles.fareOriginal}>{peso(route.fare)}</Text>
                                )}
                                <Text style={[styles.routeFare, hasDiscount && styles.routeFareDiscounted]}>
                                  {peso(discounted)}
                                </Text>
                              </View>
                            </View>
                            {idx < routes.length - 1 && <View style={styles.divider} />}
                          </View>
                        );
                      })}
                    </Card>

                    <Text style={styles.hint}>
                      * Fares shown are for reference only. Actual fare is set by your TODA admin.
                    </Text>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
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

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.screen,
  },
  emptyTitle: { ...typography.h3, marginTop: spacing.md, textAlign: 'center' },
  emptyText: {
    ...typography.body, color: colors.textMuted,
    textAlign: 'center', marginTop: spacing.xs, lineHeight: 20,
  },

  // Banner
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.screen, paddingVertical: spacing.md,
    backgroundColor: colors.primary,
  },
  bannerIcon: {
    width: 52, height: 52, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bannerBody: { flex: 1, minWidth: 0 },
  bannerName: { ...typography.h3, color: '#fff', fontSize: 20 },
  bannerMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  bannerMetaText: { ...typography.bodySmall, fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  // Switch status row (read-only)
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusLabel: { ...typography.bodySmall, fontSize: 12, color: '#fff', fontWeight: '600' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: colors.primary },
  tabText: { ...typography.label, fontSize: 13, color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  scrollContent: { paddingBottom: 100 },

  section: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg },
  sectionLabel: {
    ...typography.labelSmall, color: colors.textMuted,
    fontSize: 10, letterSpacing: 1.5, marginBottom: spacing.sm,
  },

  // Info rows
  infoCard: { overflow: 'hidden' },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  infoIconBox: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  infoRowText: { flex: 1, minWidth: 0 },
  infoRowLabel: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted, letterSpacing: 0.5 },
  infoRowValue: { ...typography.label, fontSize: 15, color: colors.text, marginTop: 1 },

  barangayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  barangayChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
  },
  barangayChipText: { ...typography.labelSmall, fontSize: 12, color: colors.primary, fontWeight: '600' },

  notesText: { ...typography.body, fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  // Passenger type pills
  ptScroll: { marginBottom: spacing.sm },
  ptRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', paddingHorizontal: 1 },
  ptPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ptPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ptPillText: { ...typography.labelSmall, fontSize: 12, color: colors.primary, fontWeight: '600' },
  ptPillTextActive: { color: '#fff' },
  ptPct: {
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.successLight,
  },
  ptPctActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  ptPctText: { ...typography.labelSmall, fontSize: 10, color: colors.success, fontWeight: '700' },
  ptPctTextActive: { color: '#fff' },

  // Discount banner
  discountBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.successLight,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  discountBannerText: { ...typography.bodySmall, fontSize: 12, color: colors.success, fontWeight: '600' },

  // Routes
  routesCard: { overflow: 'hidden' },
  routeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 14,
  },
  routeIconBox: {
    width: 34, height: 34, borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  routeInfo: { flex: 1, minWidth: 0 },
  routePoints: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  routePoint: { ...typography.label, fontSize: 13, color: colors.text, flexShrink: 1 },
  routeNotes: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  fareCol: { alignItems: 'flex-end', flexShrink: 0, minWidth: 56 },
  fareOriginal: {
    ...typography.bodySmall, fontSize: 10, color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  routeFare: { ...typography.label, fontSize: 15, color: colors.primary, fontWeight: '700' },
  routeFareDiscounted: { color: colors.success },
  divider: { height: 1, backgroundColor: colors.borderLight },

  emptyRoutes: { alignItems: 'center', paddingVertical: 40 },
  hint: {
    ...typography.bodySmall, fontSize: 11, color: colors.textMuted,
    fontStyle: 'italic', marginTop: spacing.sm, paddingBottom: spacing.md,
  },
});

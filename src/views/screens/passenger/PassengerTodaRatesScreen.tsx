/**
 * PassengerTodaRatesScreen
 *
 * Shows all active TODA associations and their point-to-point fares.
 * Passengers can tap a TODA to expand/collapse its routes.
 * Per-TODA pill slider switches between Regular / Senior / PWD / Student
 * discount rates. Read-only — no driver list shown.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { TodaAssociation, TodaRoute } from '@/models/entities/Toda';
import { TodaService } from '@/models/services/TodaService';
import { colors, radius, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

// ─── Types ────────────────────────────────────────────────────────────────────
type PassengerType = 'regular' | 'senior' | 'pwd' | 'student';

const PASSENGER_TYPES: { key: PassengerType; label: string; icon: string }[] = [
  { key: 'regular', label: 'Regular', icon: 'account-outline' },
  { key: 'senior',  label: 'Senior',  icon: 'account-heart-outline' },
  { key: 'pwd',     label: 'PWD',     icon: 'wheelchair-accessibility' },
  { key: 'student', label: 'Student', icon: 'school-outline' },
];

const todaService = new TodaService();
const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

function getDiscount(route: TodaRoute, type: PassengerType): number {
  if (type === 'senior')  return route.senior_discount  ?? 0;
  if (type === 'pwd')     return route.pwd_discount     ?? 0;
  if (type === 'student') return route.student_discount ?? 0;
  return 0;
}

// ─── Pill slider ─────────────────────────────────────────────────────────────
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

// ─── Single TODA card ─────────────────────────────────────────────────────────
const TodaCard = ({
  toda,
  routes,
  loadingRoutes,
  expanded,
  onToggle,
}: {
  toda: TodaAssociation;
  routes: TodaRoute[];
  loadingRoutes: boolean;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const [passengerType, setPassengerType] = useState<PassengerType>('regular');

  return (
    <View style={styles.todaCard}>
      {/* ── TODA header row — tap to expand ── */}
      <TouchableOpacity
        style={styles.todaHeader}
        onPress={onToggle}
        activeOpacity={0.76}
      >
        <View style={styles.todaAvatar}>
          <MaterialCommunityIcons name="account-group" size={22} color={colors.primary} />
        </View>
        <View style={styles.todaInfo}>
          <Text style={styles.todaName}>{toda.name}</Text>
          <View style={styles.todaMeta}>
            {toda.area_barangays?.length > 0 && (
              <Text style={styles.todaMetaText}>
                {toda.area_barangays.length} barangay{toda.area_barangays.length > 1 ? 's' : ''}
              </Text>
            )}
            {toda.area_barangays?.length > 0 && routes.length > 0 && (
              <Text style={styles.todaMetaDot}>·</Text>
            )}
            {routes.length > 0 && (
              <Text style={styles.todaMetaText}>
                {routes.length} route{routes.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={colors.textLight}
        />
      </TouchableOpacity>

      {/* ── Expanded routes section ── */}
      {expanded && (
        <View style={styles.expandedBody}>
          {loadingRoutes ? (
            <View style={styles.routesLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.routesLoadingText}>Loading routes…</Text>
            </View>
          ) : routes.length === 0 ? (
            <View style={styles.routesEmpty}>
              <MaterialCommunityIcons name="map-marker-off-outline" size={32} color={colors.textLight} />
              <Text style={styles.routesEmptyText}>No routes set for this TODA yet.</Text>
            </View>
          ) : (
            <>
              {/* Pill slider */}
              <PassengerPills
                selected={passengerType}
                onSelect={setPassengerType}
                routes={routes}
              />

              {/* Discount banner */}
              {passengerType !== 'regular' && (() => {
                const pt = PASSENGER_TYPES.find((p) => p.key === passengerType)!;
                const pct =
                  passengerType === 'senior'  ? (routes[0]?.senior_discount  ?? 0)
                  : passengerType === 'pwd'   ? (routes[0]?.pwd_discount     ?? 0)
                  : (routes[0]?.student_discount ?? 0);
                return (
                  <View style={styles.discountBanner}>
                    <MaterialCommunityIcons name={pt.icon as any} size={14} color={colors.success} />
                    <Text style={styles.discountBannerText}>
                      {pct > 0
                        ? `${pct}% ${pt.label} discount applied`
                        : `No discount set for ${pt.label}`}
                    </Text>
                  </View>
                );
              })()}

              {/* Route rows */}
              <Card variant="elevated" padding="none" style={styles.routesCard}>
                {routes.map((route, idx) => {
                  const discPct = getDiscount(route, passengerType);
                  const discounted = route.fare * (1 - discPct / 100);
                  const hasDiscount = discPct > 0;
                  return (
                    <View key={route.id}>
                      <View style={styles.routeRow}>
                        <View style={styles.routeIconBox}>
                          <MaterialCommunityIcons name="map-marker-path" size={15} color={colors.primary} />
                        </View>
                        <View style={styles.routeInfo}>
                          <View style={styles.routePoints}>
                            <Text style={styles.routePoint} numberOfLines={1}>
                              {route.from_barangay}
                            </Text>
                            <MaterialCommunityIcons name="arrow-right" size={12} color={colors.primary} />
                            <Text style={styles.routePoint} numberOfLines={1}>
                              {route.to_barangay}
                            </Text>
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
            </>
          )}
        </View>
      )}
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export const PassengerTodaRatesScreen = () => {
  const insets = useSafeAreaInsets();

  const [todas, setTodas] = useState<TodaAssociation[]>([]);
  const [routesMap, setRoutesMap] = useState<Record<string, TodaRoute[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Load active TODAs only ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const all = await todaService.listAll();
      setTodas(all.filter((t) => t.is_active));
    } catch (e: any) {
      console.error('PassengerTodaRatesScreen load failed:', e);
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

  // ── Toggle a TODA expansion — lazy-load its routes ─────────────────────────
  const toggleToda = async (toda: TodaAssociation) => {
    const isOpen = expanded[toda.id];
    setExpanded((prev) => ({ ...prev, [toda.id]: !isOpen }));

    // Only fetch if not already loaded
    if (!isOpen && !routesMap[toda.id]) {
      setLoadingMap((prev) => ({ ...prev, [toda.id]: true }));
      try {
        const r = await todaService.listRoutes(toda.id);
        setRoutesMap((prev) => ({ ...prev, [toda.id]: r }));
      } catch (e: any) {
        console.error('Route load failed:', e);
        setRoutesMap((prev) => ({ ...prev, [toda.id]: [] }));
      } finally {
        setLoadingMap((prev) => ({ ...prev, [toda.id]: false }));
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="map-marker-path" size={24} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>TODA Rates</Text>
          <Text style={styles.headerSub}>
            {loading ? 'Loading…' : `${todas.length} active association${todas.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : todas.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="account-group-outline" size={56} color={colors.textLight} />
          <Text style={styles.emptyTitle}>No active TODAs</Text>
          <Text style={styles.emptyText}>
            No TODA associations are currently active. Check back later.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setRoutesMap({});   // clear cache on pull-refresh
                setExpanded({});
                void load();
              }}
              tintColor={colors.primary}
            />
          }
        >
          {/* Info hint */}
          <View style={styles.hint}>
            <MaterialCommunityIcons name="information-outline" size={14} color={colors.textMuted} />
            <Text style={styles.hintText}>
              Tap a TODA to see routes and fares. Use the pills to view discounts for seniors, PWDs, and students.
            </Text>
          </View>

          {/* TODA list */}
          {todas.map((toda) => (
            <TodaCard
              key={toda.id}
              toda={toda}
              routes={routesMap[toda.id] ?? []}
              loadingRoutes={loadingMap[toda.id] ?? false}
              expanded={expanded[toda.id] ?? false}
              onToggle={() => toggleToda(toda)}
            />
          ))}

          <Text style={styles.footer}>
            * Fares are for reference only and may be subject to change by the TODA admin.
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
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

  scrollContent: { paddingBottom: 120 },

  hint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  hintText: { ...typography.bodySmall, fontSize: 12, color: colors.textMuted, flex: 1, lineHeight: 18 },

  // TODA card
  todaCard: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  todaHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    minHeight: 68,
  },
  todaAvatar: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  todaInfo: { flex: 1, minWidth: 0 },
  todaName: { ...typography.label, fontSize: 15, color: colors.text },
  todaMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' },
  todaMetaText: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  todaMetaDot: { ...typography.bodySmall, fontSize: 12, color: colors.textMuted },

  // Expanded body
  expandedBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },

  routesLoading: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  routesLoadingText: { ...typography.bodySmall, color: colors.textMuted },

  routesEmpty: {
    alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm,
  },
  routesEmptyText: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },

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
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  discountBannerText: { ...typography.bodySmall, fontSize: 12, color: colors.success, fontWeight: '600' },

  // Route rows
  routesCard: { overflow: 'hidden' },
  routeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 13,
  },
  routeIconBox: {
    width: 32, height: 32, borderRadius: radius.sm,
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
  routeFare: { ...typography.label, fontSize: 14, color: colors.primary, fontWeight: '700' },
  routeFareDiscounted: { color: colors.success },
  divider: { height: 1, backgroundColor: colors.borderLight },

  footer: {
    ...typography.bodySmall, fontSize: 11, color: colors.textMuted,
    fontStyle: 'italic', textAlign: 'center',
    marginHorizontal: spacing.screen,
    marginTop: spacing.sm,
  },
});

import React, { useState, useCallback } from 'react';
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AdminService, AdminStats, Analytics, FareMatrix } from '@/models/services/AdminService';
import { ReportService } from '@/models/services/ReportService';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import { ActivityLog } from '@/models/entities/ActivityLog';
import { FranchiseService } from '@/models/services/FranchiseService';
import { FranchiseApplication } from '@/models/entities/Franchise';
import { colors, gradients, radius, spacing, typography } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

const CARD_WIDTH = (Dimensions.get('window').width - 24 * 2 - 16) / 2;

const adminService = new AdminService();
const reportService = new ReportService();
const franchiseService = new FranchiseService();

const peso = (n: number) =>
  `₱${Math.round(n).toLocaleString('en-PH')}`;

const relativeTime = (iso: any): string => {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const AdminDashboard = () => {
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [fare, setFare] = useState<FareMatrix | null>(null);
  const [openReports, setOpenReports] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Franchise alert state
  const [expiringFranchises, setExpiringFranchises] = useState<FranchiseApplication[]>([]);
  const [franchiseSummary, setFranchiseSummary] = useState<{
    active: number; expiring: number; expired: number; pending_renewal: number;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, a, l, f, r] = await Promise.all([
        adminService.getStats(),
        adminService.getAnalytics(),
        ActivityLogService.getRecentLogs(4),
        adminService.getFareMatrix(),
        reportService.countOpen(),
      ]);
      setStats(s);
      setAnalytics(a);
      setLogs(l);
      setFare(f);
      setOpenReports(r);

      // Franchise alerts — load registry and compute summary + expiring soon
      try {
        const registry = await franchiseService.getRegistry();
        const today = new Date();
        const in30 = new Date(today);
        in30.setDate(today.getDate() + 30);
        const todayStr = today.toISOString().slice(0, 10);
        const in30Str = in30.toISOString().slice(0, 10);

        const expiring = registry.filter(
          (fr) =>
            fr.expiry_date &&
            fr.expiry_date >= todayStr &&
            fr.expiry_date <= in30Str &&
            fr.franchise_status !== 'terminated'
        );
        setExpiringFranchises(expiring);

        const active         = registry.filter((fr) => fr.franchise_status === 'active').length;
        const expired        = registry.filter((fr) => fr.franchise_status === 'expired' || (fr.expiry_date && fr.expiry_date < todayStr)).length;
        const pending_renewal= registry.filter((fr) => fr.franchise_status === 'pending_renewal').length;
        setFranchiseSummary({ active, expiring: expiring.length, expired, pending_renewal });
      } catch {
        // Non-fatal — dashboard still loads without franchise alerts
      }
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
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

  const kpiData = [
    { id: '1', title: 'Total Revenue', value: stats ? peso(stats.revenue) : '—', icon: 'cash-multiple' },
    { id: '2', title: 'Active Drivers', value: stats ? `${stats.activeDrivers}` : '—', icon: 'car-hatchback' },
    { id: '3', title: 'Completed Trips', value: stats ? `${stats.completedTrips}` : '—', icon: 'check-circle-outline' },
    { id: '4', title: 'Total Users', value: stats ? `${stats.totalUsers}` : '—', icon: 'account-group-outline' },
  ];

  // Operations queue derived from live counts; only show what needs attention.
  const queue: { id: string; title: string; level: string; icon: string; route: string }[] = [];
  if (stats?.pendingFranchises) queue.push({ id: 'f', title: `${stats.pendingFranchises} franchise request${stats.pendingFranchises > 1 ? 's' : ''} need review`, level: 'Compliance · MTOP', icon: 'shield-alert-outline', route: 'MTOP' });
  if (stats?.pendingDrivers) queue.push({ id: 'd', title: `${stats.pendingDrivers} driver${stats.pendingDrivers > 1 ? 's' : ''} awaiting verification`, level: 'Onboarding', icon: 'account-clock-outline', route: 'UserManagement' });
  if (stats?.cancelledTrips) queue.push({ id: 'c', title: `${stats.cancelledTrips} cancelled trip${stats.cancelledTrips > 1 ? 's' : ''} on record`, level: 'Support · Audit', icon: 'clipboard-search-outline', route: 'Logs' });

  const weekBars = analytics?.bars.Weekly ?? [];
  const weekLabels = analytics?.labels.Weekly ?? [];
  const maxBar = Math.max(1, ...weekBars);

  const KPICard = ({ item }: { item: typeof kpiData[0] }) => (
    <Card variant="elevated" padding="md" style={styles.kpiCard}>
      <View style={styles.kpiHeader}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.primary} />
        </View>
      </View>
      <Text style={[styles.kpiValue, typography.currency]}>{item.value}</Text>
      <Text style={styles.kpiTitle}>{item.title}</Text>
    </Card>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        <LinearGradient colors={gradients.admin} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Command Center</Text>
            <View style={styles.liveIndicatorRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live · {stats ? `${stats.totalUsers} users` : 'syncing'}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('UserManagement')}
            activeOpacity={0.76}
          >
            <MaterialCommunityIcons name="account-group-outline" size={21} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>PLATFORM PERFORMANCE</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Analytics')}>
              <Text style={styles.seeAllText}>Analytics</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {kpiData.map(item => <KPICard key={item.id} item={item} />)}
          </View>

          {/* Prominent Reports entry — always visible, urgent when open > 0 */}
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Reports')}>
            <Card variant="elevated" padding="md" style={styles.reportsCard}>
              <View style={[styles.reportsIcon, openReports > 0 && { backgroundColor: colors.errorLight }]}>
                <MaterialCommunityIcons name="flag" size={24} color={openReports > 0 ? colors.error : colors.primary} />
                {openReports > 0 && (
                  <View style={styles.reportsBadge}>
                    <Text style={styles.reportsBadgeText}>{openReports > 9 ? '9+' : openReports}</Text>
                  </View>
                )}
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.reportsTitle}>User Reports</Text>
                <Text style={styles.queueLevel}>
                  {openReports > 0
                    ? `${openReports} open report${openReports > 1 ? 's' : ''} need${openReports === 1 ? 's' : ''} your review`
                    : 'Review passenger & driver reports'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textLight} />
            </Card>
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>CONFIGURATION</Text>
          </View>
          <Card variant="elevated" padding="none" style={styles.queueCard}>
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('FareSettings')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="cash-edit" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>
                  {fare ? `Fare · ₱${fare.base_fare} base + ₱${fare.per_km_rate}/km` : 'Fare matrix'}
                </Text>
                <Text style={styles.queueLevel}>
                  {fare?.peak_hours_enabled ? `Peak surcharge ×${fare.peak_hour_multiplier}` : 'Tap to edit pricing'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('PlaceManagement')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="map-marker-multiple-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>Popular Places</Text>
                <Text style={styles.queueLevel}>Add, edit & upload destination photos</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('FranchiseRegistry')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="book-open-variant" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>Franchise Registry</Text>
                <Text style={styles.queueLevel}>Renewals, succession, transfers &amp; termination</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('InventoryManagement')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="package-variant-closed" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>Association Inventory</Text>
                <Text style={styles.queueLevel}>Monitor total, issued &amp; remaining stock</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('ManagementReports')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="file-chart-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>Management Reports</Text>
                <Text style={styles.queueLevel}>Franchise, renewal, transfer, violation &amp; stock reports</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('RidePaymentManagement')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="receipt-text-check-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>Ride Payments</Text>
                <Text style={styles.queueLevel}>Review passenger payment proof and references</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('ViolationManagement')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.errorLight }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>Violations</Text>
                <Text style={styles.queueLevel}>Record & track driver violation status</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('Reports')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="flag-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>User Reports</Text>
                <Text style={styles.queueLevel}>Review &amp; action driver / passenger reports</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('AdminMessages')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="message-text-lock-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>Message Supervision</Text>
                <Text style={styles.queueLevel}>Moderate trip conversations (read-only)</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('Announcements')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="bullhorn-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>Announcements</Text>
                <Text style={styles.queueLevel}>Broadcast messages to drivers & passengers</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('BookingMonitoring')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="car-search-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>Booking Monitor</Text>
                <Text style={styles.queueLevel}>View & filter all passenger trips</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('TodaAssignment')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="account-group-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>TODA Assignment</Text>
                <Text style={styles.queueLevel}>Assign operators to their TODA</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate('TodaManagement')}>
              <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="map-marker-path" size={20} color={colors.primary} />
              </View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>TODA Management</Text>
                <Text style={styles.queueLevel}>Associations, members & point-to-point routes</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>
          </Card>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>VOLUME OVERVIEW · LAST 7 DAYS</Text>
          </View>
          <Card variant="elevated" padding="lg" style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={[styles.chartTotal, typography.number]}>{analytics?.metrics.Daily.trips ?? 0}</Text>
                <Text style={styles.chartSubtitle}>Trips completed today</Text>
              </View>
              <View style={styles.chartBadge}>
                <MaterialCommunityIcons name="trending-up" size={14} color={colors.success} />
                <Text style={styles.chartBadgeText}>LIVE</Text>
              </View>
            </View>
            <View style={styles.chartBars}>
              {weekBars.map((value, idx) => (
                <View key={idx} style={styles.barColumn}>
                  <View style={[styles.barTrack, { height: 100 }]}>
                    <View style={[styles.bar, { height: `${Math.max(4, (value / maxBar) * 100)}%` }]} />
                  </View>
                  <Text style={styles.barLabel}>{weekLabels[idx]}</Text>
                </View>
              ))}
              {weekBars.length === 0 &&
                [0, 1, 2, 3, 4, 5, 6].map((idx) => (
                  <View key={idx} style={styles.barColumn}>
                    <View style={[styles.barTrack, { height: 100 }]}>
                      <View style={[styles.bar, { height: '4%' }]} />
                    </View>
                  </View>
                ))}
            </View>
          </Card>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>OPERATIONS QUEUE</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('UserManagement')}>
              <Text style={styles.seeAllText}>Manage</Text>
            </TouchableOpacity>
          </View>
          <Card variant="elevated" padding="none" style={styles.queueCard}>
            {queue.length === 0 ? (
              <View style={styles.queueItem}>
                <View style={[styles.queueIcon, { backgroundColor: colors.successLight }]}>
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
                </View>
                <View style={styles.queueCopy}>
                  <Text style={styles.queueTitle}>All clear</Text>
                  <Text style={styles.queueLevel}>No pending operations</Text>
                </View>
              </View>
            ) : (
              queue.map((item, index) => (
                <View key={item.id}>
                  <TouchableOpacity style={styles.queueItem} activeOpacity={0.76} onPress={() => navigation.navigate(item.route)}>
                    <View style={[styles.queueIcon, { backgroundColor: colors.surfaceAlt }]}>
                      <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.primary} />
                    </View>
                    <View style={styles.queueCopy}>
                      <Text style={styles.queueTitle}>{item.title}</Text>
                      <Text style={styles.queueLevel}>{item.level}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
                  </TouchableOpacity>
                  {index < queue.length - 1 && <View style={styles.divider} />}
                </View>
              ))
            )}
          </Card>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>FRANCHISE ALERTS</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('FranchiseRegistry')}>
              <Text style={styles.seeAllText}>Registry</Text>
            </TouchableOpacity>
          </View>
          {/* Franchise summary chips */}
          {franchiseSummary && (
            <View style={styles.franchiseSummaryRow}>
              <View style={[styles.franchiseChip, { backgroundColor: colors.successLight }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={14} color={colors.success} />
                <Text style={[styles.franchiseChipLabel, { color: colors.success }]}>
                  {franchiseSummary.active} Active
                </Text>
              </View>
              <View style={[styles.franchiseChip, { backgroundColor: colors.warningLight }]}>
                <MaterialCommunityIcons name="clock-alert-outline" size={14} color={colors.warning} />
                <Text style={[styles.franchiseChipLabel, { color: colors.warning }]}>
                  {franchiseSummary.expiring} Expiring
                </Text>
              </View>
              <View style={[styles.franchiseChip, { backgroundColor: colors.errorLight }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={14} color={colors.error} />
                <Text style={[styles.franchiseChipLabel, { color: colors.error }]}>
                  {franchiseSummary.expired} Expired
                </Text>
              </View>
              {franchiseSummary.pending_renewal > 0 && (
                <View style={[styles.franchiseChip, { backgroundColor: colors.infoLight }]}>
                  <MaterialCommunityIcons name="autorenew" size={14} color={colors.info} />
                  <Text style={[styles.franchiseChipLabel, { color: colors.info }]}>
                    {franchiseSummary.pending_renewal} Renewal
                  </Text>
                </View>
              )}
            </View>
          )}
          {/* Expiring-soon list */}
          {expiringFranchises.length === 0 ? (
            <Card variant="elevated" padding="md" style={styles.alertsCard}>
              <View style={styles.alertsEmpty}>
                <MaterialCommunityIcons name="shield-check-outline" size={28} color={colors.textLight} />
                <Text style={styles.alertsEmptyText}>No franchises expiring in the next 30 days</Text>
              </View>
            </Card>
          ) : (
            <Card variant="elevated" padding="none" style={styles.alertsCard}>
              {expiringFranchises.map((fr, index) => {
                const daysLeft = Math.ceil(
                  (new Date(fr.expiry_date!).getTime() - Date.now()) / 86_400_000
                );
                const urgent = daysLeft <= 7;
                return (
                  <View key={fr.id}>
                    <TouchableOpacity
                      style={styles.alertItem}
                      activeOpacity={0.76}
                      onPress={() => navigation.navigate('FranchiseRegistry')}
                    >
                      <View style={[styles.alertIcon, { backgroundColor: urgent ? colors.errorLight : colors.warningLight }]}>
                        <MaterialCommunityIcons
                          name={urgent ? 'alert' : 'clock-alert-outline'}
                          size={18}
                          color={urgent ? colors.error : colors.warning}
                        />
                      </View>
                      <View style={styles.alertCopy}>
                        <Text style={styles.alertName} numberOfLines={1}>
                          {fr.current_holder_name || fr.driver_name}
                        </Text>
                        <Text style={styles.alertMeta}>
                          {fr.body_number ? `Body #${fr.body_number} · ` : ''}
                          Expires {fr.expiry_date}
                        </Text>
                      </View>
                      <View style={[styles.daysLeftBadge, { backgroundColor: urgent ? colors.errorLight : colors.warningLight }]}>
                        <Text style={[styles.daysLeftText, { color: urgent ? colors.error : colors.warning }]}>
                          {daysLeft}d
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {index < expiringFranchises.length - 1 && <View style={styles.divider} />}
                  </View>
                );
              })}
            </Card>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>RECENT SYSTEM ACTIVITY</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Logs')}>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <Card variant="elevated" padding="none" style={styles.logCard}>
            {logs.length === 0 ? (
              <View style={styles.logItem}>
                <View style={[styles.logIndicator, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={[styles.logDot, { backgroundColor: colors.textLight }]} />
                </View>
                <View style={styles.logContent}>
                  <Text style={styles.logAction}>No recent activity</Text>
                  <Text style={styles.logDetails}>Events will appear here as they happen.</Text>
                </View>
              </View>
            ) : (
              logs.map((log, index) => {
                const statusColor =
                  log.severity === 'success' ? colors.success : log.severity === 'warning' ? colors.warning : log.severity === 'error' ? colors.error : colors.info;
                const statusBg =
                  log.severity === 'success' ? colors.successLight : log.severity === 'warning' ? colors.warningLight : log.severity === 'error' ? colors.errorLight : colors.infoLight;
                return (
                  <View key={log.id || index}>
                    <View style={styles.logItem}>
                      <View style={[styles.logIndicator, { backgroundColor: statusBg }]}>
                        <View style={[styles.logDot, { backgroundColor: statusColor }]} />
                      </View>
                      <View style={styles.logContent}>
                        <View style={styles.logTitleRow}>
                          <Text style={styles.logAction}>{log.action_type.replace(/_/g, ' ')}</Text>
                          <Text style={styles.logTime}>{relativeTime(log.created_at)}</Text>
                        </View>
                        <Text style={styles.logDetails} numberOfLines={2}>{log.description}</Text>
                      </View>
                    </View>
                    {index < logs.length - 1 && <View style={styles.divider} />}
                  </View>
                );
              })
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: 40,
    paddingBottom: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h1,
    color: '#FFFFFF',
    fontSize: 28,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 8,
  },
  liveText: {
    ...typography.labelSmall,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    letterSpacing: 1,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  body: {
    marginTop: -20,
    paddingHorizontal: spacing.screen,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: spacing.xl,
  },
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  seeAllText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  kpiCard: {
    width: CARD_WIDTH,
    minHeight: 130,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  trendText: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 2,
  },
  kpiValue: {
    ...typography.h2,
    color: colors.text,
    fontSize: 24,
  },
  kpiTitle: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chartCard: {
    marginBottom: spacing.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  chartTotal: {
    ...typography.h1,
    color: colors.text,
    fontSize: 34,
  },
  chartSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successLight,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chartBadgeText: {
    ...typography.labelSmall,
    color: colors.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  barColumn: {
    alignItems: 'center',
    width: 30,
  },
  barTrack: {
    width: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  barLabel: {
    ...typography.labelSmall,
    color: colors.textLight,
    fontSize: 9,
    marginTop: 8,
  },
  queueCard: {
    marginBottom: spacing.sm,
  },
  reportsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  reportsIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  reportsBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  reportsBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  reportsTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 16,
  },
  queueItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  queueIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  queueCopy: {
    flex: 1,
  },
  queueTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 14,
  },
  queueLevel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  logCard: {
    marginBottom: spacing.sm,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  logIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logContent: {
    flex: 1,
  },
  logTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  logAction: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
  },
  logTime: {
    ...typography.bodySmall,
    color: colors.textLight,
    fontSize: 11,
  },
  logDetails: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
  // ── Franchise Alerts ──
  franchiseSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  franchiseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  franchiseChipLabel: {
    ...typography.labelSmall,
    fontSize: 11,
    fontWeight: '700',
  },
  alertsCard: {
    marginBottom: spacing.sm,
  },
  alertsEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  alertsEmptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCopy: { flex: 1, minWidth: 0 },
  alertName: {
    ...typography.label,
    fontSize: 14,
    color: colors.text,
  },
  alertMeta: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  daysLeftBadge: {
    minWidth: 36,
    height: 28,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  daysLeftText: {
    ...typography.label,
    fontSize: 12,
    fontWeight: '800',
  },
});

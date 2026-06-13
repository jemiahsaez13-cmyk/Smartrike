import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { Text, Surface, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector, useAppDispatch } from '@/controllers/store';
import { updateDriverStatus } from '@/controllers/slices/driverSlice';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { colors, spacing, shadows } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export const DriverDashboard = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { user } = useAppSelector(state => state.auth);
  const { currentStatus, dailyEarnings, incomingRequests, loading } = useAppSelector(state => state.driver);
  const isOnline = currentStatus === 'online' || currentStatus === 'on-trip';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const toggleStatus = async () => {
    const newStatus = isOnline ? 'offline' : 'online';
    await dispatch(updateDriverStatus({ driverId: user!.id, status: newStatus }));
  };

  if (loading) return <Loading message="Updating duty status..." />;

  const StatCard = ({ label, value, icon, color = colors.primary }: any) => (
    <Surface style={styles.statCard} elevation={2}>
      <LinearGradient 
        colors={[color + '15', color + '08']}
        style={styles.statCardGradient}
      >
        <View style={[styles.statIconBox, { backgroundColor: color + '25' }]}>
          <MaterialCommunityIcons name={icon} size={28} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    </Surface>
  );

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={isOnline ? ['#1E90FF', '#0DA5C0', '#00C9FF'] : ['#7E8FA3', '#334E7E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerWave} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcome}>Welcome back,</Text>
            <Text style={styles.driverName}>{user?.name || 'Driver'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <LinearGradient 
              colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
              style={styles.profileBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'D'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Surface style={styles.statusCard} elevation={4}>
          <View style={styles.statusInfo}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.textLight }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabelText}>
                You are currently <Text style={[styles.statusLabelBold, { color: isOnline ? colors.primary : colors.textSecondary }]}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </Text>
              <Text style={styles.statusSubtext}>
                {isOnline ? 'Ready to accept rides' : 'Go online to receive requests'}
              </Text>
            </View>
          </View>
          <Switch 
            value={isOnline} 
            onValueChange={toggleStatus} 
            color={colors.primary}
            style={styles.statusSwitch}
          />
        </Surface>
      </LinearGradient>

      <Animated.ScrollView 
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          <StatCard 
            label="Earnings Today" 
            value={`₱${dailyEarnings.toFixed(2)}`} 
            icon="cash-multiple" 
            color={colors.success} 
          />
          <StatCard 
            label="Trip Acceptance" 
            value="94%" 
            icon="check-all" 
            color={colors.primary} 
          />
        </View>

        {incomingRequests.length > 0 ? (
          <Surface style={styles.requestAlert} elevation={4}>
            <LinearGradient 
              colors={['#FFFBEB', '#FEF3C7']} 
              style={styles.requestGradient}
            >
              <View style={styles.requestHeader}>
                <View style={styles.requestTitleRow}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={24} color="#92400E" style={{ marginRight: 12 }} />
                  <Text style={styles.requestTitle}>New Requests</Text>
                </View>
                <Surface style={styles.countBadge} elevation={3}>
                  <Text style={styles.countText}>{incomingRequests.length}</Text>
                </Surface>
              </View>
              <Text style={styles.requestDesc}>Passengers are looking for a ride near your location.</Text>
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => navigation.navigate('BookingRequests')}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#F59E0B', '#FBBF24']}
                  style={styles.actionBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.actionBtnText}>View Requests</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" style={{ marginLeft: 8 }} />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </Surface>
        ) : isOnline ? (
          <View style={styles.waitingContainer}>
            <Surface style={styles.waitingIconBox} elevation={2}>
              <MaterialCommunityIcons name="radar" size={40} color={colors.primary} />
            </Surface>
            <Text style={styles.waitingTitle}>Searching for rides...</Text>
            <Text style={styles.waitingSubtitle}>Keep the app open to receive instant booking alerts</Text>
          </View>
        ) : (
          <View style={styles.offlinePlaceholder}>
            <MaterialCommunityIcons name="power-sleep" size={48} color={colors.textLight} style={{ marginBottom: spacing.md }} />
            <Text style={styles.offlineTitle}>You're Offline</Text>
            <Text style={styles.offlineSubtitle}>Go online to start receiving booking requests from passengers</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {[1, 2, 3].map(i => (
          <TouchableOpacity key={i} style={styles.activityItem} activeOpacity={0.7}>
            <Surface style={styles.activityIcon} elevation={1}>
              <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.success} />
            </Surface>
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle}>Trip Completed</Text>
              <Text style={styles.activityTime}>Today, 10:30 AM</Text>
            </View>
            <Text style={styles.activityAmount}>+₱45.00</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Performance</Text>
        </View>

        <Surface style={styles.performanceCard} elevation={2}>
          <LinearGradient 
            colors={['#E3F2FD', '#F0F7FF']}
            style={styles.performanceGradient}
          >
            <View style={styles.performanceRow}>
              <View>
                <Text style={styles.performanceLabel}>Rating</Text>
                <View style={styles.ratingContainer}>
                  <MaterialCommunityIcons name="star" size={20} color="#FFA500" />
                  <Text style={styles.ratingValue}>4.8</Text>
                </View>
              </View>
              <View style={styles.performanceDivider} />
              <View>
                <Text style={styles.performanceLabel}>Completed</Text>
                <Text style={styles.performanceValue}>247</Text>
              </View>
              <View style={styles.performanceDivider} />
              <View>
                <Text style={styles.performanceLabel}>Cancelled</Text>
                <Text style={styles.performanceValue}>3</Text>
              </View>
            </View>
          </LinearGradient>
        </Surface>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { 
    paddingTop: 60, 
    paddingHorizontal: spacing.lg,
    paddingBottom: 24,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    position: 'relative',
    overflow: 'hidden'
  },
  headerWave: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40
  },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.lg,
    zIndex: 1
  },
  welcome: { 
    fontSize: 14, 
    color: 'rgba(255,255,255,0.85)', 
    fontWeight: '500' 
  },
  driverName: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#fff',
    marginTop: 4
  },
  profileBtn: { padding: 4 },
  profileBtnGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)'
  },
  avatarText: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: 'bold' 
  },
  statusCard: { 
    backgroundColor: colors.surface, 
    borderRadius: 20, 
    padding: spacing.md, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  statusInfo: { 
    flexDirection: 'row', 
    alignItems: 'center',
    flex: 1
  },
  statusDot: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    marginRight: 12 
  },
  statusLabelText: { 
    fontSize: 14, 
    color: colors.textSecondary,
    fontWeight: '500'
  },
  statusLabelBold: {
    fontWeight: '800',
    letterSpacing: 0.5
  },
  statusSubtext: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2
  },
  statusSwitch: { 
    transform: [{ scale: 1.1 }] 
  },
  content: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 40 },
  statsGrid: { 
    flexDirection: 'row', 
    gap: spacing.md, 
    marginBottom: spacing.xl 
  },
  statCard: { 
    flex: 1, 
    backgroundColor: colors.surface, 
    borderRadius: 20, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  statCardGradient: {
    padding: spacing.md,
    alignItems: 'center'
  },
  statIconBox: { 
    width: 48, 
    height: 48, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  statValue: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: colors.text 
  },
  statLabel: { 
    fontSize: 11, 
    color: colors.textSecondary, 
    fontWeight: '600', 
    marginTop: 4,
    textAlign: 'center'
  },
  requestAlert: { 
    borderRadius: 24, 
    overflow: 'hidden', 
    marginBottom: spacing.xl,
    ...shadows.md
  },
  requestGradient: { 
    padding: spacing.lg 
  },
  requestHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  requestTitleRow: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  requestTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#92400E' 
  },
  countBadge: { 
    backgroundColor: '#F59E0B', 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  countText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  requestDesc: { 
    fontSize: 15, 
    color: '#B45309', 
    marginBottom: spacing.md,
    fontWeight: '500'
  },
  actionBtn: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden'
  },
  actionBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff'
  },
  waitingContainer: { 
    alignItems: 'center', 
    paddingVertical: spacing.xl 
  },
  waitingIconBox: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: colors.primaryLight, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: spacing.md 
  },
  waitingTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: colors.text 
  },
  waitingSubtitle: { 
    fontSize: 14, 
    color: colors.textSecondary, 
    textAlign: 'center', 
    marginTop: 6,
    paddingHorizontal: spacing.lg
  },
  offlinePlaceholder: { 
    alignItems: 'center', 
    paddingVertical: spacing.xl, 
    opacity: 0.6 
  },
  offlineTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: colors.textSecondary 
  },
  offlineSubtitle: { 
    fontSize: 14, 
    color: colors.textLight, 
    textAlign: 'center', 
    marginTop: 6, 
    paddingHorizontal: spacing.lg 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.md,
    marginTop: spacing.lg
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: colors.text 
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600'
  },
  activityItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: spacing.md, 
    backgroundColor: colors.surface, 
    borderRadius: 16, 
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  activityIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: colors.primaryLight, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: spacing.md 
  },
  activityInfo: { flex: 1 },
  activityTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: colors.text 
  },
  activityTime: { 
    fontSize: 12, 
    color: colors.textLight,
    marginTop: 2
  },
  activityAmount: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: colors.success 
  },
  performanceCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  performanceGradient: {
    padding: spacing.lg
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  performanceLabel: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center'
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center'
  },
  performanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border
  }
});

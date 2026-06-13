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

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const toggleStatus = async () => {
    const newStatus = isOnline ? 'offline' : 'online';
    await dispatch(updateDriverStatus({ driverId: user!.id, status: newStatus }));
  };

  if (loading) return <Loading message="Updating duty status..." />;

  const StatCard = ({ label, value, icon, color = colors.primary }: any) => (
    <Surface style={styles.statCard} elevation={2}>
      <View style={[styles.statIconBox, { backgroundColor: color + '15' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Surface>
  );

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={isOnline ? [colors.primary, colors.primaryDark] : ['#475569', '#1E293B']} 
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcome}>Welcome back,</Text>
            <Text style={styles.driverName}>{user?.name || 'Driver'}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Surface style={styles.profileBtn} elevation={2}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'D'}</Text>
            </Surface>
          </TouchableOpacity>
        </View>

        <Surface style={styles.statusCard} elevation={4}>
          <View style={styles.statusInfo}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.textLight }]} />
            <Text style={styles.statusLabelText}>
              You are currently <Text style={{ fontWeight: '800', color: isOnline ? colors.primary : colors.text }}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
            </Text>
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
        style={[styles.content, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          <StatCard label="Earnings Today" value={`₱${dailyEarnings.toFixed(2)}`} icon="cash-multiple" color={colors.success} />
          <StatCard label="Trips Done" value="12" icon="bike" color={colors.primary} />
        </View>

        {incomingRequests.length > 0 ? (
          <Surface style={styles.requestAlert} elevation={4}>
            <LinearGradient colors={['#FFFBEB', '#FEF3C7']} style={styles.requestGradient}>
              <View style={styles.requestHeader}>
                <View style={styles.requestTitleRow}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={20} color="#92400E" style={{ marginRight: 8 }} />
                  <Text style={styles.requestTitle}>New Requests Available</Text>
                </View>
                <Surface style={styles.countBadge} elevation={1}>
                  <Text style={styles.countText}>{incomingRequests.length}</Text>
                </Surface>
              </View>
              <Text style={styles.requestDesc}>Passengers are looking for a ride near your location.</Text>
              <Button 
                variant="primary" 
                onPress={() => navigation.navigate('BookingRequests')}
                style={styles.actionBtn}
              >
                View Requests
              </Button>
            </LinearGradient>
          </Surface>
        ) : isOnline ? (
          <View style={styles.waitingContainer}>
            <View style={styles.waitingIconBox}>
              <MaterialCommunityIcons name="radar" size={32} color={colors.primary} />
            </View>
            <Text style={styles.waitingTitle}>Searching for rides...</Text>
            <Text style={styles.waitingSubtitle}>Keep the app open to receive instant booking alerts</Text>
          </View>
        ) : (
          <View style={styles.offlinePlaceholder}>
            <MaterialCommunityIcons name="weather-night" size={48} color={colors.textLight} style={{ marginBottom: spacing.md }} />
            <Text style={styles.offlineTitle}>You're Offline</Text>
            <Text style={styles.offlineSubtitle}>Go online to start receiving booking requests from passengers</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>
        
        {[1, 2, 3].map(i => (
          <Surface key={i} style={styles.activityItem} elevation={1}>
            <View style={styles.activityIcon}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle}>Trip Completed</Text>
              <Text style={styles.activityTime}>Today, 10:30 AM</Text>
            </View>
            <Text style={styles.activityAmount}>+₱45.00</Text>
          </Surface>
        ))}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { 
    height: 240, 
    paddingTop: 60, 
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  welcome: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  driverName: { fontSize: 26, fontWeight: '800', color: '#fff' },
  profileBtn: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statusCard: { 
    backgroundColor: colors.surface, 
    borderRadius: 20, 
    padding: spacing.md, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  statusInfo: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  statusLabelText: { fontSize: 15, color: colors.textSecondary },
  statusSwitch: { transform: [{ scale: 1.2 }] },
  content: { flex: 1, marginTop: spacing.lg },
  scrollContent: { padding: spacing.lg, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  statCard: { 
    flex: 1, 
    backgroundColor: colors.surface, 
    borderRadius: 20, 
    padding: spacing.md, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  statIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  requestAlert: { borderRadius: 24, overflow: 'hidden', marginBottom: spacing.xl },
  requestGradient: { padding: spacing.lg },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestTitleRow: { flexDirection: 'row', alignItems: 'center' },
  requestTitle: { fontSize: 18, fontWeight: '800', color: '#92400E' },
  countBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
  countText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  requestDesc: { fontSize: 14, color: '#B45309', marginBottom: spacing.lg },
  actionBtn: { borderRadius: 14 },
  waitingContainer: { alignItems: 'center', paddingVertical: spacing.xl },
  waitingIconBox: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  waitingTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  waitingSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
  offlinePlaceholder: { alignItems: 'center', paddingVertical: spacing.xl, opacity: 0.7 },
  offlineTitle: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
  offlineSubtitle: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginTop: 4, paddingHorizontal: 40 },
  sectionHeader: { marginBottom: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
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
  activityIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  activityTime: { fontSize: 12, color: colors.textLight },
  activityAmount: { fontSize: 15, fontWeight: '800', color: colors.success }
});

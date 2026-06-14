import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { colors, spacing, shadows } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export const PassengerDashboard = () => {
  const { user } = useAuth();
  const { currentBooking, loading } = useBooking();
  const navigation = useNavigation<any>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (loading) return <Loading message="Syncing with TODA..." />;

  const QuickAction = ({ icon, label, onPress, color = colors.primary }: any) => (
    <TouchableOpacity 
      style={styles.quickActionWrapper} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <LinearGradient 
        colors={[colors.primaryLight, '#E3F2FD']}
        style={styles.quickActionIcon}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <MaterialCommunityIcons name={icon} size={28} color={color} />
      </LinearGradient>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#1E90FF', '#0DA5C0', '#00C9FF']} 
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topSection}
      >
        <View style={styles.headerWave} />
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.name}>{user?.name || 'Passenger'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileBtn} 
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <LinearGradient 
              colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
              style={styles.avatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'P'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <Animated.ScrollView 
        style={[styles.scroll, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentBooking ? (
          <Surface style={[styles.card, styles.tripCard]} elevation={4}>
            <LinearGradient 
              colors={['#fff', '#F0F7FF']} 
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={styles.statusBadge}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.statusText}>Trip in Progress</Text>
                </View>
                <Text style={styles.fareAmount}>₱{currentBooking.total_fare}</Text>
              </View>

              <View style={styles.tripPath}>
                <View style={styles.pathLine} />
                <View style={styles.locationRow}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {currentBooking.pickup_location.address}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {currentBooking.dropoff_location.address}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.viewBtn}
                onPress={() => navigation.navigate('ActiveTrip')}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#1E90FF', '#0DA5C0']}
                  style={styles.viewBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.viewBtnText}>Track My Ride</Text>
                  <MaterialCommunityIcons name="map-marker" size={18} color="#fff" style={{ marginLeft: 8 }} />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </Surface>
        ) : (
          <Surface style={[styles.card, styles.bookCard]} elevation={4}>
            <LinearGradient 
              colors={['#fff', '#F0F7FF']}
              style={styles.bookGradient}
            >
              <View style={styles.bookContent}>
                <View style={styles.bookTextContainer}>
                  <Text style={styles.bookTitle}>Need a ride?</Text>
                  <Text style={styles.bookSubtitle}>Available tricycles are nearby</Text>
                </View>
                <View style={styles.bookIconContainer}>
                  <LinearGradient 
                    colors={[colors.primaryLight, '#E3F2FD']}
                    style={styles.bookIconBox}
                  >
                    <TricycleIcon size={72} color={colors.primary} />
                  </LinearGradient>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.bookBtn}
                onPress={() => navigation.navigate('BookRide')}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#1E90FF', '#0DA5C0']}
                  style={styles.bookBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.bookBtnText}>Book Now</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" style={{ marginLeft: 8 }} />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </Surface>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsGrid}>
          <QuickAction icon="history" label="History" onPress={() => navigation.navigate('History')} />
          <QuickAction icon="bookmark-outline" label="Saved" onPress={() => {}} />
          <QuickAction icon="message-text-outline" label="Support" onPress={() => {}} />
          <QuickAction icon="cog-outline" label="Settings" onPress={() => navigation.navigate('Profile')} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Destinations</Text>
          <TouchableOpacity><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
        </View>

        <View style={styles.recentList}>
          {[
            { id: 1, title: 'Public Market', sub: 'Boac, Marinduque', icon: 'storefront-outline' },
            { id: 2, title: 'Marinduque State College', sub: 'Tanza, Boac', icon: 'school-outline' },
          ].map(item => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.recentItem}
              activeOpacity={0.7}
            >
              <Surface style={styles.recentIconBox} elevation={1}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color={colors.primary} />
              </Surface>
              <View style={styles.recentInfo}>
                <Text style={styles.recentTitle}>{item.title}</Text>
                <Text style={styles.recentSub}>{item.sub}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textLight} />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topSection: { 
    height: 180, 
    paddingTop: 60, 
    paddingHorizontal: spacing.lg,
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
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    zIndex: 1
  },
  greeting: { 
    fontSize: 14, 
    color: 'rgba(255,255,255,0.85)', 
    fontWeight: '500' 
  },
  name: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#fff', 
    marginTop: 4 
  },
  profileBtn: { padding: 4 },
  avatar: { 
    width: 54, 
    height: 54, 
    borderRadius: 27, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)'
  },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  scroll: { flex: 1, marginTop: -32 },
  scrollContent: { padding: spacing.lg, paddingBottom: 40 },
  card: { 
    backgroundColor: colors.surface, 
    borderRadius: 24, 
    overflow: 'hidden',
    marginBottom: spacing.xl,
    ...shadows.lg
  },
  cardGradient: { padding: spacing.lg },
  tripCard: {},
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.lg 
  },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#DCFCE7', 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 20 
  },
  pulseDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: colors.success, 
    marginRight: 8 
  },
  statusText: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#047857' 
  },
  fareAmount: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: colors.text 
  },
  tripPath: { 
    marginBottom: spacing.lg, 
    position: 'relative', 
    paddingLeft: 20 
  },
  pathLine: { 
    position: 'absolute', 
    left: 4, 
    top: 10, 
    bottom: 10, 
    width: 2, 
    backgroundColor: colors.border,
    borderStyle: 'dashed'
  },
  locationRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 8 
  },
  dot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    position: 'absolute', 
    left: -20 
  },
  locationText: { 
    fontSize: 15, 
    color: colors.textSecondary, 
    fontWeight: '500',
    flex: 1
  },
  viewBtn: { 
    height: 48,
    borderRadius: 12,
    overflow: 'hidden'
  },
  viewBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4
  },
  viewBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff'
  },
  bookCard: { padding: spacing.lg },
  bookGradient: { padding: 0 },
  bookContent: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.lg 
  },
  bookTextContainer: { flex: 1 },
  bookTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: colors.text 
  },
  bookSubtitle: { 
    fontSize: 14, 
    color: colors.textSecondary, 
    marginTop: 4 
  },
  bookIconContainer: {
    marginLeft: spacing.md
  },
  bookIconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  bookBtn: { 
    height: 48,
    borderRadius: 12,
    overflow: 'hidden'
  },
  bookBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4
  },
  bookBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff'
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
  seeAll: { 
    fontSize: 14, 
    color: colors.primary, 
    fontWeight: '600' 
  },
  quickActionsGrid: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: spacing.xl 
  },
  quickActionWrapper: { 
    alignItems: 'center', 
    width: (width - 64) / 4 
  },
  quickActionIcon: { 
    width: 60, 
    height: 60, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 10
  },
  quickActionLabel: { 
    fontSize: 12, 
    color: colors.textSecondary, 
    fontWeight: '600',
    textAlign: 'center'
  },
  recentList: { gap: spacing.md },
  recentItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: spacing.md, 
    backgroundColor: colors.surface, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  recentIconBox: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    backgroundColor: colors.primaryLight, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: spacing.md 
  },
  recentInfo: { flex: 1 },
  recentTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: colors.text 
  },
  recentSub: { 
    fontSize: 12, 
    color: colors.textSecondary,
    marginTop: 2
  }
});

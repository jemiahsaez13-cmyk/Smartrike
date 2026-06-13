import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { colors, spacing, shadows } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export const PassengerDashboard = () => {
  const { user } = useAuth();
  const { currentBooking, loading } = useBooking();
  const navigation = useNavigation<any>();

  // Animations
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
    <TouchableOpacity style={styles.quickActionWrapper} onPress={onPress}>
      <Surface style={styles.quickActionIcon} elevation={1}>
        <MaterialCommunityIcons name={icon} size={28} color={color} />
      </Surface>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={[colors.primary, colors.primaryDark]} 
        style={styles.topSection}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.name}>{user?.name || 'Passenger'}</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'P'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <Animated.ScrollView 
        style={[styles.scroll, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentBooking ? (
          <Surface style={[styles.card, styles.activeCard]} elevation={4}>
            <LinearGradient 
              colors={['#fff', '#f0fdf4']} 
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

              <Button 
                variant="primary" 
                onPress={() => navigation.navigate('ActiveTrip')} 
                style={styles.viewBtn}
              >
                Track My Ride
              </Button>
            </LinearGradient>
          </Surface>
        ) : (
          <Surface style={[styles.card, styles.bookCard]} elevation={4}>
            <View style={styles.bookContent}>
              <View style={styles.bookTextContainer}>
                <Text style={styles.bookTitle}>Need a ride?</Text>
                <Text style={styles.bookSubtitle}>Available tricycles are nearby</Text>
              </View>
              <MaterialCommunityIcons name="bike" size={60} color={colors.primary} />
            </View>
            <Button 
              variant="primary" 
              onPress={() => navigation.navigate('BookRide')} 
              style={styles.bookBtn}
            >
              Book Now
            </Button>
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
            <TouchableOpacity key={item.id} style={styles.recentItem}>
              <View style={styles.recentIconBox}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color={colors.primary} />
              </View>
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
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  name: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 2 },
  profileBtn: { padding: 4 },
  avatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  avatarText: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  scroll: { flex: 1, marginTop: -40 },
  scrollContent: { padding: spacing.lg, paddingBottom: 40 },
  card: { 
    backgroundColor: colors.surface, 
    borderRadius: 24, 
    overflow: 'hidden',
    marginBottom: spacing.xl,
    ...shadows.lg
  },
  cardGradient: { padding: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#DCFCE7', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20 
  },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 8 },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  fareAmount: { fontSize: 24, fontWeight: '800', color: colors.text },
  tripPath: { marginBottom: spacing.lg, position: 'relative', paddingLeft: 20 },
  pathLine: { 
    position: 'absolute', 
    left: 4, 
    top: 10, 
    bottom: 10, 
    width: 2, 
    backgroundColor: colors.border,
    borderStyle: 'dashed'
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', left: -20 },
  locationText: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
  viewBtn: { borderRadius: 14 },
  bookCard: { padding: spacing.lg },
  bookContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  bookTextContainer: { flex: 1 },
  bookTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  bookSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  bookBtn: { borderRadius: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  seeAll: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },
  quickActionWrapper: { alignItems: 'center', width: (width - 64) / 4 },
  quickActionIcon: { 
    width: 56, 
    height: 56, 
    borderRadius: 18, 
    backgroundColor: colors.surface, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  quickActionLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
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
  recentIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  recentInfo: { flex: 1 },
  recentTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  recentSub: { fontSize: 12, color: colors.textSecondary },
});

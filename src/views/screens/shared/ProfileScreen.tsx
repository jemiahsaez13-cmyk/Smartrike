import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/controllers/hooks/useAuth';
import { colors, spacing, shadows } from '@/views/styles/theme';

export const ProfileScreen = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch {
            // Demo sessions have no remote state; dropping auth is enough.
          }
        },
      },
    ]);
  };

  const roleLabel =
    user?.user_type === 'driver' ? 'Driver' : user?.user_type === 'admin' ? 'Administrator' : 'Passenger';

  const Stat = ({ icon, value, label }: { icon: any; value: string; label: string }) => (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const MenuItem = ({ icon, label, onPress, danger }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, danger && { backgroundColor: colors.accentLight }]}>
        <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: colors.error }]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E90FF', '#0DA5C0', '#00C9FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>My Profile</Text>
        <LinearGradient
          colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
        </LinearGradient>
        <Text style={styles.name}>{user?.name || 'User'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Surface style={styles.statsCard} elevation={2}>
          <Stat icon="star" value={user?.rating ? user.rating.toFixed(1) : '5.0'} label="Rating" />
          <View style={styles.statDivider} />
          <Stat icon="map-marker-path" value={`${user?.total_trips ?? 0}`} label="Trips" />
          <View style={styles.statDivider} />
          <Stat icon="shield-check" value="Active" label="Status" />
        </Surface>

        <Text style={styles.sectionTitle}>Account</Text>
        <Surface style={styles.menuCard} elevation={1}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="email-outline" size={20} color={colors.textLight} style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || '—'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="phone-outline" size={20} color={colors.textLight} style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{user?.phone || 'Not set'}</Text>
            </View>
          </View>
        </Surface>

        <Text style={styles.sectionTitle}>Settings</Text>
        <Surface style={styles.menuCard} elevation={1}>
          <MenuItem icon="account-edit-outline" label="Edit Profile" onPress={() => Alert.alert('Edit Profile', 'Coming soon')} />
          <View style={styles.divider} />
          <MenuItem icon="credit-card-outline" label="Payment Methods" onPress={() => Alert.alert('Payment Methods', 'Coming soon')} />
          <View style={styles.divider} />
          <MenuItem icon="bell-outline" label="Notifications" onPress={() => Alert.alert('Notifications', 'Coming soon')} />
          <View style={styles.divider} />
          <MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => Alert.alert('Help & Support', 'Contact FEDTODAB office')} />
        </Surface>

        <Surface style={styles.menuCard} elevation={1}>
          <MenuItem icon="logout" label="Log Out" onPress={handleLogout} danger />
        </Surface>

        <Text style={styles.version}>Smart Trike • v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 60,
    paddingBottom: 28,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: { fontSize: 40, fontWeight: '800', color: '#fff' },
  name: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: spacing.md },
  roleBadge: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  scroll: { flex: 1, marginTop: -16 },
  scrollContent: { padding: spacing.lg, paddingBottom: 40 },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 6 },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.borderLight },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  infoIcon: { marginRight: spacing.md },
  infoLabel: { fontSize: 12, color: colors.textLight, fontWeight: '600' },
  infoValue: { fontSize: 15, color: colors.text, fontWeight: '600', marginTop: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  divider: { height: 1, backgroundColor: colors.borderLight, marginLeft: 52 },
  version: { textAlign: 'center', fontSize: 12, color: colors.textLight, marginTop: spacing.sm },
});

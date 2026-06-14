import React from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/controllers/hooks/useAuth';
import { colors, gradients, radius, shadows, spacing } from '@/views/styles/theme';

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
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.74}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{user?.name || 'User'}</Text>
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
            <View style={styles.infoIconBox}>
              <MaterialCommunityIcons name="email-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{user?.email || 'Not set'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <MaterialCommunityIcons name="phone-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{user?.phone || 'Not set'}</Text>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 94,
    height: 94,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    marginTop: spacing.md,
    maxWidth: '92%',
  },
  roleBadge: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
    marginTop: -20,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 96,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.borderLight,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  menuItem: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuIconDanger: {
    backgroundColor: colors.errorLight,
  },
  menuLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  menuLabelDanger: {
    color: colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 56,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
});

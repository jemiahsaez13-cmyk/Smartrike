import React from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/controllers/hooks/useAuth';
import { colors, radius, shadows, spacing, typography } from '@/views/styles/theme';

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
      <MaterialCommunityIcons name={icon} size={20} color={colors.text} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const MenuItem = ({ icon, label, onPress, danger, last }: any) => (
    <TouchableOpacity
      style={[styles.menuItem, !last && styles.menuItemBorder]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.error : colors.text} />
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero — scrolls with the page instead of being pinned to the top */}
      <Text style={styles.pageTitle}>Account</Text>

      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name} numberOfLines={1}>{user?.name || 'User'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsCard}>
        <Stat icon="star" value={user?.rating ? user.rating.toFixed(1) : '5.0'} label="Rating" />
        <View style={styles.statDivider} />
        <Stat icon="map-marker-path" value={`${user?.total_trips ?? 0}`} label="Trips" />
        <View style={styles.statDivider} />
        <Stat icon="shield-check" value="Active" label="Status" />
      </View>

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        <View style={[styles.infoRow, styles.menuItemBorder]}>
          <View style={styles.menuIcon}>
            <MaterialCommunityIcons name="email-outline" size={20} color={colors.text} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{user?.email || 'Not set'}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.menuIcon}>
            <MaterialCommunityIcons name="phone-outline" size={20} color={colors.text} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{user?.phone || 'Not set'}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={styles.card}>
        <MenuItem icon="account-edit-outline" label="Edit Profile" onPress={() => Alert.alert('Edit Profile', 'Coming soon')} />
        <MenuItem icon="credit-card-outline" label="Payment Methods" onPress={() => Alert.alert('Payment Methods', 'Coming soon')} />
        <MenuItem icon="bell-outline" label="Notifications" onPress={() => Alert.alert('Notifications', 'Coming soon')} />
        <MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => Alert.alert('Help & Support', 'Contact FEDTODAB office')} last />
      </View>

      <View style={styles.card}>
        <MenuItem icon="logout" label="Log Out" onPress={handleLogout} danger last />
      </View>

      <Text style={styles.version}>Smart Trike • v1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: 64,
    paddingBottom: 120,
  },
  pageTitle: {
    ...typography.display,
    fontSize: 32,
    marginBottom: spacing.lg,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  identityCopy: {
    flex: 1,
  },
  name: {
    ...typography.h2,
    fontSize: 22,
  },
  roleBadge: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  roleText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    fontSize: 18,
    marginTop: spacing.xs,
  },
  statLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.borderLight,
  },
  sectionTitle: {
    ...typography.labelSmall,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    ...typography.labelSmall,
    color: colors.textLight,
  },
  infoValue: {
    ...typography.label,
    fontSize: 15,
    marginTop: 2,
  },
  menuItem: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuIconDanger: {
    backgroundColor: colors.errorLight,
  },
  menuLabel: {
    flex: 1,
    ...typography.label,
    fontSize: 15,
  },
  menuLabelDanger: {
    color: colors.error,
  },
  version: {
    ...typography.bodySmall,
    textAlign: 'center',
    color: colors.textLight,
    marginTop: spacing.sm,
  },
});

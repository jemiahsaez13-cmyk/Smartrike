import React from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/controllers/hooks/useAuth';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

export const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();

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

  const MenuItem = ({ icon, label, value, onPress, danger, last }: any) => (
    <TouchableOpacity
      style={[styles.menuItem, !last && styles.menuItemBorder]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.error : colors.text} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        {value ? <Text style={styles.menuValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {!danger && <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textLight} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Slim app bar — title left, notifications + settings actions top right */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Account</Text>
        <View style={styles.appBarActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Notifications')}
          >
            <MaterialCommunityIcons name="bell-outline" size={22} color={colors.text} />
            <View style={styles.badge} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Settings')}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <TouchableOpacity
          style={styles.identity}
          activeOpacity={0.7}
          onPress={() => Alert.alert('Edit Profile', 'Coming soon')}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name} numberOfLines={1}>{user?.name || 'User'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textLight} />
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsCard}>
          <Stat icon="star" value={user?.rating ? user.rating.toFixed(1) : '5.0'} label="Rating" />
          <View style={styles.statDivider} />
          <Stat icon="map-marker-path" value={`${user?.total_trips ?? 0}`} label="Trips" />
          <View style={styles.statDivider} />
          <Stat icon="shield-check" value="Active" label="Status" />
        </View>

        {/* Contact details */}
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.card}>
          <MenuItem
            icon="email-outline"
            label="Email"
            value={user?.email || 'Not set'}
            onPress={() => Alert.alert('Email', user?.email || 'Not set')}
          />
          <MenuItem
            icon="phone-outline"
            label="Phone"
            value={user?.phone || 'Not set'}
            onPress={() => Alert.alert('Phone', user?.phone || 'Not set')}
            last
          />
        </View>

        {/* Account management */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <MenuItem icon="account-edit-outline" label="Edit Profile" onPress={() => Alert.alert('Edit Profile', 'Profile editing coming in next update.')} />
          {user?.user_type === 'passenger' && (
            <MenuItem icon="credit-card-outline" label="Payment Methods" onPress={() => navigation.navigate('Payment')} />
          )}
          <MenuItem icon="bell-outline" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
          <MenuItem icon="cog-outline" label="Settings" onPress={() => navigation.navigate('Settings')} last />
        </View>

        {/* Support */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.card}>
          <MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => Alert.alert('Help & Support', 'Contact FEDTODAB office')} />
          <MenuItem icon="information-outline" label="About Smart Trike" onPress={() => Alert.alert('About', 'Smart Trike • v1.0.0')} last />
        </View>

        {/* Sign out */}
        <View style={styles.card}>
          <MenuItem icon="logout" label="Log Out" onPress={handleLogout} danger last />
        </View>

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
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  appBarTitle: {
    ...typography.h2,
    fontSize: 26,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.surfaceAlt,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  identityCopy: {
    flex: 1,
  },
  name: {
    ...typography.h3,
    fontSize: 19,
  },
  roleBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
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
  menuItem: {
    minHeight: 60,
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
  menuCopy: {
    flex: 1,
  },
  menuLabel: {
    ...typography.label,
    fontSize: 15,
  },
  menuValue: {
    ...typography.bodySmall,
    color: colors.textLight,
    marginTop: 2,
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

import React, { useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { signOut } from '@/controllers/slices/authSlice';
import { Card } from '@/views/components/common/Card';
import { confirm, notify } from '@/utils/confirm';
import { colors, gradients, spacing, typography } from '@/views/styles/theme';

interface SettingToggle {
  key: string;
  label: string;
  desc: string;
  icon: string;
  value: boolean;
}

export const SettingsScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleSignOut = async () => {
    const ok = await confirm('Sign Out', 'Are you sure you want to sign out?', {
      confirmText: 'Sign Out',
      destructive: true,
    });
    if (!ok) return;
    try {
      await dispatch(signOut()).unwrap();
    } catch {
      notify('Error', 'Failed to sign out. Try again.');
    }
  };

  const toggles: SettingToggle[] = [
    { key: 'push', label: 'Push Notifications', desc: 'Booking updates and alerts', icon: 'bell-outline', value: pushEnabled },
    { key: 'sound', label: 'Sound Alerts', desc: 'Play sound for notifications', icon: 'volume-high', value: soundEnabled },
    { key: 'vibration', label: 'Vibration', desc: 'Vibrate on new requests', icon: 'vibrate', value: vibrationEnabled },
    { key: 'location', label: 'Location Tracking', desc: 'Required for booking & navigation', icon: 'crosshairs-gps', value: locationEnabled },
  ];

  const handleToggle = (key: string, val: boolean) => {
    if (key === 'push') setPushEnabled(val);
    else if (key === 'sound') setSoundEnabled(val);
    else if (key === 'vibration') setVibrationEnabled(val);
    else if (key === 'location') {
      if (!val) {
        notify('Location Required', 'The app needs location access to match you with drivers. This cannot be disabled.');
        return;
      }
      setLocationEnabled(val);
    }
  };

  const SettingRow = ({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.settingIconBox}>
        <MaterialCommunityIcons name={icon as any} size={20} color={colors.textSecondary} />
      </View>
      <Text style={styles.settingLabel}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.brand} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSub}>{user?.email}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Notifications */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <Card variant="elevated" padding="none" style={styles.section}>
          {toggles.map((t, idx) => (
            <View key={t.key}>
              <View style={styles.toggleRow}>
                <View style={[styles.toggleIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <MaterialCommunityIcons name={t.icon as any} size={20} color={colors.primary} />
                </View>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleLabel}>{t.label}</Text>
                  <Text style={styles.toggleDesc}>{t.desc}</Text>
                </View>
                <Switch
                  value={t.value}
                  onValueChange={(val) => handleToggle(t.key, val)}
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              {idx < toggles.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </Card>

        {/* Account */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <Card variant="elevated" padding="none" style={styles.section}>
          <SettingRow
            label="Edit Profile"
            icon="account-edit-outline"
            onPress={() => navigation.navigate('Profile')}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Change Password"
            icon="lock-reset"
            onPress={() => notify('Change Password', 'A password reset link will be sent to your email.')}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Notifications"
            icon="bell-badge-outline"
            onPress={() => navigation.navigate('Notifications')}
          />
        </Card>

        {/* Support */}
        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <Card variant="elevated" padding="none" style={styles.section}>
          <SettingRow
            label="Help & FAQ"
            icon="help-circle-outline"
            onPress={() => navigation.navigate('HelpSupport')}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Report a Problem"
            icon="flag-outline"
            onPress={() => navigation.navigate('HelpSupport')}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Privacy Policy"
            icon="shield-check-outline"
            onPress={() => notify('Privacy Policy', 'Smart Trike collects location and booking data to provide services. Data is never sold to third parties.')}
          />
        </Card>

        {/* App info */}
        <Text style={styles.sectionLabel}>APP</Text>
        <Card variant="elevated" padding="md" style={styles.section}>
          <View style={styles.appInfoRow}>
            <Text style={styles.appInfoLabel}>Version</Text>
            <Text style={styles.appInfoValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.appInfoRow}>
            <Text style={styles.appInfoLabel}>Service Area</Text>
            <Text style={styles.appInfoValue}>Boac, Marinduque</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.appInfoRow}>
            <Text style={styles.appInfoLabel}>Operator</Text>
            <Text style={styles.appInfoValue}>FEDTODAB</Text>
          </View>
        </Card>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 52,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: { ...typography.h1, color: '#fff', fontSize: 28 },
  headerSub: { ...typography.bodySmall, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
    paddingBottom: 48,
    gap: 0,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 28,
    marginLeft: 4,
  },
  section: { marginBottom: 0, overflow: 'hidden' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: 14,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: { flex: 1 },
  toggleLabel: { ...typography.subtitle, color: colors.text, fontSize: 14 },
  toggleDesc: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: 14,
  },
  settingIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: { ...typography.subtitle, color: colors.text, fontSize: 14, flex: 1 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginLeft: 68 },
  appInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  appInfoLabel: { ...typography.body, color: colors.textSecondary },
  appInfoValue: { ...typography.label, color: colors.text, fontSize: 13 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.errorLight,
    gap: 10,
  },
  signOutText: { ...typography.label, color: colors.error, fontSize: 15 },
});

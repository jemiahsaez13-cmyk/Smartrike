import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { updateProfile } from '@/controllers/slices/authSlice';
import { confirm, notify } from '@/utils/confirm';
import { Input } from '@/views/components/common/Input';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

export const EditProfileScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const driver = user as any;
  const isDriver = user?.user_type === 'driver';

  // ── Form state ──
  const [photo, setPhoto] = useState<string | null>(user?.profile_photo_url ?? null);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const [toda, setToda] = useState(driver?.toda_membership ?? '');
  const [license, setLicense] = useState(driver?.license_number ?? '');
  const [plate, setPlate] = useState(driver?.vehicle_details?.plate_number ?? '');

  const [bankName, setBankName] = useState(driver?.bank_account?.bank_name ?? '');
  const [accountNumber, setAccountNumber] = useState(driver?.bank_account?.account_number ?? '');
  const [accountName, setAccountName] = useState(driver?.bank_account?.account_name ?? '');

  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', 'Allow photo access to set a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      // Prefer a base64 data-URI so the image persists and is viewable anywhere.
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setPhoto(uri);
    } catch {
      notify('Error', 'Could not open your photo library. Please try again.');
    }
  };

  const choosePhoto = async () => {
    if (!photo) {
      pickPhoto();
      return;
    }
    // Confirm whether to replace or remove the existing photo (web-safe).
    const remove = await confirm('Profile Photo', 'Remove your current photo? Choose Cancel to pick a new one instead.', {
      confirmText: 'Remove Photo',
      cancelText: 'Choose New',
      destructive: true,
    });
    if (remove) setPhoto(null);
    else pickPhoto();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      notify('Name required', 'Please enter your full name.');
      return;
    }
    if (phone.trim() && !/^[0-9+()\-\s]{7,}$/.test(phone.trim())) {
      notify('Invalid phone', 'Please enter a valid contact number.');
      return;
    }

    const updates: any = {
      name: name.trim(),
      phone: phone.trim() || null,
      profile_photo_url: photo || null,
    };

    if (isDriver) {
      updates.toda_membership = toda.trim() || null;
      updates.license_number = license.trim() || null;
      updates.vehicle_details = {
        ...(driver?.vehicle_details ?? {}),
        plate_number: plate.trim(),
      };
      const hasBank = bankName.trim() || accountNumber.trim() || accountName.trim();
      updates.bank_account = hasBank
        ? {
            bank_name: bankName.trim(),
            account_number: accountNumber.trim(),
            account_name: accountName.trim() || name.trim(),
          }
        : null;
    }

    setSaving(true);
    try {
      await dispatch(updateProfile(updates)).unwrap();
      notify('Saved', 'Your profile has been updated.');
      navigation.goBack();
    } catch (e: any) {
      notify('Update failed', e?.message || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const initial = (name || user?.name || 'U').charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      {/* App bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.7} style={styles.saveTextBtn}>
          <Text style={[styles.saveText, saving && { opacity: 0.4 }]}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <TouchableOpacity activeOpacity={0.85} onPress={choosePhoto} style={styles.avatarTouch}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <MaterialCommunityIcons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={choosePhoto} activeOpacity={0.7}>
              <Text style={styles.changePhoto}>{photo ? 'Change Photo' : 'Add Photo'}</Text>
            </TouchableOpacity>
          </View>

          {/* Personal information */}
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <Input value={name} onChangeText={setName} placeholder="Your full name" autoCapitalize="words" />

            <Text style={styles.fieldLabel}>Phone Number</Text>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="09XX XXX XXXX"
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.readonlyRow}>
              <MaterialCommunityIcons name="email-outline" size={18} color={colors.textMuted} />
              <Text style={styles.readonlyValue} numberOfLines={1}>{user?.email || 'Not set'}</Text>
              <MaterialCommunityIcons name="lock-outline" size={16} color={colors.textMuted} />
            </View>
            <Text style={styles.helper}>Email is linked to your login and can't be changed here.</Text>
          </View>

          {isDriver && (
            <>
              {/* Driver & vehicle */}
              <Text style={styles.sectionTitle}>Driver & Vehicle</Text>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>TODA Membership</Text>
                <Input value={toda} onChangeText={setToda} placeholder="e.g. FEDTODAB" autoCapitalize="characters" />

                <Text style={styles.fieldLabel}>License Number</Text>
                <Input value={license} onChangeText={setLicense} placeholder="Driver's license no." autoCapitalize="characters" />

                <Text style={styles.fieldLabel}>Plate Number</Text>
                <Input value={plate} onChangeText={setPlate} placeholder="e.g. ABC-1234" autoCapitalize="characters" />
              </View>

              {/* Payout / bank account */}
              <Text style={styles.sectionTitle}>Payout Account</Text>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Bank / E-Wallet</Text>
                <Input value={bankName} onChangeText={setBankName} placeholder="e.g. GCash, BDO, Maya" autoCapitalize="words" />

                <Text style={styles.fieldLabel}>Account Number</Text>
                <Input
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="Account / mobile number"
                  keyboardType="number-pad"
                />

                <Text style={styles.fieldLabel}>Account Name</Text>
                <Input value={accountName} onChangeText={setAccountName} placeholder="Registered account name" autoCapitalize="words" />
                <Text style={styles.helper}>Used to send your trip earnings. Keep this accurate.</Text>
              </View>
            </>
          )}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="check" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>{saving ? 'Saving Changes…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.screen,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  saveTextBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  saveText: {
    ...typography.label,
    color: colors.accent,
    fontWeight: '800',
    fontSize: 15,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarTouch: {
    width: 104,
    height: 104,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  avatarImg: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.surfaceAlt,
    ...shadows.md,
  },
  avatarText: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  changePhoto: {
    ...typography.label,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
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
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  fieldLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 2,
  },
  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  readonlyValue: {
    flex: 1,
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 15,
  },
  helper: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
    ...shadows.md,
  },
  saveBtnText: {
    ...typography.button,
    color: '#fff',
    fontSize: 16,
  },
});

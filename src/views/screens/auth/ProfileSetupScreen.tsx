import React, { useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { updateProfile } from '@/controllers/slices/authSlice';
import { AddressRepository } from '@/models/repositories/AddressRepository';
import { notify } from '@/utils/confirm';
import { Input } from '@/views/components/common/Input';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const addressRepo = new AddressRepository();

// One-time onboarding shown to brand-new accounts (including Google sign-in)
// before they can use the app. Pre-fills anything we already know so existing
// detail (name/phone from a registration form) only needs confirming.
export const ProfileSetupScreen = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [photo, setPhoto] = useState<string | null>(user?.profile_photo_url ?? null);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.home_address ?? '');
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
      setPhoto(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
    } catch {
      notify('Error', 'Could not open your photo library. Please try again.');
    }
  };

  const handleSave = async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();

    if (!cleanName) return notify('Name required', 'Please enter your full name.');
    if (!cleanPhone || !/^[0-9+()\-\s]{7,}$/.test(cleanPhone)) {
      return notify('Phone required', 'Please enter a valid contact number.');
    }
    if (!cleanAddress) return notify('Address required', 'Please enter your home address.');

    setSaving(true);
    try {
      const saved: any = await dispatch(
        updateProfile({
          name: cleanName,
          phone: cleanPhone,
          home_address: cleanAddress,
          profile_photo_url: photo || null,
          profile_completed: true,
        } as any)
      ).unwrap();

      // Seed the saved-address book with this address as the default "Home".
      // Best-effort: the gate already passed, so never block entry on this.
      try {
        await addressRepo.create({
          user_id: saved?.id ?? user!.id,
          label: 'Home',
          recipient_name: cleanName,
          recipient_phone: cleanPhone,
          full_address: cleanAddress,
          notes: null,
          latitude: null,
          longitude: null,
          is_default: true,
        });
      } catch {
        // Ignore — the address book can still be filled later from Account.
      }
      // No navigation needed: flipping profile_completed swaps the navigator
      // from the onboarding stack into the main app automatically.
    } catch (e: any) {
      notify('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const initial = (name || user?.name || 'U').charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.subtitle}>
            Just a few details so drivers can reach you and we can save your addresses.
          </Text>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <TouchableOpacity activeOpacity={0.85} onPress={pickPhoto} style={styles.avatarTouch}>
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
            <TouchableOpacity onPress={pickPhoto} activeOpacity={0.7}>
              <Text style={styles.changePhoto}>{photo ? 'Change Photo' : 'Add Photo (optional)'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <Input value={name} onChangeText={setName} placeholder="Your full name" autoCapitalize="words" />

            <Text style={styles.fieldLabel}>Phone Number</Text>
            <Input value={phone} onChangeText={setPhone} placeholder="09XX XXX XXXX" keyboardType="phone-pad" />

            <Text style={styles.fieldLabel}>Home Address</Text>
            <Input
              value={address}
              onChangeText={setAddress}
              placeholder="House/Unit no., street, barangay, city"
              autoCapitalize="words"
              multiline
            />
            <Text style={styles.helper}>You can add more saved addresses anytime from your Account.</Text>

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.readonlyRow}>
              <MaterialCommunityIcons name="email-outline" size={18} color={colors.textMuted} />
              <Text style={styles.readonlyValue} numberOfLines={1}>{user?.email || 'Not set'}</Text>
              <MaterialCommunityIcons name="lock-outline" size={16} color={colors.textMuted} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="check" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Continue'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: layout.headerTop + spacing.md,
    paddingBottom: 120,
  },
  title: { ...typography.h1, fontSize: 28 },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  avatarWrap: { alignItems: 'center', marginBottom: spacing.xl },
  avatarTouch: { width: 104, height: 104, marginBottom: spacing.sm },
  avatar: {
    width: 104, height: 104, borderRadius: 52,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', ...shadows.md,
  },
  avatarImg: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.surfaceAlt, ...shadows.md },
  avatarText: { color: '#fff', fontSize: 42, fontWeight: '800' },
  cameraBadge: {
    position: 'absolute', right: 2, bottom: 2, width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: colors.background,
  },
  changePhoto: { ...typography.label, color: colors.accent, fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderLight,
  },
  fieldLabel: {
    ...typography.labelSmall, color: colors.textSecondary, fontWeight: '700',
    marginBottom: 6, marginLeft: 2, marginTop: spacing.sm,
  },
  helper: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12, marginTop: 4, marginLeft: 2 },
  readonlyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52,
  },
  readonlyValue: { flex: 1, ...typography.body, color: colors.textSecondary, fontSize: 15 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: radius.md, backgroundColor: colors.primary, marginTop: spacing.sm, ...shadows.md,
  },
  saveBtnText: { ...typography.button, color: '#fff', fontSize: 16 },
});

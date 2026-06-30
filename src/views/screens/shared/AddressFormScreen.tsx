import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@/controllers/hooks/useAuth';
import { AddressRepository } from '@/models/repositories/AddressRepository';
import { SavedAddress } from '@/models/types';
import { notify } from '@/utils/confirm';
import { Input } from '@/views/components/common/Input';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const addressRepo = new AddressRepository();
const QUICK_LABELS = ['Home', 'Work', 'Other'];

export const AddressFormScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const editing: SavedAddress | undefined = route.params?.address;

  const [label, setLabel] = useState(editing?.label ?? 'Home');
  const [recipientName, setRecipientName] = useState(editing?.recipient_name ?? user?.name ?? '');
  const [recipientPhone, setRecipientPhone] = useState(editing?.recipient_phone ?? user?.phone ?? '');
  const [fullAddress, setFullAddress] = useState(editing?.full_address ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const cleanLabel = label.trim() || 'Home';
    const cleanAddress = fullAddress.trim();
    if (!cleanAddress) return notify('Address required', 'Please enter the full address.');
    if (!user?.id) return notify('Not signed in', 'Please sign in again.');

    const payload = {
      user_id: user.id,
      label: cleanLabel,
      recipient_name: recipientName.trim() || null,
      recipient_phone: recipientPhone.trim() || null,
      full_address: cleanAddress,
      notes: notes.trim() || null,
      latitude: editing?.latitude ?? null,
      longitude: editing?.longitude ?? null,
      is_default: isDefault,
    };

    setSaving(true);
    try {
      if (editing) await addressRepo.update(editing.id, payload);
      else await addressRepo.create(payload);
      navigation.goBack();
    } catch (e: any) {
      notify('Save failed', e?.message || 'Could not save this address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{editing ? 'Edit Address' : 'New Address'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.7} style={styles.saveTextBtn}>
          <Text style={[styles.saveText, saving && { opacity: 0.4 }]}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Label</Text>
          <View style={styles.labelRow}>
            {QUICK_LABELS.map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.labelChip, label === l && styles.labelChipActive]}
                onPress={() => setLabel(l)}
                activeOpacity={0.8}
              >
                <Text style={[styles.labelChipText, label === l && styles.labelChipTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input value={label} onChangeText={setLabel} placeholder="e.g. Home, Mom's house" autoCapitalize="words" />

          <Text style={styles.fieldLabel}>Recipient Name</Text>
          <Input value={recipientName} onChangeText={setRecipientName} placeholder="Who's at this address?" autoCapitalize="words" />

          <Text style={styles.fieldLabel}>Contact Number</Text>
          <Input value={recipientPhone} onChangeText={setRecipientPhone} placeholder="09XX XXX XXXX" keyboardType="phone-pad" />

          <Text style={styles.fieldLabel}>Full Address</Text>
          <Input
            value={fullAddress}
            onChangeText={setFullAddress}
            placeholder="House/Unit no., street, barangay, city"
            autoCapitalize="words"
            multiline
          />

          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <Input value={notes} onChangeText={setNotes} placeholder="Landmark, gate color, delivery note" autoCapitalize="sentences" />

          <TouchableOpacity style={styles.defaultToggle} onPress={() => setIsDefault((v) => !v)} activeOpacity={0.8}>
            <MaterialCommunityIcons
              name={isDefault ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={isDefault ? colors.primary : colors.textMuted}
            />
            <Text style={styles.defaultToggleText}>Set as default address</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <MaterialCommunityIcons name="check" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Address'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingRight: spacing.screen, paddingTop: layout.headerTop,
    paddingBottom: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  appBarTitle: { ...typography.h3, fontSize: 18 },
  saveTextBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  saveText: { ...typography.label, color: colors.accent, fontWeight: '800', fontSize: 15 },
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, paddingBottom: 120 },
  fieldLabel: {
    ...typography.labelSmall, color: colors.textSecondary, fontWeight: '700', marginBottom: 6, marginLeft: 2,
  },
  labelRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  labelChip: {
    paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  labelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  labelChipText: { ...typography.label, color: colors.textSecondary, fontSize: 13 },
  labelChipTextActive: { color: '#fff' },
  defaultToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.lg },
  defaultToggleText: { ...typography.label, color: colors.text, fontSize: 14 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: radius.md, backgroundColor: colors.primary, ...shadows.md,
  },
  saveBtnText: { ...typography.button, color: '#fff', fontSize: 16 },
});

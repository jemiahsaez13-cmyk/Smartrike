import React, { useCallback, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { DriverPaymentMethod, DriverPaymentMethodType } from '@/models/entities/RidePayment';
import { RidePaymentService } from '@/models/services/RidePaymentService';
import { pickImageDataUri } from '@/utils/pickImageDataUri';
import { notify } from '@/utils/confirm';
import { Loading } from '@/views/components/common/Loading';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

const service = new RidePaymentService();
const TYPES: Array<{ key: DriverPaymentMethodType; label: string; icon: any }> = [
  { key: 'gcash', label: 'GCash', icon: 'cellphone' },
  { key: 'bank', label: 'Bank', icon: 'bank-outline' },
  { key: 'other', label: 'Other', icon: 'wallet-outline' },
];

export const OnlinePaymentSettingsScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);
  const [methods, setMethods] = useState<DriverPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [type, setType] = useState<DriverPaymentMethodType>('gcash');
  const [name, setName] = useState('GCash');
  const [holder, setHolder] = useState('');
  const [number, setNumber] = useState('');
  const [instructions, setInstructions] = useState('');
  const [qr, setQr] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try { setMethods(await service.listDriverMethods(user.id)); }
    catch (error: any) { void notify('Could not load payment methods', error?.message || 'Please try again.'); }
    finally { setLoading(false); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load]));

  const openNew = () => {
    setEditingId(undefined); setType('gcash'); setName('GCash'); setHolder(''); setNumber('');
    setInstructions(''); setQr(''); setEnabled(true); setVisible(true);
  };
  const openEdit = (method: DriverPaymentMethod) => {
    setEditingId(method.id); setType(method.method_type); setName(method.display_name);
    setHolder(method.account_name); setNumber(method.account_number); setInstructions(method.instructions || '');
    setQr(method.qr_code_url || ''); setEnabled(method.is_enabled); setVisible(true);
  };
  const chooseType = (value: DriverPaymentMethodType) => {
    setType(value);
    if (!editingId || name === 'GCash' || name === 'Bank Account' || name === 'Other Payment') {
      setName(value === 'gcash' ? 'GCash' : value === 'bank' ? 'Bank Account' : 'Other Payment');
    }
  };
  const chooseQr = async () => {
    try { const image = await pickImageDataUri(); if (image) setQr(image); }
    catch (error: any) { void notify('Could not use image', error?.message || 'Please choose another image.'); }
  };
  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await service.saveDriverMethod({
        id: editingId, driverId: user.id, methodType: type, displayName: name,
        accountName: holder, accountNumber: number, instructions, qrCodeUrl: qr, isEnabled: enabled,
      });
      setVisible(false); await load();
      await notify('Payment method saved', 'Passengers assigned to you can now use this payment method when it is enabled.');
    } catch (error: any) { await notify('Could not save', error?.message || 'Check the payment details and try again.'); }
    finally { setSaving(false); }
  };
  const toggle = async (method: DriverPaymentMethod) => {
    if (!user?.id) return;
    try {
      await service.setMethodEnabled(user.id, method.id, !method.is_enabled);
      setMethods((rows) => rows.map((row) => row.id === method.id ? { ...row, is_enabled: !row.is_enabled } : row));
    } catch (error: any) { void notify('Could not update method', error?.message || 'Please try again.'); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} /></TouchableOpacity>
        <View style={styles.headerCopy}><Text style={styles.title}>Online Payment</Text><Text style={styles.subtitle}>Your passenger-facing payment details</Text></View>
        <TouchableOpacity style={styles.add} onPress={openNew}><MaterialCommunityIcons name="plus" size={24} color="#fff" /></TouchableOpacity>
      </View>
      {loading ? <Loading message="Loading payment methods..." /> : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.notice}><MaterialCommunityIcons name="shield-lock-outline" size={22} color={colors.primary} /><Text style={styles.noticeText}>Only passengers assigned to your ride can view enabled details. QR codes and account numbers are never shown to unrelated users.</Text></View>
          {methods.map((method) => (
            <TouchableOpacity key={method.id} style={styles.card} onPress={() => openEdit(method)} activeOpacity={0.8}>
              {method.qr_code_url ? (
                <Image source={{ uri: method.qr_code_url }} style={styles.qrThumb} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <MaterialCommunityIcons name="credit-card-outline" size={25} color={colors.primary} />
                </View>
              )}
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{method.display_name}</Text>
                <Text style={styles.cardText}>{method.account_name}</Text>
                <Text style={styles.cardNumber}>{method.account_number}</Text>
              </View>
              <Switch value={method.is_enabled} onValueChange={() => toggle(method)} color={colors.primary} />
            </TouchableOpacity>
          ))}
          {!methods.length && <View style={styles.empty}><MaterialCommunityIcons name="wallet-plus-outline" size={46} color={colors.textLight} /><Text style={styles.emptyTitle}>No online method yet</Text><Text style={styles.emptyText}>Add GCash, a bank account, or another payment method. A QR code is optional.</Text></View>}
        </ScrollView>
      )}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && setVisible(false)}>
        <View style={styles.overlay}><View style={styles.sheet}>
          <View style={styles.sheetHead}><Text style={styles.sheetTitle}>{editingId ? 'Edit payment method' : 'Add payment method'}</Text><TouchableOpacity style={styles.close} onPress={() => setVisible(false)} disabled={saving}><MaterialCommunityIcons name="close" size={23} color={colors.text} /></TouchableOpacity></View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>METHOD TYPE</Text>
            <View style={styles.types}>{TYPES.map((item) => <TouchableOpacity key={item.key} style={[styles.type, type === item.key && styles.typeActive]} onPress={() => chooseType(item.key)}><MaterialCommunityIcons name={item.icon} size={18} color={type === item.key ? '#fff' : colors.primary} /><Text style={[styles.typeText, type === item.key && styles.typeTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
            <Text style={styles.label}>DISPLAY NAME</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. GCash" placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>ACCOUNT HOLDER NAME</Text><TextInput style={styles.input} value={holder} onChangeText={setHolder} placeholder="Name on account" placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>ACCOUNT / MOBILE NUMBER</Text><TextInput style={styles.input} value={number} onChangeText={setNumber} placeholder="Account or mobile number" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
            <Text style={styles.label}>PAYMENT INSTRUCTIONS (OPTIONAL)</Text><TextInput style={[styles.input, styles.multiline]} value={instructions} onChangeText={setInstructions} placeholder="Helpful transfer notes" placeholderTextColor={colors.textMuted} multiline />
            <Text style={styles.label}>QR CODE IMAGE (OPTIONAL)</Text>
            <TouchableOpacity style={styles.qrPicker} onPress={chooseQr}>{qr ? <Image source={{ uri: qr }} style={styles.qrPreview} /> : <MaterialCommunityIcons name="qrcode-scan" size={38} color={colors.primary} />}<Text style={styles.qrPickerText}>{qr ? 'Replace QR code' : 'Upload QR code'}</Text></TouchableOpacity>
            {qr ? <TouchableOpacity style={styles.removeQr} onPress={() => setQr('')}><MaterialCommunityIcons name="delete-outline" size={18} color={colors.error} /><Text style={styles.removeQrText}>Remove QR code</Text></TouchableOpacity> : null}
            <Text style={styles.qrHint}>Passengers can still pay using the account details when no QR code is provided.</Text>
            <View style={styles.enableRow}><View style={styles.cardCopy}><Text style={styles.enableTitle}>Enabled</Text><Text style={styles.cardText}>Available to assigned passengers</Text></View><Switch value={enabled} onValueChange={setEnabled} color={colors.primary} /></View>
            <TouchableOpacity style={[styles.save, saving && styles.disabled]} onPress={save} disabled={saving}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Payment Method'}</Text></TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', paddingTop: layout.headerTop, paddingHorizontal: spacing.sm, paddingRight: spacing.screen, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, minWidth: 0 }, title: { ...typography.h2, fontSize: 21 }, subtitle: { ...typography.bodySmall, color: colors.textSecondary }, add: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, content: { padding: spacing.screen, paddingBottom: layout.contentBottom }, notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primaryLight, marginBottom: spacing.lg }, noticeText: { ...typography.bodySmall, flex: 1, color: colors.textSecondary }, card: { minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }, qrThumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }, qrPlaceholder: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1, minWidth: 0 }, cardTitle: { ...typography.h3, fontSize: 16 }, cardText: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 }, cardNumber: { ...typography.label, color: colors.primary, marginTop: 3 }, empty: { alignItems: 'center', paddingVertical: 72 }, emptyTitle: { ...typography.h3, marginTop: spacing.md }, emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }, sheet: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }, sheetHead: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight }, sheetTitle: { ...typography.h2, fontSize: 20, flex: 1 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, form: { padding: spacing.lg, paddingBottom: 48 }, label: { ...typography.labelSmall, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.sm }, types: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }, type: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, typeActive: { backgroundColor: colors.primary, borderColor: colors.primary }, typeText: { ...typography.labelSmall, color: colors.primary }, typeTextActive: { color: '#fff' }, input: { ...typography.body, minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, color: colors.text, marginBottom: spacing.md }, multiline: { minHeight: 86, paddingTop: spacing.md, textAlignVertical: 'top' }, qrPicker: { minHeight: 130, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radius.lg, backgroundColor: colors.primaryLight, overflow: 'hidden' }, qrPreview: { width: 112, height: 112, marginTop: spacing.sm }, qrPickerText: { ...typography.label, color: colors.primary, marginVertical: spacing.sm }, removeQr: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }, removeQrText: { ...typography.labelSmall, color: colors.error }, qrHint: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg }, enableRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }, enableTitle: { ...typography.label, color: colors.text }, save: { minHeight: 54, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.6 }, saveText: { ...typography.button, color: '#fff' },
});

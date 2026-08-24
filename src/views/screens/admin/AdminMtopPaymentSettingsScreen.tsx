import React, { useCallback, useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import {
  AdminMtopPaymentMethod,
  AdminMtopPaymentMethodType,
} from '@/models/entities/AdminMtopPaymentMethod';
import { AdminMtopPaymentService } from '@/models/services/AdminMtopPaymentService';
import { pickImageDataUri } from '@/utils/pickImageDataUri';
import { notify } from '@/utils/confirm';
import { Loading } from '@/views/components/common/Loading';
import { MapPinPicker } from '@/views/components/location/MapPinPicker';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

const service = new AdminMtopPaymentService();

const TYPES: Array<{ key: AdminMtopPaymentMethodType; label: string; icon: string }> = [
  { key: 'gcash', label: 'GCash', icon: 'cellphone' },
  { key: 'bank', label: 'Bank', icon: 'bank-outline' },
  { key: 'face_to_face', label: 'Face-to-Face', icon: 'map-marker-outline' },
];

const defaultName = (type: AdminMtopPaymentMethodType): string => {
  if (type === 'gcash') return 'GCash';
  if (type === 'bank') return 'Bank Transfer';
  return 'Face-to-Face Payment';
};

export const AdminMtopPaymentSettingsScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);

  const [methods, setMethods] = useState<AdminMtopPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Form sheet state
  const [visible, setVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [type, setType] = useState<AdminMtopPaymentMethodType>('gcash');
  const [name, setName] = useState('GCash');
  const [holder, setHolder] = useState('');
  const [number, setNumber] = useState('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [instructions, setInstructions] = useState('');
  const [qr, setQr] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setMethods(await service.listMethods(user.id));
    } catch (error: any) {
      void notify('Could not load payment methods', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const resetForm = () => {
    setEditingId(undefined);
    setType('gcash');
    setName('GCash');
    setHolder('');
    setNumber('');
    setAddress('');
    setPin(null);
    setInstructions('');
    setQr('');
    setEnabled(true);
  };

  const openNew = () => {
    resetForm();
    setVisible(true);
  };

  const openEdit = (method: AdminMtopPaymentMethod) => {
    setEditingId(method.id);
    setType(method.method_type);
    setName(method.display_name);
    setHolder(method.account_name);
    setNumber(method.account_number ?? '');
    setAddress(method.address ?? '');
    setPin(
      method.location_lat != null && method.location_lng != null
        ? { latitude: method.location_lat, longitude: method.location_lng }
        : null
    );
    setInstructions(method.instructions ?? '');
    setQr(method.qr_code_url ?? '');
    setEnabled(method.is_enabled);
    setVisible(true);
  };

  const chooseType = (value: AdminMtopPaymentMethodType) => {
    setType(value);
    // Auto-set name only when user hasn't customised it yet.
    if (!editingId || name === defaultName(type)) {
      setName(defaultName(value));
    }
  };

  const chooseQr = async () => {
    try {
      const image = await pickImageDataUri();
      if (image) setQr(image);
    } catch (error: any) {
      void notify('Could not use image', error?.message || 'Please choose another image.');
    }
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await service.saveMethod({
        id: editingId,
        adminId: user.id,
        methodType: type,
        displayName: name,
        accountName: holder,
        accountNumber: type !== 'face_to_face' ? number : undefined,
        address: type === 'face_to_face' ? address : undefined,
        locationLat: type === 'face_to_face' ? pin?.latitude ?? null : null,
        locationLng: type === 'face_to_face' ? pin?.longitude ?? null : null,
        instructions,
        qrCodeUrl: type !== 'face_to_face' ? qr : undefined,
        isEnabled: enabled,
      });
      setVisible(false);
      await load();
      await notify(
        'Payment method saved',
        'This option will be shown to applicants when you send a billing during the MTOP payment step.'
      );
    } catch (error: any) {
      await notify('Could not save', error?.message || 'Check the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (method: AdminMtopPaymentMethod) => {
    if (!user?.id) return;
    try {
      await service.setEnabled(user.id, method.id, !method.is_enabled);
      setMethods((rows) =>
        rows.map((row) =>
          row.id === method.id ? { ...row, is_enabled: !row.is_enabled } : row
        )
      );
    } catch (error: any) {
      void notify('Could not update', error?.message || 'Please try again.');
    }
  };

  const remove = async (method: AdminMtopPaymentMethod) => {
    if (!user?.id) return;
    try {
      await service.deleteMethod(user.id, method.id);
      setMethods((rows) => rows.filter((row) => row.id !== method.id));
    } catch (error: any) {
      void notify('Could not delete', error?.message || 'Please try again.');
    }
  };

  const isFaceToFace = type === 'face_to_face';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>MTOP Billing Methods</Text>
          <Text style={styles.subtitle}>Payment options shown to MTOP applicants</Text>
        </View>
        <TouchableOpacity style={styles.add} onPress={openNew}>
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <Loading message="Loading billing methods..." />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Info notice */}
          <View style={styles.notice}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.primary} />
            <Text style={styles.noticeText}>
              Enabled methods appear in the billing confirmation popup when you send a billing
              to an MTOP applicant from the MTOP management screen.
            </Text>
          </View>

          {/* Method cards */}
          {methods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={styles.card}
              onPress={() => openEdit(method)}
              activeOpacity={0.8}
            >
              {/* Icon/QR thumbnail */}
              {method.qr_code_url ? (
                <Image source={{ uri: method.qr_code_url }} style={styles.qrThumb} />
              ) : (
                <View style={styles.iconBox}>
                  <MaterialCommunityIcons
                    name={
                      method.method_type === 'gcash'
                        ? 'cellphone'
                        : method.method_type === 'bank'
                        ? 'bank-outline'
                        : 'map-marker-outline'
                    }
                    size={26}
                    color={colors.primary}
                  />
                </View>
              )}

              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{method.display_name}</Text>
                <Text style={styles.cardSub}>{method.account_name}</Text>
                {method.method_type !== 'face_to_face' && method.account_number ? (
                  <Text style={styles.cardNumber}>{method.account_number}</Text>
                ) : null}
                {method.method_type === 'face_to_face' && method.address ? (
                  <Text style={styles.cardAddress} numberOfLines={1}>
                    {method.address}
                  </Text>
                ) : null}
              </View>

              <View style={styles.cardActions}>
                <Switch
                  value={method.is_enabled}
                  onValueChange={() => toggle(method)}
                  color={colors.primary}
                />
                <TouchableOpacity
                  onPress={() => remove(method)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="delete-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}

          {!methods.length && (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="cash-register" size={46} color={colors.textLight} />
              <Text style={styles.emptyTitle}>No billing methods yet</Text>
              <Text style={styles.emptyText}>
                Add GCash, bank transfer, or face-to-face options. These appear when you send a
                billing to an MTOP applicant.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add/Edit sheet */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Sheet header */}
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>
                {editingId ? 'Edit Billing Method' : 'Add Billing Method'}
              </Text>
              <TouchableOpacity
                style={styles.close}
                onPress={() => setVisible(false)}
                disabled={saving}
              >
                <MaterialCommunityIcons name="close" size={23} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Method type selector */}
              <Text style={styles.label}>METHOD TYPE</Text>
              <View style={styles.types}>
                {TYPES.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.type, type === item.key && styles.typeActive]}
                    onPress={() => chooseType(item.key)}
                  >
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={18}
                      color={type === item.key ? '#fff' : colors.primary}
                    />
                    <Text style={[styles.typeText, type === item.key && styles.typeTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Display name */}
              <Text style={styles.label}>DISPLAY NAME</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. GCash – TODA Office"
                placeholderTextColor={colors.textMuted}
              />

              {/* Contact / account holder */}
              <Text style={styles.label}>
                {isFaceToFace ? 'CONTACT PERSON' : 'ACCOUNT HOLDER NAME'}
              </Text>
              <TextInput
                style={styles.input}
                value={holder}
                onChangeText={setHolder}
                placeholder={isFaceToFace ? 'Name of contact' : 'Name on account'}
                placeholderTextColor={colors.textMuted}
              />

              {/* Conditional: account number OR face-to-face address + map */}
              {isFaceToFace ? (
                <>
                  <Text style={styles.label}>OFFICE / VENUE ADDRESS</Text>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Full address where applicants can pay in person"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />

                  <Text style={styles.label}>PIN PAYMENT LOCATION ON MAP</Text>
                  <Text style={styles.mapHint}>
                    Tap the map or drag the marker to pin the exact payment location.
                  </Text>
                  <MapPinPicker
                    value={pin ?? undefined}
                    onChange={(coord) => setPin(coord)}
                    height={240}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.label}>ACCOUNT / MOBILE NUMBER</Text>
                  <TextInput
                    style={styles.input}
                    value={number}
                    onChangeText={setNumber}
                    placeholder="Account or mobile number"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="default"
                  />
                </>
              )}

              {/* Instructions */}
              <Text style={styles.label}>PAYMENT INSTRUCTIONS (OPTIONAL)</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={instructions}
                onChangeText={setInstructions}
                placeholder={
                  isFaceToFace
                    ? 'e.g. Office hours, what to bring'
                    : 'e.g. Transfer to this account then send screenshot'
                }
                placeholderTextColor={colors.textMuted}
                multiline
              />

              {/* QR code (gcash/bank only) */}
              {!isFaceToFace && (
                <>
                  <Text style={styles.label}>QR CODE IMAGE (OPTIONAL)</Text>
                  <TouchableOpacity style={styles.qrPicker} onPress={chooseQr}>
                    {qr ? (
                      <Image source={{ uri: qr }} style={styles.qrPreview} />
                    ) : (
                      <MaterialCommunityIcons name="qrcode-scan" size={38} color={colors.primary} />
                    )}
                    <Text style={styles.qrPickerText}>
                      {qr ? 'Replace QR code' : 'Upload QR code'}
                    </Text>
                  </TouchableOpacity>
                  {qr ? (
                    <TouchableOpacity style={styles.removeQr} onPress={() => setQr('')}>
                      <MaterialCommunityIcons name="delete-outline" size={18} color={colors.error} />
                      <Text style={styles.removeQrText}>Remove QR code</Text>
                    </TouchableOpacity>
                  ) : null}
                  <Text style={styles.qrHint}>
                    Applicants can still pay using account details when no QR is provided.
                  </Text>
                </>
              )}

              {/* Enable toggle */}
              <View style={styles.enableRow}>
                <View style={styles.cardCopy}>
                  <Text style={styles.enableTitle}>Enabled</Text>
                  <Text style={styles.cardSub}>Show this method in the billing popup</Text>
                </View>
                <Switch value={enabled} onValueChange={setEnabled} color={colors.primary} />
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[styles.save, saving && styles.disabled]}
                onPress={save}
                disabled={saving}
              >
                <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Billing Method'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: layout.headerTop,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.screen,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { ...typography.h2, fontSize: 21 },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },
  add: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.screen, paddingBottom: 80 },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.lg,
  },
  noticeText: { ...typography.bodySmall, flex: 1, color: colors.textSecondary },
  card: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrThumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { ...typography.h3, fontSize: 15 },
  cardSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  cardNumber: { ...typography.label, color: colors.primary, marginTop: 3 },
  cardAddress: { ...typography.bodySmall, color: colors.textMuted, marginTop: 3 },
  cardActions: { alignItems: 'center', gap: spacing.xs },
  deleteBtn: { marginTop: spacing.xs },
  empty: { alignItems: 'center', paddingVertical: 72 },
  emptyTitle: { ...typography.h3, marginTop: spacing.md },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  // Modal / sheet
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '95%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sheetTitle: { ...typography.h2, fontSize: 20, flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  form: { padding: spacing.lg, paddingBottom: 56 },
  label: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  types: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  type: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { ...typography.labelSmall, color: colors.primary },
  typeTextActive: { color: '#fff' },
  input: {
    ...typography.body,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    color: colors.text,
    marginBottom: spacing.md,
  },
  multiline: { minHeight: 86, paddingTop: spacing.md, textAlignVertical: 'top' },
  mapHint: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  qrPicker: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
  },
  qrPreview: { width: 112, height: 112, marginTop: spacing.sm },
  qrPickerText: { ...typography.label, color: colors.primary, marginVertical: spacing.sm },
  removeQr: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  removeQrText: { ...typography.labelSmall, color: colors.error },
  qrHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  enableRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  enableTitle: { ...typography.label, color: colors.text },
  save: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  saveText: { ...typography.button, color: '#fff' },
});

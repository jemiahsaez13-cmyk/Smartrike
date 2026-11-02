import React, { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { setUser, signOut } from '@/controllers/slices/authSlice';
import { UserRepository } from '@/models/repositories/UserRepository';
import { DriverDocumentService } from '@/models/services/DriverDocumentService';
import {
  DRIVER_DOCUMENT_TYPES,
  DriverDocument,
  DriverDocumentType,
  DriverDocumentsStatus,
} from '@/models/entities/DriverDocument';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { DriverDocumentPicker } from '@/views/components/driver/DriverDocumentPicker';
import { notify } from '@/utils/confirm';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

const documentService = new DriverDocumentService();

const STATUS_COPY: Record<DriverDocumentsStatus, { icon: string; color: string; bg: string; title: string; body: string }> = {
  missing: {
    icon: 'file-upload-outline', color: colors.primary, bg: colors.primaryLight,
    title: 'Finish your driver application',
    body: 'Upload your residential address and clear photos of your documents. The FEDTODAB administrator reviews them before you can accept bookings.',
  },
  pending: {
    icon: 'clock-outline', color: '#8A5A00', bg: colors.warningLight,
    title: 'Application under review',
    body: 'Your documents were submitted. You can accept bookings once the administrator approves them.',
  },
  rejected: {
    icon: 'alert-circle-outline', color: colors.error, bg: colors.errorLight,
    title: 'Some documents were rejected',
    body: 'Upload a new photo for each rejected document below, then submit again.',
  },
  approved: {
    icon: 'check-decagram', color: colors.success, bg: colors.successLight,
    title: 'All documents approved',
    body: 'Your documents passed the administrator review.',
  },
};

/**
 * Driver application documents. Shown in place of the app while documents are
 * missing (AppNavigator), and from the dashboard to replace rejected ones.
 */
export const DriverDocumentsScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user) as any;
  const [existing, setExisting] = useState<DriverDocument[]>([]);
  const [picked, setPicked] = useState<Partial<Record<DriverDocumentType, string>>>({});
  const [homeAddress, setHomeAddress] = useState<string>(user?.home_address ?? '');
  const [missing, setMissing] = useState<DriverDocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canGoBack = navigation.canGoBack();
  const status: DriverDocumentsStatus = user?.driver_documents_status ?? 'missing';
  const copy = STATUS_COPY[status];

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setExisting(await documentService.listForDriver(user.id));
    } catch (error: any) {
      void notify('Could not load documents', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const submit = async () => {
    // Every document needs a photo on file that is not rejected, or a new one.
    const stillNeeded = DRIVER_DOCUMENT_TYPES.filter(({ type }) => {
      if (picked[type]) return false;
      const onFile = existing.find((d) => d.doc_type === type);
      return !onFile || onFile.review_status === 'rejected';
    });
    setMissing(stillNeeded.map((d) => d.type));
    if (homeAddress.trim().length < 10) {
      void notify('Address required', 'Enter your complete residential address: house no., street, purok/sitio, barangay and municipality.');
      return;
    }
    if (stillNeeded.length) {
      void notify('Documents required', `Upload a clear photo of: ${stillNeeded.map((d) => d.label).join(', ')}.`);
      return;
    }
    setSaving(true);
    try {
      await documentService.submit({ homeAddress: homeAddress.trim(), documents: picked });
      setPicked({});
      await load();
      // Refreshing the profile updates driver_documents_status, which lifts the
      // sign-up gate in AppNavigator.
      const profile = await new UserRepository().findById(user.id);
      if (profile) dispatch(setUser(profile));
      await notify('Documents submitted', 'The FEDTODAB administrator will review your documents. You will be notified of the result.');
    } catch (error: any) {
      void notify('Could not submit', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(picked).length > 0 || homeAddress.trim() !== (user?.home_address ?? '').trim();

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        {canGoBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.appBarTitle}>Driver Application</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.statusCard, { backgroundColor: copy.bg }]}>
            <MaterialCommunityIcons name={copy.icon as any} size={26} color={copy.color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: copy.color }]}>{copy.title}</Text>
              <Text style={styles.statusBody}>{copy.body}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>RESIDENTIAL ADDRESS</Text>
          <Input
            label="Complete residential address"
            placeholder="House no., street, purok/sitio, barangay, municipality"
            value={homeAddress}
            onChangeText={setHomeAddress}
            autoCapitalize="words"
            multiline
            editable={!saving}
            left={<TextInput.Icon icon="home-outline" color={colors.textMuted} />}
          />

          <Text style={styles.sectionLabel}>REQUIRED DOCUMENTS</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <DriverDocumentPicker
              values={picked}
              existing={existing}
              invalid={missing}
              disabled={saving}
              onChange={(type, uri) => {
                setPicked((prev) => ({ ...prev, [type]: uri }));
                setMissing((prev) => prev.filter((t) => t !== type));
              }}
            />
          )}

          {status !== 'approved' && (
            <Button variant="primary" onPress={submit} loading={saving} disabled={saving || loading || !hasChanges} style={styles.cta}>
              Submit for Review
            </Button>
          )}

          {!canGoBack && (
            <TouchableOpacity style={styles.signOut} onPress={() => dispatch(signOut())} disabled={saving}>
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  appBarTitle: { ...typography.h3, fontSize: 18 },
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, paddingBottom: 120 },
  statusCard: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.lg },
  statusTitle: { ...typography.label, fontSize: 15 },
  statusBody: { ...typography.bodySmall, fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 19 },
  sectionLabel: {
    ...typography.labelSmall,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  cta: { height: 54, marginTop: spacing.md },
  signOut: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  signOutText: { ...typography.label, color: colors.textSecondary },
});

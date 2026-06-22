import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AdminService } from '@/models/services/AdminService';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import { notify } from '@/utils/confirm';
import { useAppSelector } from '@/controllers/store';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { Card } from '@/views/components/common/Card';

const adminService = new AdminService();

// Mirror of FareCalculationService.calculateFare so the preview matches the
// fare the apps will actually charge: ₱base for the first km, then ₱perKm for
// every succeeding km, distance rounded up, optional peak multiplier.
const fareFor = (km: number, base: number, perKm: number, multiplier: number) => {
  const whole = Math.max(1, Math.ceil(km));
  return Math.round((base + (whole - 1) * perKm) * (multiplier || 1) * 100) / 100;
};

const PREVIEW_KM = [1, 2, 3, 5, 8, 10, 16];

export const FareSettingsScreen = () => {
  const navigation = useNavigation<any>();
  const currentUser = useAppSelector((state) => state.auth.user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseFare, setBaseFare] = useState('120');
  const [perKm, setPerKm] = useState('10');
  const [peakEnabled, setPeakEnabled] = useState(false);
  const [multiplier, setMultiplier] = useState('1.5');

  const load = useCallback(async () => {
    try {
      const m = await adminService.getFareMatrix();
      setBaseFare(String(m.base_fare));
      setPerKm(String(m.per_km_rate));
      setPeakEnabled(Boolean(m.peak_hours_enabled));
      setMultiplier(String(m.peak_hour_multiplier ?? 1.5));
    } catch (e: any) {
      console.error('Failed to load fare matrix:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const base = parseFloat(baseFare) || 0;
  const rate = parseFloat(perKm) || 0;
  const mult = peakEnabled ? parseFloat(multiplier) || 1 : 1;

  const preview = useMemo(
    () => PREVIEW_KM.map((km) => ({ km, fare: fareFor(km, base, rate, mult) })),
    [base, rate, mult]
  );

  const save = async () => {
    if (base <= 0) {
      notify('Invalid base fare', 'Enter a base fare greater than ₱0.');
      return;
    }
    if (rate < 0) {
      notify('Invalid rate', 'The per-kilometer rate cannot be negative.');
      return;
    }
    if (peakEnabled && (parseFloat(multiplier) || 0) < 1) {
      notify('Invalid multiplier', 'The peak multiplier must be at least 1.0.');
      return;
    }
    setSaving(true);
    try {
      await adminService.updateFareMatrix({
        base_fare: base,
        per_km_rate: rate,
        peak_hour_multiplier: parseFloat(multiplier) || 1,
        peak_hours_enabled: peakEnabled,
      });
      void ActivityLogService.logActivity({
        user_id: currentUser?.id,
        action_type: 'system_alert',
        entity_type: 'system',
        description: `Admin updated the fare: ₱${base} base + ₱${rate}/km${peakEnabled ? ` · peak ×${parseFloat(multiplier) || 1}` : ''}.`,
        severity: 'success',
      });
      notify('Fare updated', 'The new fare applies to all bookings from now on.');
    } catch (e: any) {
      notify('Save failed', e?.message || 'Could not update the fare.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Loading fare settings..." />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Fare Settings</Text>
          <Text style={styles.headerSubtitle}>Boac tricycle fare matrix</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card variant="elevated" padding="lg" style={styles.card}>
          <Text style={styles.label}>BASE FARE (FIRST KILOMETER)</Text>
          <View style={styles.inputRow}>
            <Text style={styles.peso}>₱</Text>
            <RNTextInput
              style={styles.input}
              value={baseFare}
              onChangeText={setBaseFare}
              keyboardType="decimal-pad"
              placeholder="120"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={[styles.label, { marginTop: spacing.lg }]}>RATE PER SUCCEEDING KILOMETER</Text>
          <View style={styles.inputRow}>
            <Text style={styles.peso}>₱</Text>
            <RNTextInput
              style={styles.input}
              value={perKm}
              onChangeText={setPerKm}
              keyboardType="decimal-pad"
              placeholder="10"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Peak-hour surcharge</Text>
              <Text style={styles.toggleSub}>Applies a multiplier from 6:30–9:00 AM.</Text>
            </View>
            <Switch value={peakEnabled} onValueChange={setPeakEnabled} color={colors.primary} />
          </View>

          {peakEnabled && (
            <>
              <Text style={styles.label}>PEAK MULTIPLIER</Text>
              <View style={styles.inputRow}>
                <Text style={styles.peso}>×</Text>
                <RNTextInput
                  style={styles.input}
                  value={multiplier}
                  onChangeText={setMultiplier}
                  keyboardType="decimal-pad"
                  placeholder="1.5"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </>
          )}
        </Card>

        <Text style={styles.previewTitle}>FARE PREVIEW{peakEnabled ? ' · PEAK' : ''}</Text>
        <Card variant="elevated" padding="none" style={styles.previewCard}>
          {preview.map((row, idx) => (
            <View key={row.km} style={[styles.previewRow, idx < preview.length - 1 && styles.previewRowBorder]}>
              <Text style={styles.previewKm}>{row.km} km</Text>
              <Text style={[styles.previewFare, typography.currency]}>₱{row.fare.toFixed(2)}</Text>
            </View>
          ))}
        </Card>

        <Text style={styles.formula}>
          Fare = ₱{base || 0} + ((distance km − 1) × ₱{rate || 0}){mult !== 1 ? `, ×${mult} at peak` : ''}
        </Text>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
          <MaterialCommunityIcons name="content-save-outline" size={20} color="#fff" />
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Fare'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCopy: { flex: 1 },
  headerTitle: { ...typography.h1, fontSize: 28 },
  headerSubtitle: { ...typography.body, color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, paddingBottom: 120 },
  card: { marginBottom: spacing.lg },
  label: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  peso: { ...typography.h3, color: colors.textSecondary, marginRight: spacing.sm },
  input: { ...typography.h3, flex: 1, color: colors.text, height: 56, padding: 0 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  toggleTitle: { ...typography.label, fontSize: 15, color: colors.text },
  toggleSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  previewTitle: { ...typography.labelSmall, color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.sm, fontSize: 10 },
  previewCard: { marginBottom: spacing.md },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    height: 48,
  },
  previewRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  previewKm: { ...typography.body, color: colors.textSecondary, fontSize: 14 },
  previewFare: { ...typography.label, color: colors.text, fontSize: 15 },
  formula: { ...typography.bodySmall, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.lg, textAlign: 'center' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveText: { ...typography.button, color: '#fff', fontSize: 16 },
});

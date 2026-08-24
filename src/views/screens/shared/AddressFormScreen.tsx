import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@/controllers/hooks/useAuth';
import { AddressRepository } from '@/models/repositories/AddressRepository';
import { GeocodingService } from '@/models/services/GeocodingService';
import { SavedAddress } from '@/models/types';
import { notify } from '@/utils/confirm';
import { Input } from '@/views/components/common/Input';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';
import { MapPinPicker } from '@/views/components/location/MapPinPicker';

const addressRepo = new AddressRepository();
const geocoder = new GeocodingService();
const QUICK_LABELS = ['Home', 'Work', 'Other'];
const BOAC_CENTER = { latitude: 13.4452, longitude: 121.8401 };

type PinCoordinate = { latitude: number; longitude: number };
type PinSource = 'saved' | 'manual' | 'suggestion';

const isValidPin = (value?: { latitude: number | null; longitude: number | null }): value is PinCoordinate =>
  value?.latitude != null &&
  value?.longitude != null &&
  Number.isFinite(value.latitude) &&
  Number.isFinite(value.longitude) &&
  Math.abs(value.latitude) <= 90 &&
  Math.abs(value.longitude) <= 180;

// Saved addresses are used by the Marinduque TODA service. Keeping automatic
// suggestions inside this broad island envelope prevents an ambiguous address
// from jumping to a same-named place in another country or province.
const isInMarinduqueServiceArea = ({ latitude, longitude }: PinCoordinate) =>
  latitude >= 13.15 && latitude <= 13.65 && longitude >= 121.75 && longitude <= 122.20;

export const AddressFormScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const editing: SavedAddress | undefined = route.params?.address;
  const savedPin = isValidPin(editing) ? { latitude: editing.latitude, longitude: editing.longitude } : null;

  const [label, setLabel] = useState(editing?.label ?? 'Home');
  const [recipientName, setRecipientName] = useState(editing?.recipient_name ?? user?.name ?? '');
  const [recipientPhone, setRecipientPhone] = useState(editing?.recipient_phone ?? user?.phone ?? '');
  const [fullAddress, setFullAddress] = useState(editing?.full_address ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false);
  const [selectedPin, setSelectedPin] = useState<PinCoordinate | null>(savedPin);
  const [pinConfirmed, setPinConfirmed] = useState(Boolean(savedPin));
  const [pinSource, setPinSource] = useState<PinSource | null>(savedPin ? 'saved' : null);
  const [pinDescription, setPinDescription] = useState(savedPin ? 'Previously saved pin' : '');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const lookupSequence = useRef(0);

  const placePendingPin = (coordinate: PinCoordinate, source: Exclude<PinSource, 'saved'>) => {
    if (!isValidPin(coordinate)) return;

    const exactPin = { latitude: coordinate.latitude, longitude: coordinate.longitude };
    const requestId = ++lookupSequence.current;
    setSelectedPin(exactPin);
    setPinSource(source);
    setPinConfirmed(false);
    setPinDescription(source === 'suggestion' ? 'Address lookup suggestion — check the pin carefully' : 'Checking map reference…');

    // This text is informational only. Reverse geocoding never changes the
    // typed address or the selected coordinates.
    void geocoder.reverseGeocode(exactPin.latitude, exactPin.longitude).then((description) => {
      if (lookupSequence.current === requestId) setPinDescription(description);
    });
  };

  const handleFindSuggestion = async () => {
    const cleanAddress = fullAddress.trim();
    if (!cleanAddress) {
      notify('Address required', 'Enter the address first, or place the pin manually on the map.');
      return;
    }

    setLocating(true);
    try {
      const localizedQuery = /marinduque|philippines/i.test(cleanAddress)
        ? cleanAddress
        : `${cleanAddress}, Marinduque, Philippines`;
      const suggestion = await geocoder.forwardGeocode(localizedQuery);
      if (!suggestion || !isInMarinduqueServiceArea(suggestion)) {
        notify(
          'No reliable suggestion',
          'We could not confidently locate that address in Marinduque. Please tap the map to place the pin manually.'
        );
        return;
      }
      placePendingPin(suggestion, 'suggestion');
    } catch {
      notify('Could not locate address', 'Please place the pin manually on the map.');
    } finally {
      setLocating(false);
    }
  };

  const handleConfirmPin = () => {
    if (!selectedPin) {
      notify('Pin required', 'Tap the map to select the exact location first.');
      return;
    }
    setPinConfirmed(true);
  };

  const handleSave = async () => {
    const cleanLabel = label.trim() || 'Home';
    const cleanAddress = fullAddress.trim();
    if (!cleanAddress) return notify('Address required', 'Please enter the full address.');
    if (!selectedPin) return notify('Pin location required', 'Tap the map and place the pin at the exact address.');
    if (!pinConfirmed) return notify('Confirm pin location', 'Review the selected point and tap “Confirm This Pin” before saving.');
    if (!user?.id) return notify('Not signed in', 'Please sign in again.');

    const payload = {
      user_id: user.id,
      label: cleanLabel,
      recipient_name: recipientName.trim() || null,
      recipient_phone: recipientPhone.trim() || null,
      full_address: cleanAddress,
      notes: notes.trim() || null,
      // Persist only the exact pin that the user explicitly confirmed. Typed
      // address text and geocoding results can never replace these silently.
      latitude: selectedPin.latitude,
      longitude: selectedPin.longitude,
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

  const mapStart = savedPin ?? BOAC_CENTER;

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{editing ? 'Edit Address' : 'New Address'}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
          style={styles.saveTextBtn}
          accessibilityRole="button"
        >
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

          <View style={styles.pinHeadingRow}>
            <View style={styles.pinHeadingCopy}>
              <Text style={styles.pinTitle}>Pin Location on Map</Text>
              <Text style={styles.pinRequired}>Required</Text>
            </View>
            <TouchableOpacity
              style={[styles.suggestBtn, (locating || !fullAddress.trim()) && styles.suggestBtnDisabled]}
              onPress={handleFindSuggestion}
              disabled={locating || !fullAddress.trim()}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Find typed address suggestion on map"
            >
              <MaterialCommunityIcons name="magnify" size={17} color={colors.primary} />
              <Text style={styles.suggestBtnText}>{locating ? 'Locating…' : 'Find address'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.pinInstructions}>
            Tap the map or drag the marker to the exact entrance, then confirm the pin. Address lookup is only a suggestion.
          </Text>

          <View style={styles.mapCard}>
            <MapPinPicker value={selectedPin} initialCenter={mapStart} onChange={(coordinate) => { if (coordinate) placePendingPin(coordinate, 'manual'); else { setSelectedPin(null); setPinConfirmed(false); } }} height={260} />
          </View>

          <View style={[styles.pinStatus, pinConfirmed && styles.pinStatusConfirmed]}>
            <MaterialCommunityIcons
              name={pinConfirmed ? 'check-circle' : selectedPin ? 'map-marker-alert-outline' : 'map-marker-off-outline'}
              size={22}
              color={pinConfirmed ? colors.success : colors.textSecondary}
            />
            <View style={styles.pinStatusCopy}>
              <Text style={styles.pinStatusTitle}>
                {pinConfirmed ? 'Pin confirmed' : selectedPin ? 'Review this pin' : 'No pin selected'}
              </Text>
              <Text style={styles.pinStatusText} numberOfLines={2}>
                {selectedPin
                  ? `${pinDescription || 'Selected map point'}\n${selectedPin.latitude.toFixed(6)}, ${selectedPin.longitude.toFixed(6)}`
                  : 'Tap anywhere on the map to place the address pin.'}
              </Text>
              {pinSource === 'suggestion' && !pinConfirmed && (
                <Text style={styles.suggestionWarning}>Suggested only — it will not be saved until you confirm it.</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmPinBtn, (!selectedPin || pinConfirmed) && styles.confirmPinBtnDisabled]}
            onPress={handleConfirmPin}
            disabled={!selectedPin || pinConfirmed}
            activeOpacity={0.82}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name={pinConfirmed ? 'check' : 'map-marker-check-outline'} size={20} color={pinConfirmed ? colors.success : '#fff'} />
            <Text style={[styles.confirmPinText, pinConfirmed && styles.confirmPinTextDone]}>
              {pinConfirmed ? 'Location Confirmed' : 'Confirm This Pin'}
            </Text>
          </TouchableOpacity>

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

          <TouchableOpacity
            style={[styles.saveBtn, (saving || !pinConfirmed) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
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
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  appBarTitle: { ...typography.h3, fontSize: 18 },
  saveTextBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  saveText: { ...typography.label, color: colors.accent, fontWeight: '800', fontSize: 15 },
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, paddingBottom: 120 },
  fieldLabel: {
    ...typography.labelSmall, color: colors.textSecondary, fontWeight: '700', marginBottom: 6, marginLeft: 2,
  },
  labelRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  labelChip: {
    paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  labelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  labelChipText: { ...typography.label, color: colors.textSecondary, fontSize: 13 },
  labelChipTextActive: { color: '#fff' },
  pinHeadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    marginTop: spacing.xs, marginBottom: spacing.xs,
  },
  pinHeadingCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  pinTitle: { ...typography.label, color: colors.text, fontWeight: '700', fontSize: 15 },
  pinRequired: {
    ...typography.labelSmall, color: colors.error, fontSize: 10, fontWeight: '700',
    backgroundColor: colors.errorLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill,
  },
  suggestBtn: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primaryLight,
  },
  suggestBtnDisabled: { opacity: 0.45 },
  suggestBtnText: { ...typography.labelSmall, color: colors.primary, fontWeight: '700' },
  pinInstructions: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 19 },
  mapCard: {
    height: 260, overflow: 'hidden', borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  map: { flex: 1 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  mapFallbackTitle: { ...typography.label, color: colors.text, textAlign: 'center', marginTop: spacing.sm },
  mapFallbackText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  pinStatus: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md,
    marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  pinStatusConfirmed: { backgroundColor: colors.primarySoft, borderColor: colors.secondaryLight },
  pinStatusCopy: { flex: 1 },
  pinStatusTitle: { ...typography.label, color: colors.text, fontWeight: '700', fontSize: 14 },
  pinStatusText: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  suggestionWarning: { ...typography.labelSmall, color: colors.error, marginTop: spacing.xs, fontWeight: '700' },
  confirmPinBtn: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginTop: spacing.sm, marginBottom: spacing.lg, borderRadius: radius.md, backgroundColor: colors.primary,
  },
  confirmPinBtnDisabled: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.secondaryLight },
  confirmPinText: { ...typography.button, color: '#fff', fontSize: 14 },
  confirmPinTextDone: { color: colors.success },
  defaultToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44,
    marginTop: spacing.xs, marginBottom: spacing.lg,
  },
  defaultToggleText: { ...typography.label, color: colors.text, fontSize: 14 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: radius.md, backgroundColor: colors.primary, ...shadows.md,
  },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { ...typography.button, color: '#fff', fontSize: 16 },
});

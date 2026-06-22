import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Image,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { PopularPlaceService } from '@/models/services/PopularPlaceService';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import { confirm, notify } from '@/utils/confirm';
import { useAppSelector } from '@/controllers/store';
import { PopularPlace } from '@/config/constants';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';

const placeService = new PopularPlaceService();

const CATEGORY_OPTIONS: { label: string; icon: string }[] = [
  { label: 'Landmark', icon: 'star-outline' },
  { label: 'Market', icon: 'storefront-outline' },
  { label: 'School', icon: 'school-outline' },
  { label: 'Government', icon: 'bank-outline' },
  { label: 'Hospital', icon: 'hospital-building' },
  { label: 'Town Center', icon: 'city-variant-outline' },
  { label: 'Port', icon: 'ferry' },
  { label: 'Beach', icon: 'beach' },
  { label: 'Nature', icon: 'image-filter-hdr' },
  { label: 'Place', icon: 'map-marker' },
];

const iconFor = (category: string) =>
  CATEGORY_OPTIONS.find((c) => c.label === category)?.icon || 'map-marker';

export const PlaceManagementScreen = () => {
  const navigation = useNavigation<any>();
  const currentUser = useAppSelector((state) => state.auth.user);

  const [places, setPlaces] = useState<PopularPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('Place');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [details, setDetails] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await placeService.listAll();
      setPlaces(data);
    } catch (e: any) {
      console.error('Failed to load places:', e);
      notify('Load failed', e?.message || 'Could not load places.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openNew = () => {
    setEditingId(null);
    setName('');
    setAddress('');
    setCategory('Place');
    setLat('');
    setLng('');
    setDetails('');
    setImage(null);
    setActive(true);
    setModalVisible(true);
  };

  const openEdit = (place: PopularPlace) => {
    setEditingId(place.id);
    setName(place.name);
    setAddress(place.address);
    setCategory(place.category);
    setLat(String(place.lat));
    setLng(String(place.lng));
    setDetails(place.details || '');
    setImage(place.image || null);
    setActive(place.isActive !== false);
    setModalVisible(true);
  };

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', 'Allow photo access to upload a place picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
    } catch {
      notify('Error', 'Could not open your photo library. Please try again.');
    }
  };

  const save = async () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!name.trim()) {
      notify('Name required', 'Enter the place name.');
      return;
    }
    if (!isFinite(latNum) || !isFinite(lngNum)) {
      notify('Coordinates required', 'Enter valid latitude and longitude numbers.');
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      category,
      icon: iconFor(category),
      latitude: latNum,
      longitude: lngNum,
      image_url: image,
      details: details.trim() || null,
      is_active: active,
    };
    try {
      if (editingId) {
        await placeService.update(editingId, payload);
      } else {
        await placeService.create({ ...payload, sort_order: places.length + 1 });
      }
      void ActivityLogService.logActivity({
        user_id: currentUser?.id,
        action_type: 'user_action',
        entity_type: 'system',
        description: `Admin ${editingId ? 'updated' : 'added'} popular place: ${name.trim()}.`,
        severity: 'success',
      });
      setModalVisible(false);
      load();
      notify(editingId ? 'Place updated' : 'Place added', `${name.trim()} is now ${active ? 'visible to passengers' : 'hidden'}.`);
    } catch (e: any) {
      notify('Save failed', e?.message || 'Could not save the place.');
    } finally {
      setSaving(false);
    }
  };

  const removePlace = async () => {
    if (!editingId) return;
    setModalVisible(false);
    await new Promise((r) => setTimeout(r, 300));
    const ok = await confirm('Delete Place', `Remove ${name.trim()} from popular places?`, {
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await placeService.remove(editingId);
      void ActivityLogService.logActivity({
        user_id: currentUser?.id,
        action_type: 'user_action',
        entity_type: 'system',
        description: `Admin removed popular place: ${name.trim()}.`,
        severity: 'warning',
      });
      load();
      notify('Place deleted', `${name.trim()} has been removed.`);
    } catch (e: any) {
      notify('Delete failed', e?.message || 'Could not delete the place.');
    }
  };

  if (loading) return <Loading message="Loading places..." />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Popular Places</Text>
          <Text style={styles.headerSubtitle}>What passengers see on Home</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openNew} activeOpacity={0.85} hitSlop={8}>
          <MaterialCommunityIcons name="plus" size={18} color="#fff" />
          <Text style={styles.addText}>Add Place</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {places.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="map-marker-plus-outline" size={52} color={colors.textLight} />
            <Text style={styles.emptyText}>No places yet — add the first one</Text>
          </View>
        )}

        {places.map((place) => (
          <TouchableOpacity key={place.id} style={styles.row} activeOpacity={0.8} onPress={() => openEdit(place)}>
            {place.image ? (
              <Image source={{ uri: place.image }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <MaterialCommunityIcons name={place.icon as any} size={24} color={colors.primary} />
              </View>
            )}
            <View style={styles.rowBody}>
              <Text style={styles.rowName} numberOfLines={1}>{place.name}</Text>
              <Text style={styles.rowAddress} numberOfLines={1}>{place.address || 'No address'}</Text>
              <View style={styles.rowMeta}>
                <View style={styles.catChip}>
                  <Text style={styles.catText}>{place.category}</Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: place.isActive !== false ? colors.success : colors.textLight }]} />
                  <Text style={styles.statusText}>{place.isActive !== false ? 'Visible' : 'Hidden'}</Text>
                </View>
              </View>
            </View>
            <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.textLight} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Add / edit form */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => !saving && setModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
              <Text style={styles.sheetTitle}>{editingId ? 'Edit Place' : 'New Place'}</Text>

              <TouchableOpacity style={styles.photoBox} activeOpacity={0.85} onPress={pickPhoto}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.photo} />
                ) : (
                  <View style={styles.photoEmpty}>
                    <MaterialCommunityIcons name="camera-plus-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.photoHint}>Upload photo</Text>
                  </View>
                )}
                <View style={styles.photoEditBadge}>
                  <MaterialCommunityIcons name="pencil" size={14} color="#fff" />
                </View>
              </TouchableOpacity>

              <Text style={styles.label}>NAME</Text>
              <RNTextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Boac Cathedral" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>ADDRESS</Text>
              <RNTextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="e.g. Poblacion, Boac" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>CATEGORY</Text>
              <View style={styles.catRow}>
                {CATEGORY_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c.label}
                    style={[styles.catOption, category === c.label && styles.catOptionActive]}
                    onPress={() => setCategory(c.label)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name={c.icon as any} size={14} color={category === c.label ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.catOptionText, category === c.label && { color: '#fff' }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.coordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>LATITUDE</Text>
                  <RNTextInput style={styles.input} value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" placeholder="13.4477" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>LONGITUDE</Text>
                  <RNTextInput style={styles.input} value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" placeholder="121.8389" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              <Text style={styles.label}>DETAILS (OPTIONAL)</Text>
              <RNTextInput
                style={[styles.input, styles.inputMultiline]}
                value={details}
                onChangeText={setDetails}
                placeholder="Landmark notes, opening hours, what's nearby…"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <View style={styles.activeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeTitle}>Visible to passengers</Text>
                  <Text style={styles.activeSub}>Turn off to hide without deleting.</Text>
                </View>
                <Switch value={active} onValueChange={setActive} color={colors.primary} />
              </View>

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
                <Text style={styles.saveText}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Place'}</Text>
              </TouchableOpacity>

              {editingId && (
                <TouchableOpacity style={styles.deleteBtn} onPress={removePlace} disabled={saving} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} />
                  <Text style={styles.deleteText}>Delete Place</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerTitle: { ...typography.h1, fontSize: 26 },
  headerSubtitle: { ...typography.body, color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.pill,
  },
  addText: { ...typography.label, color: '#fff', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl * 2, gap: spacing.md },
  emptyText: { ...typography.subtitle, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, marginRight: spacing.md },
  thumbFallback: { justifyContent: 'center', alignItems: 'center' },
  rowBody: { flex: 1 },
  rowName: { ...typography.subtitle, color: colors.text, fontSize: 15 },
  rowAddress: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 1 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  catChip: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  catText: { ...typography.labelSmall, fontSize: 10, color: colors.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...typography.bodySmall, fontSize: 11, color: colors.textSecondary },
  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { ...typography.h3, fontSize: 20, marginBottom: spacing.md },
  photoBox: { height: 150, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginBottom: spacing.md },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
  photoHint: { ...typography.bodySmall, color: colors.textMuted },
  photoEditBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted, letterSpacing: 1, marginBottom: 6, marginTop: spacing.sm },
  input: {
    ...typography.body,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 76, paddingTop: spacing.sm, textAlignVertical: 'top' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  catOptionActive: { backgroundColor: colors.primary },
  catOptionText: { ...typography.labelSmall, fontSize: 12, color: colors.textSecondary },
  coordRow: { flexDirection: 'row', gap: spacing.md },
  activeRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  activeTitle: { ...typography.label, fontSize: 15, color: colors.text },
  activeSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  saveBtn: { height: 52, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  saveText: { ...typography.button, color: '#fff', fontSize: 15 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, marginTop: spacing.sm },
  deleteText: { ...typography.button, color: colors.error, fontSize: 14 },
  cancelBtn: { height: 46, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xs },
  cancelText: { ...typography.button, color: colors.textSecondary, fontSize: 14 },
});

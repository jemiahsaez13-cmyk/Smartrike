import React, { useMemo, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MARINDUQUE_TOWNS, barangayLocation } from '@/config/marinduque';
import { Location, SavedAddress } from '@/models/types';
import { PopularPlace } from '@/config/constants';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

interface Props {
  visible: boolean;
  target: 'pickup' | 'dropoff';
  currentLocation: Location | null;
  savedAddresses: SavedAddress[];
  popularPlaces: PopularPlace[];
  onClose: () => void;
  onConfirm: (loc: Location) => void;
  // Resolve a saved address to coordinates (parent geocodes if it has no pin).
  resolveSaved: (addr: SavedAddress) => Promise<Location | null>;
  onSetOnMap: () => void;
}

interface Pending { loc: Location; label: string; icon: string; }

export const LocationChooser: React.FC<Props> = ({
  visible, target, currentLocation, savedAddresses, popularPlaces,
  onClose, onConfirm, resolveSaved, onSetOnMap,
}) => {
  const [townIdx, setTownIdx] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [resolving, setResolving] = useState(false);

  const town = townIdx != null ? MARINDUQUE_TOWNS[townIdx] : null;
  const filteredBarangays = useMemo(() => {
    if (!town) return [];
    const q = query.trim().toLowerCase();
    return q ? town.barangays.filter((b) => b.toLowerCase().includes(q)) : town.barangays;
  }, [town, query]);

  const reset = () => { setTownIdx(null); setQuery(''); setPending(null); };
  const close = () => { reset(); onClose(); };

  const confirm = () => {
    if (!pending) return;
    const loc = pending.loc;
    reset();
    onConfirm(loc);
  };

  const pickBarangay = (brgy: string) => {
    if (!town) return;
    const coord = barangayLocation(town, brgy);
    setPending({ loc: { ...coord, address: `${brgy}, ${town.name}, Marinduque` }, label: `${brgy}, ${town.name}`, icon: 'map-marker' });
    setTownIdx(null);
    setQuery('');
  };

  const pickCurrent = () => {
    if (!currentLocation) return;
    setPending({
      loc: { ...currentLocation, address: currentLocation.address || 'Current location' },
      label: 'Current location',
      icon: 'crosshairs-gps',
    });
  };

  const pickSaved = async (addr: SavedAddress) => {
    setResolving(true);
    try {
      const loc = await resolveSaved(addr);
      if (loc) setPending({ loc, label: addr.label, icon: 'star' });
    } finally {
      setResolving(false);
    }
  };

  const isSelected = (label: string) => pending?.label === label;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={close}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => (town ? (setTownIdx(null), setQuery('')) : close())} activeOpacity={0.7}>
            <MaterialCommunityIcons name={town ? 'arrow-left' : 'close'} size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {town ? town.name : target === 'pickup' ? 'Set pickup' : 'Set destination'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {town ? (
          <>
            <View style={styles.searchBox}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search barangay in ${town.name}`}
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
            </View>
            <ScrollView contentContainerStyle={styles.listPad} keyboardShouldPersistTaps="handled">
              {filteredBarangays.map((b) => (
                <TouchableOpacity key={b} style={styles.brgyRow} onPress={() => pickBarangay(b)} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.brgyText}>{b}</Text>
                </TouchableOpacity>
              ))}
              {filteredBarangays.length === 0 && <Text style={styles.emptyText}>No barangay found.</Text>}
            </ScrollView>
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.listPad} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={[styles.row, isSelected('Current location') && styles.rowActive]} onPress={pickCurrent} activeOpacity={0.7}>
              <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
                <MaterialCommunityIcons name="crosshairs-gps" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowLabel}>Use current location</Text>
                <Text style={styles.rowSub} numberOfLines={1}>{currentLocation?.address || 'Your GPS position'}</Text>
              </View>
              {isSelected('Current location') && <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />}
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={() => { reset(); onSetOnMap(); }} activeOpacity={0.7}>
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name="map-marker-radius" size={20} color={colors.text} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowLabel}>Set location on map</Text>
                <Text style={styles.rowSub}>Drop a pin yourself</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Choose by address</Text>
            {MARINDUQUE_TOWNS.map((t, i) => (
              <TouchableOpacity key={t.name} style={styles.row} onPress={() => { setTownIdx(i); setQuery(''); }} activeOpacity={0.7}>
                <View style={styles.rowIcon}>
                  <MaterialCommunityIcons name="city-variant-outline" size={20} color={colors.text} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowLabel}>{t.name}</Text>
                  <Text style={styles.rowSub}>{t.barangays.length} barangays</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
              </TouchableOpacity>
            ))}

            {savedAddresses.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Saved places</Text>
                {savedAddresses.map((a) => (
                  <TouchableOpacity key={a.id} style={[styles.row, isSelected(a.label) && styles.rowActive]} onPress={() => pickSaved(a)} activeOpacity={0.7}>
                    <View style={styles.rowIcon}>
                      <MaterialCommunityIcons name={a.label.toLowerCase().includes('work') ? 'briefcase-outline' : a.label.toLowerCase().includes('home') ? 'home-outline' : 'star-outline'} size={20} color={colors.text} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowLabel}>{a.label}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>{a.full_address}</Text>
                    </View>
                    {isSelected(a.label) && <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </>
            )}

            {popularPlaces.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Popular places</Text>
                {popularPlaces.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.row, isSelected(p.name) && styles.rowActive]}
                    onPress={() => setPending({ loc: { latitude: p.lat, longitude: p.lng, address: p.name }, label: p.name, icon: (p.icon as any) || 'map-marker' })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIcon}>
                      <MaterialCommunityIcons name={(p.icon as any) || 'map-marker-outline'} size={20} color={colors.text} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowLabel}>{p.name}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>{p.address}</Text>
                    </View>
                    {isSelected(p.name) && <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        )}

        {/* Bottom confirm bar */}
        <View style={styles.footer}>
          {pending ? (
            <View style={styles.pendingRow}>
              <MaterialCommunityIcons name={pending.icon as any} size={18} color={colors.primary} />
              <Text style={styles.pendingText} numberOfLines={1}>{pending.loc.address}</Text>
            </View>
          ) : (
            <Text style={styles.footerHint}>{resolving ? 'Locating…' : 'Pick a location above to continue'}</Text>
          )}
          <TouchableOpacity
            style={[styles.confirmBtn, (!pending || resolving) && styles.confirmBtnDisabled]}
            onPress={confirm}
            disabled={!pending || resolving}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="check" size={20} color="#fff" />
            <Text style={styles.confirmText}>Confirm {target === 'pickup' ? 'pickup' : 'destination'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingRight: spacing.screen, paddingTop: layout.headerTop,
    paddingBottom: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...typography.h3, fontSize: 18 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    paddingHorizontal: spacing.md, height: 48,
    marginHorizontal: spacing.screen, marginTop: spacing.md,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, fontSize: 15 },
  listPad: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight, borderRadius: radius.sm,
  },
  rowActive: { backgroundColor: colors.primaryLight, borderBottomColor: 'transparent' },
  rowIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  rowCopy: { flex: 1 },
  rowLabel: { ...typography.label, fontSize: 15 },
  rowSub: { ...typography.bodySmall, color: colors.textLight, marginTop: 2 },
  sectionTitle: {
    ...typography.labelSmall, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.xs, marginLeft: 2,
  },
  brgyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  brgyText: { ...typography.body, fontSize: 15, color: colors.text },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  footer: {
    paddingHorizontal: spacing.screen, paddingTop: spacing.md, paddingBottom: spacing.xl,
    borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.surface,
  },
  pendingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44,
  },
  pendingText: { flex: 1, ...typography.label, color: colors.text, fontSize: 14 },
  footerHint: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.sm, textAlign: 'center' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: radius.md, backgroundColor: colors.primary, ...shadows.md,
  },
  confirmBtnDisabled: { backgroundColor: colors.border, ...({ elevation: 0 } as any) },
  confirmText: { ...typography.button, color: '#fff', fontSize: 16 },
});

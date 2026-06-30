import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/controllers/hooks/useAuth';
import { AddressRepository } from '@/models/repositories/AddressRepository';
import { SavedAddress } from '@/models/types';
import { confirm, notify } from '@/utils/confirm';
import { Loading } from '@/views/components/common/Loading';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const addressRepo = new AddressRepository();

const labelIcon = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes('home')) return 'home-outline';
  if (l.includes('work') || l.includes('office')) return 'briefcase-outline';
  return 'map-marker-outline';
};

export const AddressBookScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setAddresses(await addressRepo.listByUser(user.id));
    } catch {
      notify('Could not load addresses', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Reload whenever the screen regains focus (e.g. returning from the form).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = async (item: SavedAddress) => {
    const ok = await confirm('Delete address', `Remove "${item.label}" from your saved addresses?`, {
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await addressRepo.remove(item.id);
      setAddresses((prev) => prev.filter((a) => a.id !== item.id));
    } catch {
      notify('Delete failed', 'Could not remove this address. Please try again.');
    }
  };

  const handleSetDefault = async (item: SavedAddress) => {
    if (item.is_default) return;
    try {
      await addressRepo.setDefault(item.id);
      load();
    } catch {
      notify('Update failed', 'Could not set the default address. Please try again.');
    }
  };

  if (loading) return <Loading message="Loading addresses..." />;

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>My Addresses</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {addresses.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="map-marker-plus-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No saved addresses yet</Text>
            <Text style={styles.emptyText}>Add your home, work, or any place you ride to often.</Text>
          </View>
        ) : (
          addresses.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.labelChip}>
                  <MaterialCommunityIcons name={labelIcon(item.label) as any} size={14} color={colors.primary} />
                  <Text style={styles.labelText}>{item.label}</Text>
                </View>
                {item.is_default && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                  </View>
                )}
              </View>

              {(item.recipient_name || item.recipient_phone) && (
                <Text style={styles.recipient}>
                  {item.recipient_name}
                  {item.recipient_name && item.recipient_phone ? '  •  ' : ''}
                  {item.recipient_phone}
                </Text>
              )}
              <Text style={styles.address}>{item.full_address}</Text>
              {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleSetDefault(item)} activeOpacity={0.7}>
                  <MaterialCommunityIcons
                    name={item.is_default ? 'star' : 'star-outline'}
                    size={18}
                    color={item.is_default ? colors.primary : colors.textSecondary}
                  />
                  <Text style={styles.actionText}>{item.is_default ? 'Default' : 'Set default'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => navigation.navigate('AddressForm', { address: item })}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} />
                  <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.navigate('AddressForm')}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={22} color="#fff" />
        <Text style={styles.addBtnText}>Add New Address</Text>
      </TouchableOpacity>
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
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, paddingBottom: 110 },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.xs },
  emptyTitle: { ...typography.h3, fontSize: 17, marginTop: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  labelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill,
  },
  labelText: { ...typography.labelSmall, color: colors.primary, fontWeight: '700' },
  defaultBadge: { backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  defaultBadgeText: { ...typography.labelSmall, color: '#fff', fontSize: 9, letterSpacing: 0.5, fontWeight: '800' },
  recipient: { ...typography.label, color: colors.text, fontSize: 14, marginBottom: 2 },
  address: { ...typography.body, color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  notes: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  cardActions: {
    flexDirection: 'row', gap: spacing.md, marginTop: spacing.md,
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { ...typography.labelSmall, color: colors.textSecondary, fontWeight: '600' },
  addBtn: {
    position: 'absolute', left: spacing.screen, right: spacing.screen, bottom: spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: radius.md, backgroundColor: colors.primary, ...shadows.lg,
  },
  addBtnText: { ...typography.button, color: '#fff', fontSize: 16 },
});

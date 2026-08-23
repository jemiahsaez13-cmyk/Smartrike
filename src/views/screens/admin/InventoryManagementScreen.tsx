import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { InventoryCategory, InventoryItem } from '@/models/entities/Association';
import { InventoryService } from '@/models/services/AssociationService';
import { notify } from '@/utils/confirm';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const service = new InventoryService();
const CATEGORIES: Array<{ key: InventoryCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'supplies', label: 'Supplies' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'safety', label: 'Safety' },
  { key: 'office', label: 'Office' },
  { key: 'other', label: 'Other' },
];

const statusLabel = (status: InventoryItem['status']) => status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const statusColor = (status: InventoryItem['status']) => {
  if (status === 'out_of_stock' || status === 'damaged') return { fg: colors.error, bg: colors.errorLight };
  if (status === 'low_stock') return { fg: '#8A5A00', bg: colors.warningLight };
  return { fg: colors.success, bg: colors.successLight };
};

export const InventoryManagementScreen = () => {
  const navigation = useNavigation<any>();
  const actor = useAppSelector((state) => state.auth.user);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<InventoryCategory | 'all'>('all');
  const [editing, setEditing] = useState<InventoryItem | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('supplies');
  const [quantity, setQuantity] = useState('0');
  const [issued, setIssued] = useState('0');
  const [threshold, setThreshold] = useState('5');
  const [notes, setNotes] = useState('');
  const [damaged, setDamaged] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await service.list());
    } catch (error) {
      console.error('Inventory load failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openForm = (item?: InventoryItem) => {
    setEditing(item || null);
    setItemName(item?.item_name || '');
    setCategory(item?.category || 'supplies');
    setQuantity(String(item?.quantity ?? 0));
    setIssued(String(item?.issued_quantity ?? 0));
    setThreshold(String(item?.low_stock_threshold ?? 5));
    setNotes(item?.notes || '');
    setDamaged(item?.status === 'damaged');
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await service.save({
        id: editing?.id,
        item_name: itemName,
        category,
        quantity: Number(quantity),
        issued_quantity: Number(issued),
        low_stock_threshold: Number(threshold),
        status: damaged ? 'damaged' : undefined,
        notes,
      }, actor?.id);
      setItems((previous) => {
        const exists = previous.some((item) => item.id === saved.id);
        return exists
          ? previous.map((item) => item.id === saved.id ? saved : item)
          : [saved, ...previous];
      });
      setEditing(undefined);
      await notify('Inventory updated', `${saved.item_name} now has ${saved.remaining_stock} remaining.`);
    } catch (error: any) {
      await notify('Unable to save item', error?.message || 'Check the inventory values and try again.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(
    () => filter === 'all' ? items : items.filter((item) => item.category === filter),
    [items, filter]
  );
  const totalRemaining = items.reduce((sum, item) => sum + item.remaining_stock, 0);
  const attentionCount = items.filter((item) => item.status !== 'in_stock').length;
  const previewRemaining = Math.max(0, (Number(quantity) || 0) - (Number(issued) || 0));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Association Inventory</Text>
          <Text style={styles.subtitle}>Supplies, equipment, and issued stock</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => openForm()} accessibilityLabel="Add inventory item" activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{items.length}</Text>
              <Text style={styles.summaryLabel}>Recorded items</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{totalRemaining}</Text>
              <Text style={styles.summaryLabel}>Units remaining</Text>
            </View>
            <View style={[styles.summaryCard, attentionCount > 0 && styles.summaryAttention]}>
              <Text style={styles.summaryValue}>{attentionCount}</Text>
              <Text style={styles.summaryLabel}>Need attention</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {CATEGORIES.map((item) => (
              <TouchableOpacity key={item.key} style={[styles.filterChip, filter === item.key && styles.filterChipActive]} onPress={() => setFilter(item.key)} activeOpacity={0.76}>
                <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filtered.map((item) => {
            const meta = statusColor(item.status);
            const percent = item.quantity > 0 ? Math.min(100, (item.remaining_stock / item.quantity) * 100) : 0;
            return (
              <TouchableOpacity key={item.id} style={styles.card} onPress={() => openForm(item)} activeOpacity={0.78} accessibilityLabel={`Edit ${item.item_name}`}>
                <View style={styles.cardTop}>
                  <View style={styles.itemIcon}>
                    <MaterialCommunityIcons name={item.category === 'safety' ? 'shield-check-outline' : item.category === 'equipment' ? 'tools' : 'package-variant-closed'} size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.item_name}</Text>
                    <Text style={styles.itemCategory}>{item.category} · updated {new Date(item.updated_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.fg }]}>{statusLabel(item.status)}</Text>
                  </View>
                </View>
                <View style={styles.stockGrid}>
                  <StockValue label="TOTAL" value={item.quantity} />
                  <StockValue label="ISSUED" value={item.issued_quantity} />
                  <StockValue label="REMAINING" value={item.remaining_stock} strong />
                </View>
                <View style={styles.stockTrack}><View style={[styles.stockFill, { width: `${percent}%`, backgroundColor: meta.fg }]} /></View>
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
              </TouchableOpacity>
            );
          })}

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="package-variant" size={44} color={colors.textLight} />
              <Text style={styles.emptyTitle}>No inventory items</Text>
              <Text style={styles.emptyText}>Tap + to record association property.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={editing !== undefined} transparent animationType="slide" onRequestClose={() => !saving && setEditing(undefined)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{editing ? 'Update inventory item' : 'Add inventory item'}</Text>
                <Text style={styles.sheetSubtitle}>Remaining stock is calculated automatically.</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setEditing(undefined)} disabled={saving} accessibilityLabel="Close form">
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Field label="Item name" value={itemName} onChangeText={setItemName} placeholder="e.g. Reflective safety vest" />
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryWrap}>
                {CATEGORIES.filter((item) => item.key !== 'all').map((item) => (
                  <TouchableOpacity key={item.key} style={[styles.categoryChoice, category === item.key && styles.categoryChoiceActive]} onPress={() => setCategory(item.key as InventoryCategory)} activeOpacity={0.76}>
                    <Text style={[styles.categoryText, category === item.key && styles.categoryTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}><Field label="Total quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Issued items" value={issued} onChangeText={setIssued} keyboardType="number-pad" /></View>
              </View>
              <Field label="Low-stock threshold" value={threshold} onChangeText={setThreshold} keyboardType="number-pad" />
              <View style={styles.remainingPreview}>
                <Text style={styles.remainingLabel}>Calculated remaining stock</Text>
                <Text style={styles.remainingValue}>{previewRemaining}</Text>
              </View>
              <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
              <TouchableOpacity style={styles.checkRow} onPress={() => setDamaged((value) => !value)} activeOpacity={0.76}>
                <MaterialCommunityIcons name={damaged ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={damaged ? colors.error : colors.textMuted} />
                <Text style={styles.checkText}>Mark this inventory item as damaged</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving} activeOpacity={0.82}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save inventory record</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const StockValue = ({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) => (
  <View style={styles.stockValue}>
    <Text style={styles.stockLabel}>{label}</Text>
    <Text style={[styles.stockNumber, strong && { color: colors.primary }]}>{value}</Text>
  </View>
);

const Field = ({ label, multiline = false, keyboardType, ...props }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput {...props} keyboardType={keyboardType} multiline={multiline} placeholderTextColor={colors.textMuted} style={[styles.input, multiline && styles.multiline]} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: layout.headerTop, paddingBottom: spacing.md, paddingHorizontal: spacing.sm, paddingRight: spacing.screen, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, fontSize: 22 },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  addBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primary },
  content: { padding: spacing.screen, paddingBottom: layout.contentBottom },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  summaryCard: { flex: 1, minHeight: 88, borderRadius: radius.lg, backgroundColor: colors.primary, padding: spacing.sm, justifyContent: 'center' },
  summaryAttention: { backgroundColor: colors.primaryDark },
  summaryValue: { ...typography.h2, color: '#fff', fontSize: 24 },
  summaryLabel: { ...typography.bodySmall, color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  filters: { gap: spacing.sm, paddingBottom: spacing.lg },
  filterChip: { height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', paddingHorizontal: spacing.md },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  filterTextActive: { color: '#fff' },
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  itemName: { ...typography.h3, fontSize: 16 },
  itemCategory: { ...typography.bodySmall, color: colors.textMuted, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  statusBadge: { minHeight: 28, borderRadius: radius.pill, justifyContent: 'center', paddingHorizontal: 9 },
  statusText: { ...typography.labelSmall, fontSize: 10 },
  stockGrid: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight },
  stockValue: { flex: 1 },
  stockLabel: { ...typography.labelSmall, color: colors.textMuted, fontSize: 9, letterSpacing: 0.7 },
  stockNumber: { ...typography.number, fontSize: 20, marginTop: 2 },
  stockTrack: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.md },
  stockFill: { height: '100%', borderRadius: radius.pill },
  notes: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.h3, marginTop: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  sheetTitle: { ...typography.h2, fontSize: 21 },
  sheetSubtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: spacing.md },
  fieldLabel: { ...typography.label, fontSize: 13, marginBottom: spacing.sm },
  input: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, ...typography.body, color: colors.text },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  categoryChoice: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, justifyContent: 'center' },
  categoryChoiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { ...typography.labelSmall, color: colors.textSecondary },
  categoryTextActive: { color: '#fff' },
  formRow: { flexDirection: 'row', gap: spacing.md },
  remainingPreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  remainingLabel: { ...typography.label, color: colors.primaryDark, fontSize: 13 },
  remainingValue: { ...typography.number, color: colors.primary, fontSize: 24 },
  checkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  checkText: { ...typography.body, color: colors.text, flex: 1 },
  saveBtn: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { ...typography.button, color: '#fff' },
});

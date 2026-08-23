import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { RidePaymentSubmission, RidePaymentStatus } from '@/models/entities/RidePayment';
import { RidePaymentService } from '@/models/services/RidePaymentService';
import { confirm, notify } from '@/utils/confirm';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

const service = new RidePaymentService();
const FILTERS: Array<'all' | RidePaymentStatus> = ['all', 'pending', 'verified', 'rejected'];

export const RidePaymentReviewList = ({ admin = false }: { admin?: boolean }) => {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);
  const [rows, setRows] = useState<RidePaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | RidePaymentStatus>('pending');
  const [proof, setProof] = useState<string>();
  const [reviewing, setReviewing] = useState<string>();

  const load = useCallback(async () => {
    if (!user?.id) return;
    try { setRows(admin ? await service.listAll() : await service.listForDriver(user.id)); }
    catch (error: any) { void notify('Could not load payments', error?.message || 'Please try again.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [admin, user?.id]);
  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load]));

  const review = async (row: RidePaymentSubmission, decision: 'verified' | 'rejected') => {
    let reason: string | undefined;
    if (decision === 'rejected') {
      const okay = await confirm('Reject payment proof?', 'The passenger may replace the proof and submit again. Use this only when the screenshot or reference is invalid.', { confirmText: 'Reject', destructive: true });
      if (!okay) return;
      reason = 'Payment proof or reference could not be validated';
    } else {
      const okay = await confirm('Verify payment?', `Confirm receipt of ₱${Number(row.amount).toFixed(2)} with reference ${row.payment_reference}.`, { confirmText: 'Verify Payment' });
      if (!okay) return;
    }
    setReviewing(row.id);
    try {
      const updated = await service.review(row.id, decision, reason);
      setRows((items) => items.map((item) => item.id === row.id ? { ...item, ...updated } : item));
      await notify(decision === 'verified' ? 'Payment verified' : 'Payment rejected', decision === 'verified' ? 'The booking is now marked paid for the passenger, driver, and admin.' : 'The passenger can submit corrected proof.');
    } catch (error: any) { await notify('Review failed', error?.message || 'This payment may already have been reviewed.'); }
    finally { setReviewing(undefined); }
  };
  const filtered = filter === 'all' ? rows : rows.filter((row) => row.status === filter);
  const statusColor = (status: RidePaymentStatus) => status === 'verified' ? colors.success : status === 'rejected' ? colors.error : colors.warning;

  return <View style={styles.container}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} /></TouchableOpacity><View style={styles.headerCopy}><Text style={styles.title}>{admin ? 'Ride Payments' : 'Payment Verification'}</Text><Text style={styles.subtitle}>Passenger proof and payment references</Text></View></View>
    <View style={styles.filters}>{FILTERS.map((item) => {
      const selected = filter === item;
      return <TouchableOpacity
        key={item}
        style={styles.filterTouch}
        onPress={() => setFilter(item)}
        activeOpacity={0.75}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
      >
        <View style={[styles.filter, selected && styles.filterActive]}>
          <Text numberOfLines={1} style={[styles.filterText, selected && styles.filterTextActive]}>{item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}</Text>
        </View>
      </TouchableOpacity>;
    })}</View>
    {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />}>
      {filtered.map((row) => <View key={row.id} style={styles.card}>
        <View style={styles.cardTop}><View style={styles.passenger}><MaterialCommunityIcons name="account-outline" size={21} color={colors.primary} /><View style={styles.passengerCopy}><Text style={styles.cardTitle}>{row.passenger_name || 'Passenger'}</Text><Text style={styles.date}>{new Date(row.submitted_at).toLocaleString()}</Text></View></View><View style={[styles.status, { backgroundColor: `${statusColor(row.status)}18` }]}><Text style={[styles.statusText, { color: statusColor(row.status) }]}>{row.status.toUpperCase()}</Text></View></View>
        <View style={styles.amountRow}><Text style={styles.amount}>₱{Number(row.amount).toFixed(2)}</Text><Text style={styles.method}>{row.payment_details_snapshot?.display_name || 'Online payment'}</Text></View>
        <View style={styles.detail}><Text style={styles.detailLabel}>REFERENCE</Text><Text selectable style={styles.reference}>{row.payment_reference}</Text></View>
        <TouchableOpacity style={styles.proofBtn} onPress={() => setProof(row.proof_url)}><MaterialCommunityIcons name="image-search-outline" size={19} color={colors.primary} /><Text style={styles.proofText}>View payment screenshot</Text></TouchableOpacity>
        {row.rejection_reason ? <Text style={styles.reason}>{row.rejection_reason}</Text> : null}
        {row.status === 'pending' && <View style={styles.actions}><TouchableOpacity style={styles.reject} onPress={() => review(row, 'rejected')} disabled={!!reviewing}><Text style={styles.rejectText}>Reject</Text></TouchableOpacity><TouchableOpacity style={styles.verify} onPress={() => review(row, 'verified')} disabled={!!reviewing}>{reviewing === row.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyText}>Verify Payment</Text>}</TouchableOpacity></View>}
      </View>)}
      {!filtered.length && <View style={styles.empty}><MaterialCommunityIcons name="receipt-text-clock-outline" size={44} color={colors.textLight} /><Text style={styles.emptyTitle}>No {filter === 'all' ? '' : filter} payments</Text><Text style={styles.emptyText}>Payment submissions will appear here after a passenger uploads proof.</Text></View>}
    </ScrollView>}
    <Modal visible={!!proof} transparent animationType="fade" onRequestClose={() => setProof(undefined)}><View style={styles.imageOverlay}><TouchableOpacity style={styles.imageClose} onPress={() => setProof(undefined)}><MaterialCommunityIcons name="close" size={26} color="#fff" /></TouchableOpacity>{proof && <Image source={{ uri: proof }} style={styles.proofImage} resizeMode="contain" />}</View></Modal>
  </View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', paddingTop: layout.headerTop, paddingBottom: spacing.md, paddingHorizontal: spacing.sm, paddingRight: spacing.screen, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, minWidth: 0 }, title: { ...typography.h2, fontSize: 21 }, subtitle: { ...typography.bodySmall, color: colors.textSecondary }, filters: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screen, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight }, filterTouch: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, filter: { width: '94%', height: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent', backgroundColor: 'transparent' }, filterActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary }, filterText: { ...typography.labelSmall, fontSize: 11, color: colors.textSecondary }, filterTextActive: { color: colors.primary, fontWeight: '700' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, paddingBottom: layout.contentBottom }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, passenger: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 }, passengerCopy: { flex: 1, minWidth: 0 }, cardTitle: { ...typography.h3, fontSize: 16 }, date: { ...typography.bodySmall, color: colors.textMuted }, status: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { ...typography.labelSmall, fontSize: 10 }, amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.md }, amount: { ...typography.h2, color: colors.primary }, method: { ...typography.label, color: colors.textSecondary }, detail: { marginTop: spacing.md, padding: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md }, detailLabel: { ...typography.labelSmall, color: colors.textMuted }, reference: { ...typography.label, color: colors.text, marginTop: 3 }, proofBtn: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, proofText: { ...typography.label, color: colors.primary }, reason: { ...typography.bodySmall, color: colors.error, padding: spacing.sm, backgroundColor: colors.errorLight, borderRadius: radius.sm }, actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }, reject: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.error, borderRadius: radius.md }, rejectText: { ...typography.button, color: colors.error }, verify: { flex: 2, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md }, verifyText: { ...typography.button, color: '#fff' }, empty: { alignItems: 'center', paddingVertical: 70 }, emptyTitle: { ...typography.h3, marginTop: spacing.md }, emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }, imageOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: spacing.lg }, imageClose: { position: 'absolute', top: layout.headerTop, right: spacing.lg, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', zIndex: 2 }, proofImage: { width: '100%', height: '82%' },
});

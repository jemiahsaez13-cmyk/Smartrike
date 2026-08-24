import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { TransactionRepository } from '@/models/repositories/TransactionRepository';
import { Transaction } from '@/models/types';
import { Card } from '@/views/components/common/Card';
import { Loading } from '@/views/components/common/Loading';
import { colors, gradients, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';
import { formatDate, formatTime } from '@/utils/dateUtils';

const METHOD_META: Record<string, { icon: string; label: string; color: string }> = {
  cash: { icon: 'cash', label: 'Cash', color: colors.secondary },
  online: { icon: 'credit-card-check-outline', label: 'Online', color: colors.info },
  gcash: { icon: 'cellphone', label: 'GCash', color: colors.accent },
  paymaya: { icon: 'credit-card', label: 'PayMaya', color: colors.warning },
};

const STATUS_META = {
  completed: { label: 'PAID', color: colors.success, background: colors.successLight },
  pending: { label: 'PENDING', color: colors.warning, background: colors.warningLight },
  failed: { label: 'FAILED', color: colors.error, background: colors.errorLight },
};

export const PaymentScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setTransactions(await new TransactionRepository().findByPassenger(user.id, 50));
    } catch (loadError: any) {
      setTransactions([]);
      setError(loadError?.message || 'Your payment history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void loadHistory(); }, [loadHistory]));

  const completed = transactions.filter((item) => item.status === 'completed');
  const totalSpent = completed.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  if (loading) return <Loading message="Loading payment history..." />;

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <LinearGradient colors={gradients.brand} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment History</Text>

          <Card variant="elevated" padding="lg" style={styles.totalCard}>
            <Text style={styles.totalLabel}>TOTAL PAID</Text>
            <Text style={[styles.totalValue, typography.currency]}>₱{totalSpent.toFixed(2)}</Text>
            <Text style={styles.totalSub}>
              {completed.length} completed payment{completed.length !== 1 ? 's' : ''}
            </Text>
          </Card>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              This list contains your recorded trip payments. Payment accounts are configured by drivers, not passengers.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>RECENT PAYMENTS</Text>

          {error ? (
            <Card variant="outlined" padding="lg" style={styles.emptyCard}>
              <MaterialCommunityIcons name="alert-circle-outline" size={42} color={colors.error} />
              <Text style={styles.emptyTitle}>Could not load payments</Text>
              <Text style={styles.emptyText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => void loadHistory()}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </Card>
          ) : transactions.length === 0 ? (
            <Card variant="elevated" padding="xl" style={styles.emptyCard}>
              <MaterialCommunityIcons name="receipt-text-clock-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyTitle}>No payments yet</Text>
              <Text style={styles.emptyText}>Completed trip payments will appear here.</Text>
            </Card>
          ) : (
            transactions.map((transaction) => {
              const method = METHOD_META[transaction.payment_method] || METHOD_META.cash;
              const status = STATUS_META[transaction.status];
              const paidAt = transaction.completed_at || transaction.created_at;
              return (
                <Card key={transaction.id} variant="elevated" padding="md" style={styles.txCard}>
                  <View style={styles.txRow}>
                    <View style={[styles.txIcon, { backgroundColor: `${method.color}18` }]}>
                      <MaterialCommunityIcons name={method.icon as any} size={21} color={method.color} />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txTitle}>{method.label} trip payment</Text>
                      <Text style={styles.txMeta}>{formatDate(paidAt)} · {formatTime(paidAt)}</Text>
                      {transaction.notes ? <Text style={styles.txReference} numberOfLines={2}>{transaction.notes}</Text> : null}
                    </View>
                    <View style={styles.txAmountCol}>
                      <Text style={[styles.txAmount, typography.currency]}>₱{Number(transaction.amount || 0).toFixed(2)}</Text>
                      <View style={[styles.txStatusBadge, { backgroundColor: status.background }]}>
                        <Text style={[styles.txStatusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: layout.headerTop, paddingHorizontal: spacing.screen, paddingBottom: 80 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  headerTitle: { ...typography.h1, color: '#fff', fontSize: 28, marginBottom: spacing.lg },
  totalCard: { marginBottom: -48, ...shadows.xl },
  totalLabel: { ...typography.label, color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: spacing.xs },
  totalValue: { ...typography.h1, color: colors.text, fontSize: 36, marginBottom: spacing.xs },
  totalSub: { ...typography.bodySmall, color: colors.textSecondary },
  body: { paddingHorizontal: spacing.screen, paddingTop: 64, paddingBottom: 48 },
  infoCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, alignItems: 'flex-start' },
  infoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 19 },
  sectionLabel: { ...typography.label, color: colors.textMuted, fontSize: 11, letterSpacing: 1.2, marginBottom: spacing.md, marginTop: spacing.xl, marginLeft: spacing.xs },
  emptyCard: { alignItems: 'center' },
  emptyTitle: { ...typography.h3, marginTop: spacing.md, textAlign: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  retryBtn: { minHeight: 48, minWidth: 128, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primary, marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  retryText: { ...typography.button, color: '#fff' },
  txCard: { marginBottom: spacing.sm },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  txIcon: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1, minWidth: 0 },
  txTitle: { ...typography.subtitle, color: colors.text, fontSize: 14 },
  txMeta: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  txReference: { ...typography.bodySmall, color: colors.textMuted, fontSize: 11, marginTop: 3 },
  txAmountCol: { alignItems: 'flex-end', gap: spacing.xs, flexShrink: 0 },
  txAmount: { ...typography.label, color: colors.text, fontSize: 16 },
  txStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  txStatusText: { ...typography.labelSmall, fontSize: 9, letterSpacing: 0.5 },
});

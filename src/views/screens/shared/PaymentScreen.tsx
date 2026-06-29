import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Booking } from '@/models/types';
import { Card } from '@/views/components/common/Card';
import { Loading } from '@/views/components/common/Loading';
import { colors, gradients, radius, shadows, spacing, typography } from '@/views/styles/theme';
import { formatDate, formatTime } from '@/utils/dateUtils';
import { notify } from '@/utils/confirm';
import { PAYMENT_METHODS } from '@/config/constants';

const METHOD_META: Record<string, { icon: string; label: string; color: string }> = {
  cash: { icon: 'cash', label: 'Cash', color: colors.secondary },
  gcash: { icon: 'cellphone', label: 'GCash', color: colors.accent },
  paymaya: { icon: 'credit-card', label: 'PayMaya', color: colors.warning },
};

export const PaymentScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAppSelector(state => state.auth);

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Booking[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('cash');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 30, friction: 8, useNativeDriver: true }),
    ]).start();

    if (user?.id) loadHistory();
  }, [user?.id]);

  const loadHistory = async () => {
    if (!user?.id) return;
    setLoading(false);
    try {
      const repo = new BookingRepository();
      const data = await repo.findByPassenger(user.id, 30);
      setTransactions(data.filter(b => b.status === 'completed'));
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const totalSpent = transactions.reduce((s, t) => s + (t.total_fare ?? 0), 0);

  const handleSetDefault = (method: string) => {
    setSelectedMethod(method);
    void notify('Payment Method Updated', `${METHOD_META[method]?.label} set as your default payment method.`);
  };

  if (loading) return <Loading message="Loading payment info..." />;

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <LinearGradient colors={gradients.brand} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>

          <Card variant="elevated" padding="lg" style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Spent</Text>
            <Text style={[styles.totalValue, typography.currency]}>₱{totalSpent.toFixed(2)}</Text>
            <Text style={styles.totalSub}>{transactions.length} completed trip{transactions.length !== 1 ? 's' : ''}</Text>
          </Card>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Payment methods */}
          <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
          <View style={styles.methodGrid}>
            {PAYMENT_METHODS.map(method => {
              const meta = METHOD_META[method];
              const isSelected = selectedMethod === method;
              return (
                <TouchableOpacity
                  key={method}
                  style={[styles.methodCard, isSelected && styles.methodCardActive]}
                  onPress={() => handleSetDefault(method)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.methodIcon, { backgroundColor: meta.color + '18' }]}>
                    <MaterialCommunityIcons name={meta.icon as any} size={24} color={meta.color} />
                  </View>
                  <Text style={[styles.methodLabel, isSelected && styles.methodLabelActive]}>{meta.label}</Text>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <MaterialCommunityIcons name="check" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={18} color={colors.accent} />
            <Text style={styles.infoText}>
              Smart Trike accepts cash payments and digital wallets. All transactions are secured and recorded.
            </Text>
          </View>

          {/* Transaction history */}
          <Text style={styles.sectionLabel}>TRANSACTION HISTORY</Text>

          {transactions.length === 0 ? (
            <Card variant="elevated" padding="xl" style={styles.emptyCard}>
              <MaterialCommunityIcons name="receipt" size={48} color={colors.textLight} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </Card>
          ) : (
            transactions.map((trip, idx) => (
              <Card key={trip.id ?? idx} variant="elevated" padding="md" style={styles.txCard}>
                <View style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: colors.successLight }]}>
                    <MaterialCommunityIcons name="cash-check" size={20} color={colors.secondary} />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      Trip to {trip.dropoff_location?.address ?? 'Destination'}
                    </Text>
                    <Text style={styles.txMeta}>
                      {trip.completed_at ? `${formatDate(trip.completed_at)} · ${formatTime(trip.completed_at)}` : 'N/A'}
                    </Text>
                    <View style={styles.txMethodRow}>
                      <MaterialCommunityIcons
                        name={(METHOD_META[trip.payment_method ?? 'cash']?.icon ?? 'cash') as any}
                        size={12}
                        color={colors.textMuted}
                      />
                      <Text style={styles.txMethodText}>
                        {METHOD_META[trip.payment_method ?? 'cash']?.label ?? 'Cash'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.txAmountCol}>
                    <Text style={[styles.txAmount, typography.currency]}>
                      ₱{(trip.total_fare ?? 0).toFixed(2)}
                    </Text>
                    <View style={styles.txStatusBadge}>
                      <Text style={styles.txStatusText}>PAID</Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 52,
    paddingHorizontal: spacing.screen,
    paddingBottom: 80,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: { ...typography.h1, color: '#fff', fontSize: 28, marginBottom: 24 },
  totalCard: { marginBottom: -48, ...shadows.xl },
  totalLabel: { ...typography.label, color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  totalValue: { ...typography.h1, color: colors.text, fontSize: 36, marginBottom: 4 },
  totalSub: { ...typography.bodySmall, color: colors.textSecondary },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: 64,
    paddingBottom: 48,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 16,
    marginTop: 28,
    marginLeft: 4,
  },
  methodGrid: { flexDirection: 'row', gap: 12 },
  methodCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 10,
    position: 'relative',
    ...shadows.sm,
  },
  methodCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodLabel: { ...typography.label, color: colors.textSecondary, fontSize: 13 },
  methodLabelActive: { color: colors.primary },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.infoLight,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    alignItems: 'flex-start',
  },
  infoText: { ...typography.bodySmall, color: colors.accent, flex: 1, lineHeight: 18 },
  emptyCard: { alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },
  txCard: { marginBottom: 10 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: { flex: 1 },
  txTitle: { ...typography.subtitle, color: colors.text, fontSize: 14 },
  txMeta: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  txMethodRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  txMethodText: { ...typography.bodySmall, color: colors.textMuted, fontSize: 11 },
  txAmountCol: { alignItems: 'flex-end', gap: 6 },
  txAmount: { ...typography.label, color: colors.text, fontSize: 16 },
  txStatusBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  txStatusText: { ...typography.label, color: colors.secondary, fontSize: 9, letterSpacing: 0.5 },
});

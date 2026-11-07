/**
 * MtopPaymentRecords — C1: the driver's MTOP billing statements and payments,
 * read-only (statement no., amount, billed / due / paid dates, status, OR no.).
 * Payments are recorded by the office (B2, migration 086); nothing to submit here.
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { FranchiseService, MtopBillingRecord } from '@/models/services/FranchiseService';
import {
  MTOP_BILLING_STATE_LABEL,
  MtopBillingState,
  mtopBilledAt,
  mtopBillingState,
  mtopDueDate,
  mtopPaidMethodLabel,
} from '@/models/entities/Franchise';
import { Card } from '@/views/components/common/Card';
import { colors, spacing, typography } from '@/views/styles/theme';

const service = new FranchiseService();

const STATE_COLOR: Record<MtopBillingState, string> = {
  to_bill: colors.textMuted,
  unpaid: colors.warning,
  overdue: colors.error,
  for_verification: colors.primary,
  paid: colors.success,
};

const STATE_ICON: Record<MtopBillingState, string> = {
  to_bill: 'file-clock-outline',
  unpaid: 'cash-clock',
  overdue: 'cash-remove',
  for_verification: 'clock-outline',
  paid: 'check-circle',
};

const peso = (n: number) => `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (iso?: string | null) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

interface Props {
  driverId: string;
  /** Changes when the current application changes, so the list reloads live. */
  refreshKey?: string;
}

export const MtopPaymentRecords = ({ driverId, refreshKey }: Props) => {
  const [records, setRecords] = useState<MtopBillingRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      service.getBillingRecords(driverId)
        .then((rows) => { if (active) { setRecords(rows); setFailed(false); } })
        .catch(() => { if (active) setFailed(true); });
      return () => { active = false; };
    }, [driverId, refreshKey])
  );

  // Nothing to show (or it could not load): no empty section on the screen.
  if ((failed && !records) || records?.length === 0) return null;

  return (
    <>
      <Text style={styles.sectionTitle}>PAYMENT RECORDS</Text>
      <Card variant="outlined" padding="none" style={styles.card}>
        {!records ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          records.map((row, idx) => {
            const full = row as unknown as Parameters<typeof mtopBillingState>[0];
            const state = mtopBillingState(full);
            const color = STATE_COLOR[state];
            const paid = state === 'paid';
            const paidOn = row.payment_paid_on ?? row.payment_verified_at;
            const method = mtopPaidMethodLabel({
              payment_method: row.payment_method,
              chosen_payment_method_snapshot: row.paid_method ? ({ display_name: row.paid_method } as any) : null,
              appointment_date: null,
            });
            const billedAt = mtopBilledAt(full);
            return (
              <View key={row.id} style={[styles.row, idx === records.length - 1 && { borderBottomWidth: 0 }]}>
                <MaterialCommunityIcons name={STATE_ICON[state] as any} size={18} color={color} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.type === 'renewal' ? 'MTOP Renewal' : 'New MTOP'} · {peso(paid ? row.payment_amount ?? row.fees : row.fees)}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {row.billing_statement_no ? `${row.billing_statement_no} · ` : ''}
                    {paid
                      ? `Paid ${shortDate(paidOn)}${method ? ` · ${method}` : ''}`
                      : billedAt
                      ? `Billed ${shortDate(billedAt)} · Due ${shortDate(mtopDueDate(full))}`
                      : 'Billing not sent yet'}
                  </Text>
                  {paid && row.payment_reference ? (
                    <Text selectable style={styles.rowRef}>OR / Ref. {row.payment_reference}</Text>
                  ) : null}
                </View>
                <Text style={[styles.status, { color }]}>{MTOP_BILLING_STATE_LABEL[state]}</Text>
              </View>
            );
          })
        )}
      </Card>
    </>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  card: { overflow: 'hidden', marginBottom: spacing.xl },
  loading: { padding: spacing.md, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.label, fontSize: 13, color: colors.text },
  rowSub: { ...typography.bodySmall, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  rowRef: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  status: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

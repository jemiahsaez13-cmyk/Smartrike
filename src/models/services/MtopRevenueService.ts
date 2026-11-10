/**
 * MTOP revenue (B8): the fees the office has actually collected. One item per
 * paid MTOP billing, labeled with what it was paid for. Feeds the Command
 * Center "Total Revenue", the Revenue details screen and the MTOP income graph.
 */
import { FranchiseService, MtopBillingRecord } from '@/models/services/FranchiseService';
import { mtopBillingState, mtopPaidMethodLabel } from '@/models/entities/Franchise';

export type MtopRevenuePurpose = 'new' | 'renewal';

export const MTOP_REVENUE_PURPOSE_LABEL: Record<MtopRevenuePurpose, string> = {
  new: 'MTOP Registration',
  renewal: 'MTOP Renewal',
};

export interface MtopRevenueItem {
  id: string;
  /** Paid date (YYYY-MM-DD when recorded by the office, else an ISO instant). */
  at: string;
  amount: number;
  purpose: MtopRevenuePurpose;
  purposeLabel: string;
  driverName: string;
  toda: string;
  mtopNumber: string | null;
  plateNumber: string;
  statementNo: string | null;
  method: string | null;
  reference: string | null;
}

/** A paid billing record as revenue; null while it is not paid yet. */
export const toMtopRevenue = (row: MtopBillingRecord): MtopRevenueItem | null => {
  if (mtopBillingState(row as unknown as Parameters<typeof mtopBillingState>[0]) !== 'paid') return null;
  const purpose: MtopRevenuePurpose = row.type === 'renewal' ? 'renewal' : 'new';
  return {
    id: row.id,
    at: row.payment_paid_on ?? row.payment_verified_at ?? row.updated_at ?? row.created_at,
    amount: row.payment_amount ?? row.fees,
    purpose,
    purposeLabel: MTOP_REVENUE_PURPOSE_LABEL[purpose],
    driverName: row.driver_name,
    toda: row.toda || 'No TODA',
    mtopNumber: row.mtop_number,
    plateNumber: row.plate_number,
    statementNo: row.billing_statement_no,
    method: mtopPaidMethodLabel({
      payment_method: row.payment_method,
      chosen_payment_method_snapshot: row.paid_method ? ({ display_name: row.paid_method } as any) : null,
      appointment_date: row.appointment_date,
    }),
    reference: row.payment_reference,
  };
};

/** Sort key that puts plain dates and timestamps on one timeline. */
export const revenueTime = (at: string): number =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(at) ? `${at}T00:00:00+08:00` : at).getTime();

const franchiseService = new FranchiseService();

export const MtopRevenueService = {
  /** Every paid MTOP fee, newest first. */
  async getRevenue(): Promise<MtopRevenueItem[]> {
    const records = await franchiseService.getBillingRecords();
    return records
      .map(toMtopRevenue)
      .filter((item): item is MtopRevenueItem => item !== null)
      .sort((a, b) => revenueTime(b.at) - revenueTime(a.at));
  },

  total(items: MtopRevenueItem[]): number {
    return items.reduce((sum, item) => sum + item.amount, 0);
  },
};

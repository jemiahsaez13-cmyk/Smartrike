import {
  FranchiseApplication,
  FranchiseEvent,
  FranchiseRecordStatus,
  FRANCHISE_RECORD_STATUS_LABEL,
} from '@/models/entities/Franchise';
import {
  ManagementReportDataset,
  ManagementReportFilters,
  ManagementReportRow,
} from '@/models/entities/Association';
import { FranchiseService } from './FranchiseService';
import { InventoryService, ViolationService } from './AssociationService';

const franchiseService = new FranchiseService();
const inventoryService = new InventoryService();
const violationService = new ViolationService();

const TITLES = {
  franchise_status: 'Franchise Status Report',
  active_franchises: 'Active Franchise Report',
  renewals: 'Renewal Report',
  transfers: 'Transfer Report',
  terminations: 'Termination Report',
  violations: 'Driver Violation Report',
  inventory: 'Association Inventory Report',
} as const;

const emptyCounts = (): Record<FranchiseRecordStatus, number> => ({
  active: 0,
  expired: 0,
  pending_renewal: 0,
  terminated: 0,
  transferred: 0,
});

const inDateRange = (date: string, from?: string, to?: string): boolean => {
  const value = new Date(date).getTime();
  if (Number.isNaN(value)) return false;
  if (from && value < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && value > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
};

export class ManagementReportService {
  async generate(filters: ManagementReportFilters): Promise<ManagementReportDataset> {
    for (const value of [filters.dateFrom, filters.dateTo]) {
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00`).getTime()))) {
        throw new Error('Report dates must use YYYY-MM-DD.');
      }
    }
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      throw new Error('The report start date must be before the end date.');
    }
    const [franchises, events, inventory, violations] = await Promise.all([
      franchiseService.getRegistry(),
      franchiseService.getEvents(),
      inventoryService.list(),
      violationService.list(),
    ]);

    const counts = emptyCounts();
    franchises.forEach((row) => {
      const status = row.franchise_status ?? 'active';
      counts[status] += 1;
    });
    const currentYear = new Date().getFullYear();
    const renewedThisYear = events.filter((event) =>
      event.event_type === 'renewal' && new Date(event.effective_date).getFullYear() === currentYear
    ).length;
    const byId = new Map(franchises.map((row) => [row.id, row]));
    let rows: ManagementReportRow[] = [];

    if (filters.type === 'franchise_status' || filters.type === 'active_franchises') {
      const wanted = filters.type === 'active_franchises' ? 'active' : filters.franchiseStatus;
      rows = franchises
        .filter((row) => !wanted || wanted === 'all' || row.franchise_status === wanted)
        .map((row) => this.franchiseRow(row));
    } else if (filters.type === 'renewals') {
      rows = events
        .filter((event) => event.event_type === 'renewal')
        .map((event) => this.eventRow(event, byId.get(event.franchise_id)));
    } else if (filters.type === 'transfers') {
      rows = events
        .filter((event) => event.event_type === 'succession_transfer' || event.event_type === 'third_party_transfer')
        .map((event) => this.eventRow(event, byId.get(event.franchise_id)));
    } else if (filters.type === 'terminations') {
      rows = events
        .filter((event) => event.event_type === 'termination')
        .map((event) => this.eventRow(event, byId.get(event.franchise_id)));
    } else if (filters.type === 'violations') {
      rows = violations.map((violation) => ({
        id: violation.id,
        title: violation.driver_name || 'Driver',
        subtitle: violation.violation_type,
        status: violation.status,
        date: violation.incident_date,
        details: [violation.description, violation.penalty && `Penalty: ${violation.penalty}`].filter(Boolean).join(' • '),
      }));
    } else if (filters.type === 'inventory') {
      rows = inventory
        .filter((item) => !filters.category || filters.category === 'all' || item.category === filters.category)
        .map((item) => ({
          id: item.id,
          title: item.item_name,
          subtitle: `${item.issued_quantity} issued • ${item.remaining_stock} remaining of ${item.quantity}`,
          status: item.status,
          date: item.updated_at,
          category: item.category,
          details: item.notes || undefined,
        }));
    }

    rows = rows.filter((row) => inDateRange(row.date, filters.dateFrom, filters.dateTo));
    return {
      title: TITLES[filters.type],
      rows,
      activeFranchises: counts.active,
      renewedThisYear,
      statusCounts: counts,
    };
  }

  private franchiseRow(row: FranchiseApplication): ManagementReportRow {
    const status = row.franchise_status ?? 'active';
    return {
      id: row.id,
      title: row.current_holder_name || row.driver_name,
      subtitle: `${row.mtop_number || 'No MTOP'} • Body ${row.body_number || 'unassigned'} • ${row.plate_number}`,
      status: FRANCHISE_RECORD_STATUS_LABEL[status],
      date: row.last_renewed_at || row.issued_at || row.updated_at,
      details: row.expiry_date ? `Expires ${row.expiry_date}` : undefined,
    };
  }

  private eventRow(event: FranchiseEvent, franchise?: FranchiseApplication): ManagementReportRow {
    const transfer = event.event_type.includes('transfer');
    return {
      id: event.id,
      title: franchise?.mtop_number || 'Franchise record',
      subtitle: transfer
        ? `${event.from_holder || 'Previous holder'} → ${event.to_holder || 'New holder'}`
        : event.event_type === 'renewal'
        ? `Renewed for ${franchise?.current_holder_name || franchise?.driver_name || 'holder'}`
        : `Terminated: ${event.reason || 'No reason recorded'}`,
      status: event.event_type.replace(/_/g, ' '),
      date: event.effective_date,
      details: event.relationship?.replace(/_/g, ' ') || event.agreement_number || undefined,
    };
  }
}

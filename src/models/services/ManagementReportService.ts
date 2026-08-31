import { supabase } from '@/config/supabase';
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

const TITLES: Record<ManagementReportFilters['type'], string> = {
  // ── Existing ──
  franchise_status:    'Franchise Status Report',
  active_franchises:   'Active Franchise Report',
  renewals:            'Renewal Report',
  transfers:           'Transfer Report',
  terminations:        'Termination Report',
  violations:          'Driver Violation Report',
  inventory:           'Association Inventory Report',
  // ── Module 16 ──
  booking_records:      'Booking Records',
  trip_records:         'Trip Records (Completed)',
  monitoring_logs:      'Monitoring / Activity Logs',
  registered_tricycles: 'Registered Tricycle Report',
  toda_membership:      'TODA Membership Report',
  renewal_due_dates:    'Tricycle Renewal Due-Date Report',
  due_within_30_days:   '30-Day Due Date Report',
  assignment_records:   'Assignment Records',
  operator_registration:'Operator / Driver Registration Report',
  toda_association:     'TODA Association Report',
};

const emptyCounts = (): Record<FranchiseRecordStatus, number> => ({
  active: 0, expired: 0, pending_renewal: 0, terminated: 0, transferred: 0,
});

const inDateRange = (date: string, from?: string, to?: string): boolean => {
  const value = new Date(date).getTime();
  if (Number.isNaN(value)) return false;
  if (from && value < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to   && value > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
};

const addr = (loc: any): string =>
  loc && typeof loc === 'object' ? loc.address || 'Unknown' : 'Unknown';

export class ManagementReportService {
  async generate(filters: ManagementReportFilters): Promise<ManagementReportDataset> {
    // ── Validate dates ──────────────────────────────────────────────────────
    for (const value of [filters.dateFrom, filters.dateTo]) {
      if (
        value &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(new Date(`${value}T00:00:00`).getTime()))
      ) {
        throw new Error('Report dates must use YYYY-MM-DD.');
      }
    }
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      throw new Error('The report start date must be before the end date.');
    }

    const type = filters.type;

    // ── Route to correct handler ────────────────────────────────────────────
    if (type === 'booking_records' || type === 'trip_records') {
      return this._bookingReport(filters);
    }
    if (type === 'monitoring_logs') {
      return this._monitoringLogsReport(filters);
    }
    if (type === 'registered_tricycles') {
      return this._registeredTricyclesReport(filters);
    }
    if (type === 'toda_membership') {
      return this._todaMembershipReport(filters);
    }
    if (type === 'renewal_due_dates' || type === 'due_within_30_days') {
      return this._renewalDueDateReport(filters);
    }
    if (type === 'assignment_records') {
      return this._assignmentRecordsReport(filters);
    }
    if (type === 'operator_registration') {
      return this._operatorRegistrationReport(filters);
    }
    if (type === 'toda_association') {
      return this._todaAssociationReport(filters);
    }

    // ── Existing types ──────────────────────────────────────────────────────
    const [franchises, events, inventory, violations] = await Promise.all([
      franchiseService.getRegistry(),
      franchiseService.getEvents(),
      type === 'inventory'   ? inventoryService.list()  : Promise.resolve([]),
      type === 'violations'  ? violationService.list()  : Promise.resolve([]),
    ]);

    const counts = emptyCounts();
    franchises.forEach((row) => {
      const status = row.franchise_status ?? 'active';
      counts[status] += 1;
    });
    const currentYear = new Date().getFullYear();
    const renewedThisYear = events.filter(
      (e) => e.event_type === 'renewal' &&
             new Date(e.effective_date).getFullYear() === currentYear
    ).length;
    const byId = new Map(franchises.map((row) => [row.id, row]));
    let rows: ManagementReportRow[] = [];

    if (type === 'franchise_status' || type === 'active_franchises') {
      const wanted = type === 'active_franchises' ? 'active' : filters.franchiseStatus;
      rows = franchises
        .filter((row) => !wanted || wanted === 'all' || row.franchise_status === wanted)
        .map((row) => this._franchiseRow(row));
    } else if (type === 'renewals') {
      rows = events
        .filter((e) => e.event_type === 'renewal')
        .map((e) => this._eventRow(e, byId.get(e.franchise_id)));
    } else if (type === 'transfers') {
      rows = events
        .filter((e) => e.event_type === 'succession_transfer' || e.event_type === 'third_party_transfer')
        .map((e) => this._eventRow(e, byId.get(e.franchise_id)));
    } else if (type === 'terminations') {
      rows = events
        .filter((e) => e.event_type === 'termination')
        .map((e) => this._eventRow(e, byId.get(e.franchise_id)));
    } else if (type === 'violations') {
      rows = violations.map((v) => ({
        id: v.id,
        title: v.driver_name || 'Driver',
        subtitle: v.violation_type,
        status: v.status,
        date: v.incident_date,
        details: [v.description, v.penalty && `Penalty: ${v.penalty}`].filter(Boolean).join(' • '),
      }));
    } else if (type === 'inventory') {
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
      title: TITLES[type],
      rows,
      activeFranchises: counts.active,
      renewedThisYear,
      statusCounts: counts,
    };
  }

  // ── Module 16: Booking Records / Trip Records ────────────────────────────
  private async _bookingReport(filters: ManagementReportFilters): Promise<ManagementReportDataset> {
    let query = supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (filters.type === 'trip_records') {
      query = query.eq('status', 'completed');
    } else if (filters.bookingStatus && filters.bookingStatus !== 'all') {
      query = query.eq('status', filters.bookingStatus);
    }

    const { data, error } = await query;
    if (error) throw error;
    const bookings = (data ?? []) as any[];

    // Resolve names
    const userIds = [...new Set([
      ...bookings.map((b) => b.passenger_id),
      ...bookings.map((b) => b.driver_id).filter(Boolean),
    ])] as string[];
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
      (users ?? []).forEach((u: any) => names.set(u.id, u.name));
    }

    let rows: ManagementReportRow[] = bookings.map((b) => ({
      id: b.id,
      title: names.get(b.passenger_id) ?? 'Passenger',
      subtitle: `${addr(b.pickup_location)} → ${addr(b.dropoff_location)}`,
      status: b.status,
      date: b.created_at,
      details: [
        b.driver_id ? `Driver: ${names.get(b.driver_id) ?? 'Driver'}` : 'No driver assigned',
        `₱${Number(b.total_fare).toFixed(2)}`,
        `${b.passenger_count} pax`,
        b.payment_method?.toUpperCase(),
      ].filter(Boolean).join(' · '),
    }));

    rows = rows.filter((r) => inDateRange(r.date, filters.dateFrom, filters.dateTo));
    return { title: TITLES[filters.type], rows, activeFranchises: 0, renewedThisYear: 0, statusCounts: emptyCounts() };
  }

  // ── Module 16: Monitoring / Activity Logs ────────────────────────────────
  private async _monitoringLogsReport(filters: ManagementReportFilters): Promise<ManagementReportDataset> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    const logs = (data ?? []) as any[];

    let rows: ManagementReportRow[] = logs.map((log) => ({
      id: log.id,
      title: log.action_type?.replace(/_/g, ' ') ?? 'Log entry',
      subtitle: log.description ?? '',
      status: log.severity ?? 'info',
      date: log.created_at,
      category: log.entity_type ?? undefined,
      details: log.entity_id ? `Entity: ${log.entity_id}` : undefined,
    }));

    rows = rows.filter((r) => inDateRange(r.date, filters.dateFrom, filters.dateTo));
    return { title: TITLES.monitoring_logs, rows, activeFranchises: 0, renewedThisYear: 0, statusCounts: emptyCounts() };
  }

  // ── Module 16: Registered Tricycles ─────────────────────────────────────
  private async _registeredTricyclesReport(filters: ManagementReportFilters): Promise<ManagementReportDataset> {
    const franchises = await franchiseService.getRegistry();
    let rows: ManagementReportRow[] = franchises.map((fr) => ({
      id: fr.id,
      title: fr.mtop_number ?? 'No MTOP',
      subtitle: [
        `Body: ${fr.body_number ?? 'Unassigned'}`,
        `Plate: ${fr.plate_number}`,
        fr.current_holder_name ?? fr.driver_name,
      ].join(' · '),
      status: fr.franchise_status ?? 'active',
      date: fr.issued_at ?? fr.created_at,
      category: fr.toda ?? undefined,
      details: fr.expiry_date ? `Expires: ${fr.expiry_date}` : undefined,
    }));

    rows = rows.filter((r) => inDateRange(r.date, filters.dateFrom, filters.dateTo));
    const counts = emptyCounts();
    franchises.forEach((fr) => { counts[fr.franchise_status ?? 'active'] += 1; });
    return { title: TITLES.registered_tricycles, rows, activeFranchises: counts.active, renewedThisYear: 0, statusCounts: counts };
  }

  // ── Module 16: TODA Membership ───────────────────────────────────────────
  private async _todaMembershipReport(filters: ManagementReportFilters): Promise<ManagementReportDataset> {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, toda_membership, verification_status, current_status, created_at')
      .eq('user_type', 'driver')
      .order('name', { ascending: true });
    if (error) throw error;
    const drivers = (data ?? []) as any[];

    let rows: ManagementReportRow[] = drivers.map((d) => ({
      id: d.id,
      title: d.name ?? 'Driver',
      subtitle: d.toda_membership ? `TODA: ${d.toda_membership}` : 'No TODA membership on record',
      status: d.toda_membership ? 'member' : 'unassigned',
      date: d.created_at,
      details: `Verification: ${d.verification_status ?? 'pending'} · Status: ${d.current_status ?? 'offline'}`,
    }));

    rows = rows.filter((r) => inDateRange(r.date, filters.dateFrom, filters.dateTo));
    return { title: TITLES.toda_membership, rows, activeFranchises: 0, renewedThisYear: 0, statusCounts: emptyCounts() };
  }

  // ── Module 16: Renewal Due Dates / 30-Day Report ─────────────────────────
  private async _renewalDueDateReport(filters: ManagementReportFilters): Promise<ManagementReportDataset> {
    const franchises = await franchiseService.getRegistry();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in30 = new Date(today);
    in30.setDate(today.getDate() + 30);
    const in30Str = in30.toISOString().slice(0, 10);

    let subset = franchises.filter(
      (fr) => fr.expiry_date && fr.franchise_status !== 'terminated'
    );

    if (filters.type === 'due_within_30_days') {
      subset = subset.filter(
        (fr) => fr.expiry_date! >= todayStr && fr.expiry_date! <= in30Str
      );
    }

    let rows: ManagementReportRow[] = subset.map((fr) => {
      const expiry = fr.expiry_date!;
      const daysLeft = Math.ceil(
        (new Date(expiry).getTime() - Date.now()) / 86_400_000
      );
      const overdue = daysLeft < 0;
      return {
        id: fr.id,
        title: fr.current_holder_name ?? fr.driver_name,
        subtitle: `${fr.mtop_number ?? 'No MTOP'} · Body: ${fr.body_number ?? 'Unassigned'} · ${fr.plate_number}`,
        status: overdue ? 'overdue' : daysLeft <= 7 ? 'urgent' : daysLeft <= 30 ? 'due_soon' : 'upcoming',
        date: expiry,
        details: overdue
          ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`
          : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`,
      };
    });

    // Apply date filter against expiry_date
    if (filters.dateFrom || filters.dateTo) {
      rows = rows.filter((r) => inDateRange(r.date, filters.dateFrom, filters.dateTo));
    }

    // Sort: overdue first, then soonest expiry
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { title: TITLES[filters.type], rows, activeFranchises: 0, renewedThisYear: 0, statusCounts: emptyCounts() };
  }

  // ── Module 16: Assignment Records ────────────────────────────────────────
  private async _assignmentRecordsReport(filters: ManagementReportFilters): Promise<ManagementReportDataset> {
    const events = await franchiseService.getEvents();
    const franchises = await franchiseService.getRegistry();
    const byId = new Map(franchises.map((fr) => [fr.id, fr]));

    let rows: ManagementReportRow[] = events.map((e) => {
      const fr = byId.get(e.franchise_id);
      return {
        id: e.id,
        title: fr?.mtop_number ?? e.franchise_id.slice(0, 8).toUpperCase(),
        subtitle: [
          e.from_holder && `From: ${e.from_holder}`,
          e.to_holder && `To: ${e.to_holder}`,
        ].filter(Boolean).join(' → ') || (fr?.current_holder_name ?? fr?.driver_name ?? 'Unknown holder'),
        status: e.event_type.replace(/_/g, ' '),
        date: e.effective_date,
        category: fr?.toda ?? undefined,
        details: [
          e.relationship?.replace(/_/g, ' '),
          e.reason,
          e.agreement_number && `Agreement: ${e.agreement_number}`,
        ].filter(Boolean).join(' · ') || undefined,
      };
    });

    rows = rows.filter((r) => inDateRange(r.date, filters.dateFrom, filters.dateTo));
    return { title: TITLES.assignment_records, rows, activeFranchises: 0, renewedThisYear: 0, statusCounts: emptyCounts() };
  }

  // ── Module 16: Operator / Driver Registration Report ─────────────────────
  private async _operatorRegistrationReport(filters: ManagementReportFilters): Promise<ManagementReportDataset> {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, user_type, toda_membership, verification_status, current_status, created_at')
      .in('user_type', ['driver', 'passenger'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    const users = (data ?? []) as any[];

    // Enrich drivers with their franchise/MTOP number
    const driverIds = users.filter((u) => u.user_type === 'driver').map((u) => u.id);
    const mtopMap = new Map<string, string>();
    if (driverIds.length) {
      const { data: franchises } = await supabase
        .from('franchise_applications')
        .select('driver_id, mtop_number')
        .in('driver_id', driverIds)
        .eq('status', 'issued');
      (franchises ?? []).forEach((f: any) => {
        if (f.mtop_number) mtopMap.set(f.driver_id, f.mtop_number);
      });
    }

    let rows: ManagementReportRow[] = users.map((u) => ({
      id: u.id,
      title: u.name ?? 'Unknown',
      subtitle: u.user_type === 'driver'
        ? `Driver · TODA: ${u.toda_membership ?? 'Unassigned'} · MTOP: ${mtopMap.get(u.id) ?? 'None'}`
        : `Passenger`,
      status: u.verification_status ?? 'pending',
      date: u.created_at,
      category: u.user_type,
      details: `Status: ${u.current_status ?? 'offline'} · ${u.email ?? ''}`,
    }));

    rows = rows.filter((r) => inDateRange(r.date, filters.dateFrom, filters.dateTo));
    return {
      title: TITLES.operator_registration,
      rows,
      activeFranchises: driverIds.length,
      renewedThisYear: 0,
      statusCounts: emptyCounts(),
    };
  }

  // ── Module 16: TODA Association Report ───────────────────────────────────
  private async _todaAssociationReport(filters: ManagementReportFilters): Promise<ManagementReportDataset> {
    const { data: todas, error } = await supabase
      .from('toda_associations')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    const assocs = (todas ?? []) as any[];

    // Count members per TODA
    const { data: drivers } = await supabase
      .from('users')
      .select('toda_membership')
      .eq('user_type', 'driver')
      .not('toda_membership', 'is', null);
    const memberCount: Record<string, number> = {};
    (drivers ?? []).forEach((d: any) => {
      if (d.toda_membership) {
        memberCount[d.toda_membership] = (memberCount[d.toda_membership] ?? 0) + 1;
      }
    });

    // Count routes per TODA
    const { data: routes } = await supabase
      .from('toda_routes')
      .select('toda_id');
    const routeCount: Record<string, number> = {};
    (routes ?? []).forEach((r: any) => {
      routeCount[r.toda_id] = (routeCount[r.toda_id] ?? 0) + 1;
    });

    let rows: ManagementReportRow[] = assocs.map((t) => ({
      id: t.id,
      title: t.name,
      subtitle: [
        `${memberCount[t.name] ?? 0} member${(memberCount[t.name] ?? 0) !== 1 ? 's' : ''}`,
        `${routeCount[t.id] ?? 0} route${(routeCount[t.id] ?? 0) !== 1 ? 's' : ''}`,
        t.area_barangays?.length
          ? `${t.area_barangays.length} barangay${t.area_barangays.length > 1 ? 's' : ''}`
          : t.area ?? '',
      ].filter(Boolean).join(' · '),
      status: t.is_active ? 'active' : 'inactive',
      date: t.created_at,
      details: [
        t.contact_name && `Contact: ${t.contact_name}`,
        t.contact_phone,
        t.notes,
      ].filter(Boolean).join(' · ') || undefined,
    }));

    rows = rows.filter((r) => inDateRange(r.date, filters.dateFrom, filters.dateTo));
    return {
      title: TITLES.toda_association,
      rows,
      activeFranchises: assocs.filter((t) => t.is_active).length,
      renewedThisYear: 0,
      statusCounts: emptyCounts(),
    };
  }

  // ── Shared helpers ───────────────────────────────────────────────────────
  private _franchiseRow(row: FranchiseApplication): ManagementReportRow {
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

  private _eventRow(event: FranchiseEvent, franchise?: FranchiseApplication): ManagementReportRow {
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

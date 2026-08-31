import { FranchiseRecordStatus } from './Franchise';

export type InventoryCategory = 'supplies' | 'equipment' | 'safety' | 'office' | 'other';
export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'damaged';

export interface InventoryItem {
  id: string;
  item_name: string;
  category: InventoryCategory;
  quantity: number;
  issued_quantity: number;
  remaining_stock: number;
  low_stock_threshold: number;
  status: InventoryStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ViolationStatus = 'open' | 'resolved' | 'dismissed';

export interface DriverViolation {
  id: string;
  driver_id: string;
  franchise_id: string | null;
  driver_name?: string;
  violation_type: string;
  description: string | null;
  incident_date: string;
  penalty: string | null;
  status: ViolationStatus;
  created_by: string | null;
  created_at: string;
}

export type ManagementReportType =
  // ── Existing ──────────────────────────────────────────────────
  | 'franchise_status'
  | 'active_franchises'
  | 'renewals'
  | 'transfers'
  | 'terminations'
  | 'violations'
  | 'inventory'
  // ── Module 16 additions ───────────────────────────────────────
  | 'booking_records'       // All bookings with passenger/driver/route/status
  | 'trip_records'          // Completed trips only
  | 'monitoring_logs'       // Activity / audit logs
  | 'registered_tricycles'  // All issued MTOP franchise records
  | 'toda_membership'       // Drivers and their toda_membership field
  | 'renewal_due_dates'     // Franchises with expiry dates (all)
  | 'due_within_30_days'    // Franchises expiring within 30 days
  | 'assignment_records';   // Franchise assignment / ownership history

export interface ManagementReportFilters {
  type: ManagementReportType;
  dateFrom?: string;
  dateTo?: string;
  category?: InventoryCategory | 'all';
  franchiseStatus?: FranchiseRecordStatus | 'all';
  /** Filter for booking_records / trip_records */
  bookingStatus?: 'all' | 'pending' | 'accepted' | 'in-transit' | 'completed' | 'cancelled';
}

export interface ManagementReportRow {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date: string;
  category?: string;
  details?: string;
}

export interface ManagementReportDataset {
  title: string;
  rows: ManagementReportRow[];
  activeFranchises: number;
  renewedThisYear: number;
  statusCounts: Record<FranchiseRecordStatus, number>;
}

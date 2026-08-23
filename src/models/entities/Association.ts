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
  | 'franchise_status'
  | 'active_franchises'
  | 'renewals'
  | 'transfers'
  | 'terminations'
  | 'violations'
  | 'inventory';

export interface ManagementReportFilters {
  type: ManagementReportType;
  dateFrom?: string;
  dateTo?: string;
  category?: InventoryCategory | 'all';
  franchiseStatus?: FranchiseRecordStatus | 'all';
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

// ─── TODA Association & Route domain types (Module 9) ─────────────────────────

export interface TodaAssociation {
  id: string;
  name: string;
  area: string | null;
  /** JSON array of selected Boac barangay names */
  area_barangays: string[];
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Populated client-side after joining routes */
  routes?: TodaRoute[];
  /** Populated client-side after joining members */
  member_count?: number;
}

export interface TodaRoute {
  id: string;
  toda_id: string;
  from_barangay: string;
  to_barangay: string;
  fare: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SaveTodaInput = {
  id?: string;
  name: string;
  area?: string;
  area_barangays?: string[];
  contact_name?: string;
  contact_phone?: string;
  notes?: string;
  is_active?: boolean;
};

export type SaveRouteInput = {
  id?: string;
  toda_id: string;
  from_barangay: string;
  to_barangay: string;
  fare: number;
  notes?: string;
};

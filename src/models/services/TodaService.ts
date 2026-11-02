import { supabase } from '@/config/supabase';
import {
  SaveRouteInput,
  SaveTodaInput,
  TodaAssociation,
  TodaCapacity,
  TodaRoute,
} from '@/models/entities/Toda';
import { fetchAllRows } from '@/utils/supabaseUtils';

/** Franchise records that no longer hold a unit in the TODA. */
const RELEASED_FRANCHISE_STATUSES = ['terminated', 'transferred', 'renewed'];

const nameKey = (name?: string | null) => (name ?? '').trim().toLowerCase();

export class TodaService {
  // ── Associations ───────────────────────────────────────────────────────────

  async listAll(): Promise<TodaAssociation[]> {
    const { data, error } = await supabase
      .from('toda_associations')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as TodaAssociation[];
  }

  async getById(id: string): Promise<TodaAssociation | null> {
    const { data, error } = await supabase
      .from('toda_associations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as TodaAssociation | null) ?? null;
  }

  async save(input: SaveTodaInput, actorId?: string | null): Promise<TodaAssociation> {
    const name = input.name.trim();
    if (!name) throw new Error('TODA name is required.');

    const payload = {
      name,
      area: input.area?.trim() || null,
      area_barangays: input.area_barangays ?? [],
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: input.is_active ?? true,
      ...(input.approved_units !== undefined ? { approved_units: input.approved_units } : {}),
      updated_at: new Date().toISOString(),
      ...(input.id ? {} : { created_by: actorId ?? null }),
    };

    const query = input.id
      ? supabase.from('toda_associations').update(payload).eq('id', input.id)
      : supabase.from('toda_associations').insert(payload);

    const { data, error } = await query.select().single();
    if (error) {
      if (error.code === '23505') throw new Error('A TODA with this name already exists.');
      if (/approved_units/i.test(String(error.message))) {
        throw new Error('Approved units need database migration 079. Apply it in the Supabase SQL editor, then try again.');
      }
      throw error;
    }
    return data as TodaAssociation;
  }

  async setActive(id: string, is_active: boolean): Promise<void> {
    const { error } = await supabase
      .from('toda_associations')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('toda_associations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // ── Routes ──────────────────────────────────────────────────────────────────

  async listRoutes(todaId: string): Promise<TodaRoute[]> {
    const { data, error } = await supabase
      .from('toda_routes')
      .select('*')
      .eq('toda_id', todaId)
      .order('from_barangay', { ascending: true });
    if (error) throw error;
    return (data ?? []) as TodaRoute[];
  }

  async saveRoute(input: SaveRouteInput): Promise<TodaRoute> {
    const from = input.from_barangay.trim();
    const to = input.to_barangay.trim();
    const fare = Number(input.fare);
    if (!from) throw new Error('From barangay is required.');
    if (!to) throw new Error('To barangay is required.');
    if (from === to) throw new Error('From and To barangays must be different.');
    if (isNaN(fare) || fare < 0) throw new Error('Fare must be a positive number.');

    const payload = {
      toda_id: input.toda_id,
      from_barangay: from,
      to_barangay: to,
      fare,
      notes: input.notes?.trim() || null,
      senior_discount:  input.senior_discount  ?? 20,
      pwd_discount:     input.pwd_discount     ?? 20,
      student_discount: input.student_discount ?? 0,
      updated_at: new Date().toISOString(),
    };

    const query = input.id
      ? supabase.from('toda_routes').update(payload).eq('id', input.id)
      : supabase.from('toda_routes').insert(payload);

    const { data, error } = await query.select().single();
    if (error) {
      if (error.code === '23505') throw new Error('A route for this barangay pair already exists in this TODA.');
      throw error;
    }
    return data as TodaRoute;
  }

  async deleteRoute(routeId: string): Promise<void> {
    const { error } = await supabase
      .from('toda_routes')
      .delete()
      .eq('id', routeId);
    if (error) throw error;
  }

  // ── Capacity (B4) ───────────────────────────────────────────────────────────

  /**
   * Per TODA (keyed by lower-cased name): member drivers, and units holding an
   * issued MTOP. A unit counts under the TODA on its MTOP, or the driver's TODA
   * when the MTOP has none; terminated, transferred and superseded records
   * free the unit.
   */
  async getCapacityCounts(): Promise<Map<string, TodaCapacity>> {
    const [drivers, franchises] = await Promise.all([
      fetchAllRows<{ id: string; toda_membership: string | null }>(() =>
        supabase
          .from('users')
          .select('id, toda_membership')
          .eq('user_type', 'driver')
          .not('toda_membership', 'is', null)
          .order('id')
      ),
      fetchAllRows<{ id: string; driver_id: string; toda: string | null; franchise_status: string | null }>(() =>
        supabase
          .from('franchise_applications')
          .select('id, driver_id, toda, franchise_status')
          .eq('status', 'issued')
          .order('id')
      ),
    ]);

    const counts = new Map<string, TodaCapacity>();
    const entry = (key: string) => {
      let c = counts.get(key);
      if (!c) {
        c = { members: 0, activeUnits: 0 };
        counts.set(key, c);
      }
      return c;
    };
    const membership = new Map<string, string>();
    drivers.forEach((d) => {
      const key = nameKey(d.toda_membership);
      if (!key) return;
      membership.set(d.id, key);
      entry(key).members += 1;
    });
    franchises.forEach((f) => {
      if (f.franchise_status && RELEASED_FRANCHISE_STATUSES.includes(f.franchise_status)) return;
      const key = nameKey(f.toda) || membership.get(f.driver_id);
      if (key) entry(key).activeUnits += 1;
    });
    return counts;
  }

  capacityFor(counts: Map<string, TodaCapacity>, toda: Pick<TodaAssociation, 'name'>): TodaCapacity {
    return counts.get(nameKey(toda.name)) ?? { members: 0, activeUnits: 0 };
  }

  // ── Members ─────────────────────────────────────────────────────────────────
  // Members are drivers whose toda_membership field matches the TODA name.

  async getMembers(todaName: string): Promise<{ id: string; name: string; plate_number?: string; body_number?: string; verification_status?: string }[]> {
    const { data: drivers, error } = await supabase
      .from('users')
      .select('id, name, verification_status')
      .eq('user_type', 'driver')
      .eq('toda_membership', todaName)
      .order('name', { ascending: true });
    if (error) throw error;
    if (!drivers?.length) return [];

    // Enrich with franchise plate / body numbers
    const ids = drivers.map((d: any) => d.id);
    const { data: franchises } = await supabase
      .from('franchise_applications')
      .select('driver_id, plate_number, body_number')
      .in('driver_id', ids)
      .eq('status', 'issued');

    const frMap = new Map<string, { plate_number?: string; body_number?: string }>();
    for (const fr of (franchises ?? []) as any[]) {
      if (!frMap.has(fr.driver_id)) {
        frMap.set(fr.driver_id, { plate_number: fr.plate_number, body_number: fr.body_number });
      }
    }

    return (drivers as any[]).map((d) => ({
      id: d.id,
      name: d.name,
      verification_status: d.verification_status,
      ...frMap.get(d.id),
    }));
  }
}

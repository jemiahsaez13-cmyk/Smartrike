import { supabase } from '@/config/supabase';
import {
  SaveRouteInput,
  SaveTodaInput,
  TodaAssociation,
  TodaRoute,
} from '@/models/entities/Toda';

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
      updated_at: new Date().toISOString(),
      ...(input.id ? {} : { created_by: actorId ?? null }),
    };

    const query = input.id
      ? supabase.from('toda_associations').update(payload).eq('id', input.id)
      : supabase.from('toda_associations').insert(payload);

    const { data, error } = await query.select().single();
    if (error) {
      if (error.code === '23505') throw new Error('A TODA with this name already exists.');
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

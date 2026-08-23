import { supabase } from '@/config/supabase';
import {
  DriverViolation,
  InventoryItem,
  InventoryStatus,
  ViolationStatus,
} from '@/models/entities/Association';

const stockStatus = (quantity: number, issued: number, threshold: number): InventoryStatus => {
  const remaining = Math.max(0, quantity - issued);
  if (remaining === 0) return 'out_of_stock';
  if (remaining <= threshold) return 'low_stock';
  return 'in_stock';
};

export class InventoryService {
  async list(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('association_inventory')
      .select('*')
      .order('item_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as InventoryItem[];
  }

  async save(
    item: Partial<InventoryItem> & Pick<InventoryItem, 'item_name' | 'category' | 'quantity' | 'issued_quantity'>,
    actorId?: string | null
  ): Promise<InventoryItem> {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    const issued = Math.max(0, Math.floor(Number(item.issued_quantity) || 0));
    const threshold = Math.max(0, Math.floor(Number(item.low_stock_threshold) || 0));
    if (!item.item_name.trim()) throw new Error('Item name is required.');
    if (issued > quantity) throw new Error('Issued quantity cannot exceed total quantity.');
    const remaining = quantity - issued;
    const status = item.status === 'damaged'
      ? 'damaged'
      : stockStatus(quantity, issued, threshold);
    const payload = {
      item_name: item.item_name.trim(),
      category: item.category,
      quantity,
      issued_quantity: issued,
      remaining_stock: remaining,
      low_stock_threshold: threshold,
      status,
      notes: item.notes?.trim() || null,
      created_by: actorId || item.created_by || null,
      updated_at: new Date().toISOString(),
    };

    const query = item.id
      ? supabase.from('association_inventory').update(payload).eq('id', item.id)
      : supabase.from('association_inventory').insert(payload);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data as InventoryItem;
  }
}

export class ViolationService {
  async list(): Promise<DriverViolation[]> {
    const { data, error } = await supabase
      .from('driver_violations')
      .select('*')
      .order('incident_date', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as DriverViolation[];
    const ids = Array.from(new Set(rows.map((row) => row.driver_id).filter(Boolean)));
    if (ids.length) {
      const { data: users } = await supabase.from('users').select('id, name').in('id', ids);
      const names = new Map<string, string>((users ?? []).map((user: any) => [user.id, user.name]));
      rows.forEach((row) => { row.driver_name = names.get(row.driver_id) || 'Driver'; });
    }
    return rows;
  }

  async record(
    violation: Pick<DriverViolation, 'driver_id' | 'franchise_id' | 'violation_type' | 'description' | 'incident_date' | 'penalty'>,
    actorId?: string | null
  ): Promise<DriverViolation> {
    if (!violation.violation_type.trim()) throw new Error('Violation type is required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(violation.incident_date)
      || Number.isNaN(new Date(`${violation.incident_date}T00:00:00`).getTime())) {
      throw new Error('Use YYYY-MM-DD for the incident date.');
    }
    const { data, error } = await supabase
      .from('driver_violations')
      .insert({
        ...violation,
        violation_type: violation.violation_type.trim(),
        description: violation.description?.trim() || null,
        penalty: violation.penalty?.trim() || null,
        status: 'open',
        created_by: actorId || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as DriverViolation;
  }

  async setStatus(id: string, status: ViolationStatus): Promise<void> {
    const { error } = await supabase.from('driver_violations').update({ status }).eq('id', id);
    if (error) throw error;
  }
}

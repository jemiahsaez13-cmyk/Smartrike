import { supabase } from '@/config/supabase';
import { FranchiseApplication, FranchiseStatus } from '@/models/types';

export class FranchiseRepository {
  async create(application: Omit<FranchiseApplication, 'id'>): Promise<FranchiseApplication> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('franchise_applications')
      .insert({ ...application, created_at: now, updated_at: now })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<FranchiseApplication | null> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  async findByDriver(driverId: string): Promise<FranchiseApplication[]> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async findAll(status?: FranchiseStatus): Promise<FranchiseApplication[]> {
    let query = supabase
      .from('franchise_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async updateStatus(id: string, status: FranchiseStatus, remarks?: string): Promise<FranchiseApplication> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .update({
        status,
        remarks: remarks ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<FranchiseApplication>): Promise<FranchiseApplication> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

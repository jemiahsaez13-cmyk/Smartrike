import { supabase } from '@/config/supabase';
import { FranchiseApplication, FranchiseStatus } from '@/models/entities/Franchise';

export class FranchiseService {
  async getByDriver(driverId: string): Promise<FranchiseApplication | null> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0];
  }

  async getAll(): Promise<FranchiseApplication[]> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async submit(application: Partial<FranchiseApplication>): Promise<FranchiseApplication> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('franchise_applications')
      .insert({
        ...application,
        status: 'submitted',
        inspection_result: 'pending',
        payment_status: 'pending',
        mtop_number: null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateStatus(
    id: string,
    status: FranchiseStatus,
    patch: Partial<FranchiseApplication> = {}
  ): Promise<FranchiseApplication> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .update({ status, ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

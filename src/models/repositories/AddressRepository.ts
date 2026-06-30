import { supabase } from '@/config/supabase';
import { SavedAddress } from '@/models/types';

// CRUD for the passenger's saved-address book. A single default per user is
// enforced server-side by the `enforce_single_default_address` trigger
// (migration 029), so callers only need to flag the row they want as default.
export class AddressRepository {
  async listByUser(userId: string): Promise<SavedAddress[]> {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async create(address: Omit<SavedAddress, 'id' | 'created_at'>): Promise<SavedAddress> {
    const { data, error } = await supabase
      .from('user_addresses')
      .insert(address)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<SavedAddress>): Promise<SavedAddress> {
    const { data, error } = await supabase
      .from('user_addresses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('user_addresses').delete().eq('id', id);
    if (error) throw error;
  }

  async setDefault(id: string): Promise<void> {
    // The trigger clears the flag on the user's other rows.
    const { error } = await supabase
      .from('user_addresses')
      .update({ is_default: true })
      .eq('id', id);
    if (error) throw error;
  }
}

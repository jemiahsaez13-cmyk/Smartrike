import { supabase } from '@/config/supabase';
import { User, Driver } from '@/models/types';
import { Location } from '@/models/entities/Booking';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    if (error) return null;
    return data;
  }

  async create(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findAvailableDrivers(location: Location, radius: number): Promise<Driver[]> {
    const { data, error } = await supabase.rpc('find_nearby_drivers', {
      lat: location.latitude,
      lng: location.longitude,
      radius_km: radius
    });
    if (error) throw error;
    return data;
  }

  async updateDriverStatus(driverId: string, status: Driver['current_status']): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ current_status: status })
      .eq('id', driverId);
    if (error) throw error;
  }
}

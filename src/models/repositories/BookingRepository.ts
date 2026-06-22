import { supabase } from '@/config/supabase';
import { Booking, BookingStatus, Rating } from '@/models/types';

export class BookingRepository {
  async create(booking: Omit<Booking, 'id' | 'created_at'>): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .insert(booking)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    const updates: any = { status };
    if (status === 'accepted') updates.accepted_at = new Date().toISOString();
    if (status === 'in-transit') updates.started_at = new Date().toISOString();
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async assignDriver(bookingId: string, driverId: string): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ 
        driver_id: driverId,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findByPassenger(passengerId: string, limit: number = 50): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('passenger_id', passengerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }

  async findByDriver(driverId: string, limit: number = 50): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }

  async submitRating(id: string, rating: Rating): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ passenger_rating: rating })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // The driver's rating of the passenger (stored in driver_rating).
  async submitDriverRating(id: string, rating: Rating): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ driver_rating: rating })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findActiveBookings(): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .in('status', ['pending', 'accepted', 'in-transit'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}

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

  async cancel(id: string, reason?: string | null): Promise<Booking> {
    // The status predicate is checked by the database at write time, so a
    // concurrent pickup cannot be cancelled using an earlier cached status.
    // The server stamps who cancelled and whether the reason is valid.
    const { data, error } = await supabase.from('bookings')
      .update({ status: 'cancelled', cancellation_reason: reason?.trim() || null })
      .eq('id', id)
      .in('status', ['pending', 'accepted'])
      .select()
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    const existing = await this.findById(id);
    if (existing?.status === 'cancelled') return existing;
    throw new Error(existing ? 'This ride has already started or finished and cannot be cancelled.' : 'Unable to cancel this booking. Refresh and try again.');
  }

  async assignDriver(bookingId: string, driverId: string): Promise<Booking> {
    // Only claim a request that is still open. If another driver got there
    // first (or the passenger cancelled), zero rows match and we say so plainly
    // instead of surfacing PostgREST's "Cannot coerce the result" error.
    const { data, error } = await supabase
      .from('bookings')
      .update({
        driver_id: driverId,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .eq('status', 'pending')
      .is('driver_id', null)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      // A taken/cancelled request is usually hidden from us by RLS, so we
      // cannot always tell which of the two happened.
      throw new Error('This ride is no longer available. Another driver accepted it or the passenger cancelled.');
    }
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

  /**
   * Completed-trip fares since an instant, oldest first (B8 income chart).
   * Only the two columns the chart needs; paged past the 1000-row API cap.
   */
  async findCompletedFaresSince(
    driverId: string,
    sinceIso: string
  ): Promise<Array<{ completed_at: string; total_fare: number }>> {
    const PAGE = 1000;
    const rows: Array<{ completed_at: string; total_fare: number }> = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, completed_at, total_fare')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .gte('completed_at', sinceIso)
        .order('completed_at', { ascending: true })
        .order('id', { ascending: true }) // stable paging when times tie
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const page = (data ?? []) as Array<{ completed_at: string | null; total_fare: number | string | null }>;
      for (const row of page) {
        if (row.completed_at) rows.push({ completed_at: row.completed_at, total_fare: Number(row.total_fare) || 0 });
      }
      if (page.length < PAGE) break;
    }
    return rows;
  }

  async submitRating(
    id: string,
    rating: Rating,
    target: 'passenger' | 'driver' = 'passenger'
  ): Promise<Booking> {
    // `passenger_rating` = the passenger's rating OF the driver (drives the
    // driver's public score). `driver_rating` = the driver's rating OF the
    // passenger. Writing to the right column keeps the two reviews separate.
    const column = target === 'driver' ? 'driver_rating' : 'passenger_rating';
    const { data, error } = await supabase
      .from('bookings')
      .update({ [column]: rating })
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

  // The passenger's current in-flight booking (still searching, matched, or
  // mid-ride). Lets the passenger dashboard restore the active trip after a
  // reload instead of losing it.
  async findActiveByPassenger(passengerId: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('passenger_id', passengerId)
      .in('status', ['pending', 'accepted', 'in-transit'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data && data[0]) || null;
  }

  // The driver's current in-progress trip (accepted or in-transit), if any.
  // Lets the dashboard restore/resume the active passenger after the driver
  // navigates away or reloads the app.
  async findActiveByDriver(driverId: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'in-transit'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return null;
    return (data && data[0]) || null;
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

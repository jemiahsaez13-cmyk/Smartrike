import { supabase } from '@/config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export class RealtimeService {
  channels = new Map<string, RealtimeChannel>();

  subscribeToBooking(bookingId: string, callback: (payload: any) => void): string {
    const channel = supabase.channel(`booking-${bookingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`
      }, callback)
      .subscribe();
    this.channels.set(bookingId, channel);
    return bookingId;
  }

  subscribeToDriverLocation(driverId: string, callback: (payload: any) => void): string {
    const key = `driver-${driverId}`;
    const channel = supabase.channel(`driver-location-${driverId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`
      }, callback)
      .subscribe();
    this.channels.set(key, channel);
    return key;
  }

  unsubscribe(channelKey: string): void {
    const channel = this.channels.get(channelKey);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelKey);
    }
  }

  unsubscribeAll(): void {
    this.channels.forEach(channel => supabase.removeChannel(channel));
    this.channels.clear();
  }
}

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

  // Pushes new notifications to a specific user in real time, so the bell badge
  // and Notifications screen update the moment a row is inserted for them.
  subscribeToNotifications(userId: string, callback: (payload: any) => void): string {
    const key = `notifications-${userId}`;
    const channel = supabase.channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
    this.channels.set(key, channel);
    return key;
  }

  // Pushes newly created pending bookings to online drivers in real time, so a
  // request appears without the driver having to re-toggle their status.
  subscribeToNewBookings(callback: (payload: any) => void): string {
    const key = 'new-bookings';
    const channel = supabase.channel('new-bookings')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: 'status=eq.pending'
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

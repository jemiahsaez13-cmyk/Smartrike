import { supabase } from '@/config/supabase';
import { Driver, Booking } from '@/models/types';

export class NotificationService {
  async notifyDrivers(drivers: Driver[], booking: Booking): Promise<void> {
    const notifications = drivers.map(driver => ({
      user_id: driver.id,
      type: 'booking_request',
      title: 'New Booking Request',
      body: `Pickup at ${booking.pickup_location.address}`,
      booking_id: booking.id,
      read: false
    }));
    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) throw error;
  }

  async notifyPassenger(passengerId: string, title: string, body: string): Promise<void> {
    const { error } = await supabase.from('notifications').insert({
      user_id: passengerId,
      type: 'booking_update',
      title,
      body,
      read: false
    });
    if (error) throw error;
  }

  async getUserNotifications(userId: string, limit: number = 20) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    if (error) throw error;
  }

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
  }
}

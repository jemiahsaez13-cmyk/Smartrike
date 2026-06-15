import { supabase } from '@/config/supabase';
import { Message } from '@/models/types';

export class MessageRepository {
  async sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({ ...message, timestamp: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findByBooking(bookingId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async markRead(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('id', messageId);
    if (error) throw error;
  }

  async markAllReadForBooking(bookingId: string, recipientType: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('booking_id', bookingId)
      .neq('sender_type', recipientType);
    if (error) throw error;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('read', false)
      .neq('sender_id', userId);
    if (error) return 0;
    return count ?? 0;
  }
}

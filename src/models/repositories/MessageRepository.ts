import { supabase } from '@/config/supabase';
import { Conversation, Message } from '@/models/types';

/** Minimal shapes for the columns the inbox query actually selects. */
type BookingRow = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  status: Conversation['bookingStatus'];
  created_at: string;
  accepted_at: string | null;
};
type UserRow = { id: string; name: string; profile_photo_url: string | null; user_type: string };

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

  /**
   * Build the Inbox: every booking the user shares with a matched counterpart,
   * collapsed into one thread each with the other party, last message, and
   * unread count. Active trips (accepted / in-transit) always appear so the two
   * are connected the moment the driver confirms — even before anyone has typed.
   * Finished trips only appear once they actually hold a message (history).
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, passenger_id, driver_id, status, created_at, accepted_at')
      .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
      .not('driver_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    const bookings = (data ?? []) as BookingRow[];
    if (bookings.length === 0) return [];

    const bookingIds = bookings.map((b) => b.id);
    const otherIds = Array.from(
      new Set(
        bookings
          .map((b) => (b.passenger_id === userId ? b.driver_id : b.passenger_id))
          .filter((id): id is string => Boolean(id))
      )
    );

    // Fetch counterparts and all messages for these bookings in two batch calls.
    const [usersRes, msgsRes] = await Promise.all([
      otherIds.length
        ? supabase.from('users').select('id, name, profile_photo_url, user_type').in('id', otherIds)
        : Promise.resolve({ data: [] }),
      supabase.from('messages').select('*').in('booking_id', bookingIds).order('timestamp', { ascending: true }),
    ]);

    const userMap = new Map<string, UserRow>();
    for (const u of (usersRes.data ?? []) as UserRow[]) userMap.set(u.id, u);

    const byBooking = new Map<string, Message[]>();
    for (const m of (msgsRes.data ?? []) as Message[]) {
      const arr = byBooking.get(m.booking_id) ?? [];
      arr.push(m);
      byBooking.set(m.booking_id, arr);
    }

    const conversations: Conversation[] = [];
    for (const b of bookings) {
      const iAmPassenger = b.passenger_id === userId;
      const otherId = iAmPassenger ? b.driver_id : b.passenger_id;
      const other = otherId ? userMap.get(otherId) : undefined;
      const thread = byBooking.get(b.id) ?? [];
      const last = thread[thread.length - 1];
      const active = b.status === 'accepted' || b.status === 'in-transit';

      // Skip finished trips that never had a conversation.
      if (!active && thread.length === 0) continue;

      const unreadCount = thread.filter((m) => !m.read && m.sender_id !== userId).length;

      conversations.push({
        bookingId: b.id,
        otherUserId: otherId,
        otherName: other?.name ?? (iAmPassenger ? 'Your Driver' : 'Your Passenger'),
        otherPhoto: other?.profile_photo_url ?? null,
        otherType: iAmPassenger ? 'driver' : 'passenger',
        lastMessage: last?.message ?? null,
        lastTimestamp: String(last?.timestamp ?? b.accepted_at ?? b.created_at),
        unreadCount,
        bookingStatus: b.status,
        active,
      });
    }

    // Active threads first, then most-recently-active.
    conversations.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime();
    });

    return conversations;
  }
}

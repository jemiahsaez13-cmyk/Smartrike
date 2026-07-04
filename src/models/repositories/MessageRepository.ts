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
  completed_at: string | null;
};

// Trip chats expire 1 hour after the trip completes (a pg_cron job deletes the
// rows server-side; this mirrors that cutoff so the UI never shows a thread
// that is already scheduled for deletion).
const CHAT_TTL_AFTER_COMPLETION_MS = 60 * 60 * 1000;
const chatExpired = (b: Pick<BookingRow, 'status' | 'completed_at'>) =>
  b.status === 'completed' &&
  !!b.completed_at &&
  Date.now() - new Date(b.completed_at).getTime() > CHAT_TTL_AFTER_COMPLETION_MS;
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

  async markAllReadForBooking(bookingId: string, recipientType: string, userId?: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('booking_id', bookingId)
      .neq('sender_type', recipientType);
    if (error) throw error;
    // Keep the bell badge in sync: reading the chat also clears the "new
    // message" notifications this thread produced for me.
    if (userId) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('booking_id', bookingId)
        .eq('type', 'message')
        .eq('read', false);
    }
  }

  // Unread messages addressed to this user, scoped to bookings they are a
  // party of. (Never count other people's conversations — RLS should already
  // hide them, but admin god-mode and future policy changes must not inflate
  // the badge.)
  async getUnreadCount(userId: string): Promise<number> {
    const { data: bookings, error: bErr } = await supabase
      .from('bookings')
      .select('id')
      .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
      .not('driver_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);
    if (bErr || !bookings?.length) return 0;
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('booking_id', bookings.map((b: { id: string }) => b.id))
      .eq('read', false)
      .neq('sender_id', userId);
    if (error) return 0;
    return count ?? 0;
  }

  // Unread messages from the other party within a single trip's thread —
  // powers the red badge on the Active Ride chat button.
  async getUnreadCountForBooking(bookingId: string, userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', bookingId)
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
      .select('id, passenger_id, driver_id, status, created_at, accepted_at, completed_at')
      .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
      .not('driver_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    // Threads of trips completed over an hour ago are gone (or about to be).
    const bookings = ((data ?? []) as BookingRow[]).filter((b) => !chatExpired(b));
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

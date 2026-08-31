import { supabase } from '@/config/supabase';
import { Driver, Booking } from '@/models/types';

// ─── Announcement types ───────────────────────────────────────────────────────

export type AnnouncementAudience = 'all' | 'driver' | 'passenger';

export type AnnouncementCategory =
  | 'general'
  | 'maintenance'
  | 'meeting'
  | 'renewal_reminder'
  | 'payment_reminder'
  | 'safety'
  | 'policy';

export interface Announcement {
  /** Synthetic ID built from the broadcast_id stored on each notification. */
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  category: AnnouncementCategory;
  recipient_count: number;
  sent_at: string;
  sent_by: string | null;
}

export const ANNOUNCEMENT_CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
  general:          'General',
  maintenance:      'Maintenance',
  meeting:          'Meeting',
  renewal_reminder: 'Renewal Reminder',
  payment_reminder: 'Payment Reminder',
  safety:           'Safety',
  policy:           'Policy Update',
};

export const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  all:       'All Users',
  driver:    'Drivers Only',
  passenger: 'Passengers Only',
};

export class NotificationService {
  async notifyDrivers(drivers: Driver[], booking: Booking): Promise<void> {
    if (!drivers || drivers.length === 0) return; // nothing to insert
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

// ─── AnnouncementService ──────────────────────────────────────────────────────
// Broadcasts a notification to every user of a given type (or all users) and
// stores enough metadata on each row to reconstruct announcement history.
// Strategy: each broadcast shares the same `broadcast_id` UUID so we can
// group rows back into a single Announcement record without a separate table.

export class AnnouncementService {
  // ── Broadcast ──────────────────────────────────────────────────
  async broadcast(
    title: string,
    body: string,
    audience: AnnouncementAudience,
    category: AnnouncementCategory,
    sentBy: string | null
  ): Promise<Announcement> {
    if (!title.trim()) throw new Error('Title is required.');
    if (!body.trim()) throw new Error('Message body is required.');

    // Resolve target user IDs
    let query = supabase.from('users').select('id');
    if (audience !== 'all') query = (query as any).eq('user_type', audience);
    const { data: users, error: userErr } = await query;
    if (userErr) throw userErr;
    if (!users || users.length === 0) throw new Error('No users found for the selected audience.');

    const broadcastId = crypto.randomUUID();
    const now = new Date().toISOString();

    const rows = (users as { id: string }[]).map((u) => ({
      user_id: u.id,
      type: 'announcement',
      title: title.trim(),
      body: body.trim(),
      read: false,
      // Store broadcast metadata in the booking_id column (repurposed as a
      // general reference field) as JSON so we can reconstruct history.
      // Format: "broadcast:<uuid>|audience:<audience>|category:<category>|by:<sentBy>|count:<n>"
      booking_id: `broadcast:${broadcastId}|audience:${audience}|category:${category}|by:${sentBy ?? ''}|count:${users.length}`,
    }));

    const { error: insertErr } = await supabase.from('notifications').insert(rows);
    if (insertErr) throw insertErr;

    return {
      id: broadcastId,
      title: title.trim(),
      body: body.trim(),
      audience,
      category,
      recipient_count: users.length,
      sent_at: now,
      sent_by: sentBy,
    };
  }

  // ── History ────────────────────────────────────────────────────
  // Fetches past announcements by reading one representative row per
  // broadcast_id from the notifications table.
  async getHistory(limit = 50): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, booking_id, created_at')
      .eq('type', 'announcement')
      .not('booking_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit * 10); // over-fetch then dedupe in JS

    if (error) throw error;

    const seen = new Set<string>();
    const results: Announcement[] = [];

    for (const row of (data ?? []) as any[]) {
      const meta = this._parseMeta(row.booking_id ?? '');
      if (!meta) continue;
      if (seen.has(meta.broadcastId)) continue;
      seen.add(meta.broadcastId);
      results.push({
        id: meta.broadcastId,
        title: row.title,
        body: row.body,
        audience: meta.audience,
        category: meta.category,
        recipient_count: meta.count,
        sent_at: row.created_at,
        sent_by: meta.sentBy || null,
      });
      if (results.length >= limit) break;
    }

    return results;
  }

  // ── Helpers ────────────────────────────────────────────────────
  private _parseMeta(ref: string) {
    if (!ref.startsWith('broadcast:')) return null;
    try {
      const parts: Record<string, string> = {};
      ref.split('|').forEach((segment) => {
        const colon = segment.indexOf(':');
        if (colon === -1) return;
        parts[segment.slice(0, colon)] = segment.slice(colon + 1);
      });
      return {
        broadcastId: parts['broadcast'] ?? '',
        audience: (parts['audience'] ?? 'all') as AnnouncementAudience,
        category: (parts['category'] ?? 'general') as AnnouncementCategory,
        sentBy: parts['by'] ?? '',
        count: parseInt(parts['count'] ?? '0', 10) || 0,
      };
    } catch {
      return null;
    }
  }
}

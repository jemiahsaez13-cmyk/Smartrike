import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppSelector } from '@/controllers/store';
import { supabase, isSupabaseConfigured } from '@/config/supabase';

export interface AdminPendingCounts {
  /** MTOP work waiting on the admin: review, payment proof, issuance, Change of Unit, succession. */
  mtop: number;
  /** Drivers whose registration photos wait for review. */
  drivers: number;
}

const count = async (query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> => {
  try {
    const { count: n, error } = await query;
    return error ? 0 : n ?? 0;
  } catch {
    return 0;
  }
};

/**
 * Live counts for the admin's red badges (migration 083). Refreshes when a new
 * notification arrives (every admin-side event creates one), when MTOP rows or
 * succession requests change, and every minute as a fallback.
 */
export const useAdminPendingCounts = (): AdminPendingCounts => {
  const user = useAppSelector((state) => state.auth.user);
  const latestNotification = useAppSelector((state) => state.notification.notifications[0]?.id);
  const [counts, setCounts] = useState<AdminPendingCounts>({ mtop: 0, drivers: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Each caller (tab bar, dashboard) needs its own realtime channel name.
  const channelKey = useRef(Math.random().toString(36).slice(2, 10));
  const isAdmin = user?.user_type === 'admin';

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !isAdmin) return;
    const [applications, successions, drivers] = await Promise.all([
      count(
        supabase
          .from('franchise_applications')
          .select('id', { count: 'exact', head: true })
          .or(
            'status.in.(submitted,document_verification,approved),'
            + 'and(status.eq.payment,payment_review_status.eq.pending_review),'
            + 'cou_status.eq.pending'
          )
      ),
      count(
        supabase
          .from('franchise_succession_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
      ),
      count(
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('user_type', 'driver')
          .eq('driver_documents_status', 'pending')
      ),
    ]);
    setCounts({ mtop: applications + successions, drivers });
  }, [isAdmin]);

  // Coalesce bursts of realtime events into one refresh.
  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void refresh(); }, 400);
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh, latestNotification]);

  useEffect(() => {
    if (!isSupabaseConfigured || !isAdmin) return;
    const interval = setInterval(() => { void refresh(); }, 60_000);
    let channel: any;
    try {
      channel = supabase
        .channel(`admin_pending_counts_${user?.id}_${channelKey.current}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'franchise_applications' }, schedule)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'franchise_succession_requests' }, schedule)
        .subscribe();
    } catch {
      /* realtime unavailable: notification arrivals and the interval still refresh */
    }
    return () => {
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [isAdmin, user?.id, refresh, schedule]);

  return counts;
};

/** "9+" style label for small red badges. */
export const badgeLabel = (n: number, max = 99): string => (n > max ? `${max}+` : String(n));

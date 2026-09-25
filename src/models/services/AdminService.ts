import { supabase, createIsolatedClient } from '@/config/supabase';
import { User, Message } from '@/models/types';
import { fetchAllRows } from '@/utils/supabaseUtils';
import { phtStartOfDay } from '@/utils/dateUtils';

export interface AdminConversation {
  bookingId: string;
  passengerName: string;
  driverName: string;
  route: string;
  lastMessage: string;
  lastAt: string;
  count: number;
}

export interface AdminStats {
  totalUsers: number;
  drivers: number;
  passengers: number;
  admins: number;
  activeDrivers: number;
  pendingDrivers: number;
  totalBookings: number;
  completedTrips: number;
  cancelledTrips: number;
  todayTrips: number;
  revenue: number;
  avgFare: number;
  pendingFranchises: number;
}

export interface TopDriver {
  id: string;
  name: string;
  rating: number;
  trips: number;
  earnings: number;
}

export interface TopRoute {
  from: string;
  to: string;
  trips: number;
  pct: number;
}

export interface FareMatrix {
  id?: string;
  base_fare: number;
  per_km_rate: number;
  peak_hour_multiplier: number;
  peak_hours_enabled: boolean;
}

export type AnalyticsPeriod = 'Daily' | 'Weekly' | 'Monthly';

export interface PeriodMetrics {
  revenue: number;
  trips: number;
  drivers: number;
  avgFare: number;
  topZone: string;
}

export interface Analytics {
  bars: Record<AnalyticsPeriod, number[]>;
  labels: Record<AnalyticsPeriod, string[]>;
  metrics: Record<AnalyticsPeriod, PeriodMetrics>;
  topRoutes: TopRoute[];
  topDrivers: TopDriver[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const addr = (loc: any): string => (loc && typeof loc === 'object' ? loc.address || 'Unknown' : 'Unknown');
const num = (v: any): number => (typeof v === 'number' ? v : parseFloat(v) || 0);

export class AdminService {
  // ── Users ──────────────────────────────────────────────────────────────────
  async getAllUsers(): Promise<User[]> {
    return fetchAllRows<User>(() =>
      supabase.from('users').select('*').order('created_at', { ascending: false }).order('id')
    );
  }

  async updateUserStatus(id: string, status: 'active' | 'inactive' | 'suspended'): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async setDriverVerification(id: string, verification_status: 'pending' | 'verified' | 'rejected'): Promise<User> {
    const updates: Record<string, unknown> = { verification_status };
    // A rejected or re-opened application must immediately stop operating,
    // while the account itself remains active and can still sign in.
    if (verification_status !== 'verified') updates.current_status = 'offline';
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Invites a new administrator by email. The invite is first recorded in
  // `admin_invites` (admin-only table, migration 068); the `handle_new_user`
  // trigger grants the admin role only to emails found there, because sign-up
  // metadata is user-controlled and can never be trusted for roles. We then
  // send a magic-link sign-up on an isolated client so the inviting admin's own
  // session is never replaced. The invitee finishes by opening the emailed link
  // or using "Forgot Password" to set a password and sign in.
  async inviteAdmin(input: { name: string; email: string; phone?: string }): Promise<void> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const phone = input.phone?.trim() || null;

    if (!name) throw new Error('Please enter the new administrator’s name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');

    // Guard against an existing account (friendlier than a raw auth error).
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing) throw new Error('An account with this email already exists.');

    const { error: inviteError } = await supabase
      .from('admin_invites')
      .upsert({ email, name, phone }, { onConflict: 'email' });
    if (inviteError) {
      throw new Error(inviteError.message || 'Could not record the admin invitation.');
    }

    const client = createIsolatedClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { name, phone, user_type: 'admin' },
      },
    });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        throw new Error('An account with this email already exists.');
      }
      throw new Error(error.message || 'Could not send the admin invitation.');
    }
  }

  // Permanently deletes an account: the Supabase Auth login AND the profile
  // (which cascades from auth.users). Deleting only the profile row used to
  // leave the login behind, so the person could neither sign in ("profile not
  // found") nor sign up again ("already registered") with that email.
  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: id });
    if (error) {
      const message = String(error.message || '');
      if (/function .*admin_delete_user|could not find the function/i.test(message)) {
        throw new Error('Deleting accounts needs database migration 068. Apply it in the Supabase SQL editor, then try again.');
      }
      throw new Error(message || 'The account could not be deleted.');
    }
  }

  // ── Fare matrix (pricing) ────────────────────────────────────────────────────
  async getFareMatrix(): Promise<FareMatrix> {
    const { data, error } = await supabase.from('fare_matrix').select('*').order('id').limit(1).maybeSingle();
    if (error) throw error;
    return (
      data || {
        base_fare: 120,
        per_km_rate: 10,
        peak_hour_multiplier: 1,
        peak_hours_enabled: false,
      }
    );
  }

  // Updates the single fare_matrix row (or seeds one if the table is empty).
  // Admin write access is granted by migration 017.
  async updateFareMatrix(values: Omit<FareMatrix, 'id'>): Promise<FareMatrix> {
    const payload = {
      base_fare: Number(values.base_fare),
      per_km_rate: Number(values.per_km_rate),
      peak_hour_multiplier: Number(values.peak_hour_multiplier),
      peak_hours_enabled: Boolean(values.peak_hours_enabled),
    };

    // Same row the booking trigger (migration 068) prices rides from.
    const { data: existing } = await supabase.from('fare_matrix').select('id').order('id').limit(1).maybeSingle();
    const query = existing?.id
      ? supabase.from('fare_matrix').update(payload).eq('id', existing.id)
      : supabase.from('fare_matrix').insert(payload);

    const { data, error } = await query.select().single();
    if (error) throw error;
    if (!data) {
      throw new Error('The fare could not be saved. You may not have admin permission.');
    }
    return data;
  }

  // ── Aggregate stats for the dashboard ────────────────────────────────────────
  async getStats(): Promise<AdminStats> {
    const [users, bookings, franchises] = await Promise.all([
      fetchAllRows<any>(() => supabase.from('users').select('id,user_type,status,verification_status,current_status').order('id')),
      fetchAllRows<any>(() => supabase.from('bookings').select('id,status,total_fare,created_at').order('id')),
      fetchAllRows<any>(() => supabase.from('franchise_applications').select('id,status').order('id')),
    ]);

    const startOfToday = phtStartOfDay();

    const completed = bookings.filter((b: any) => b.status === 'completed');
    const revenue = completed.reduce((sum: number, b: any) => sum + num(b.total_fare), 0);

    return {
      totalUsers: users.length,
      drivers: users.filter((u: any) => u.user_type === 'driver').length,
      passengers: users.filter((u: any) => u.user_type === 'passenger').length,
      admins: users.filter((u: any) => u.user_type === 'admin').length,
      activeDrivers: users.filter(
        (u: any) => u.user_type === 'driver' && (u.current_status === 'online' || u.current_status === 'on-trip')
      ).length,
      pendingDrivers: users.filter(
        (u: any) => u.user_type === 'driver' && u.verification_status === 'pending'
      ).length,
      totalBookings: bookings.length,
      completedTrips: completed.length,
      cancelledTrips: bookings.filter((b: any) => b.status === 'cancelled').length,
      todayTrips: bookings.filter((b: any) => new Date(b.created_at) >= startOfToday).length,
      revenue,
      avgFare: completed.length ? revenue / completed.length : 0,
      pendingFranchises: franchises.filter(
        (f: any) => f.status !== 'issued' && f.status !== 'rejected'
      ).length,
    };
  }

  // ── Analytics for the reports screen ─────────────────────────────────────────
  async getAnalytics(): Promise<Analytics> {
    const [bookings, users] = await Promise.all([
      fetchAllRows<any>(() => supabase
        .from('bookings')
        .select('id,status,total_fare,created_at,pickup_location,dropoff_location,driver_id')
        .order('id')),
      fetchAllRows<any>(() => supabase
        .from('users')
        .select('id,name,rating,total_trips,total_earnings,user_type,current_status')
        .order('id')),
    ]);
    const now = new Date();

    const activeDrivers = users.filter(
      (u: any) => u.user_type === 'driver' && (u.current_status === 'online' || u.current_status === 'on-trip')
    ).length;
    const allDrivers = users.filter((u: any) => u.user_type === 'driver').length;

    // Volume bars + labels for each period.
    const dailyLabels: string[] = [];
    const dailyBars: number[] = [];
    for (let h = 8; h <= 20; h += 2) {
      dailyLabels.push(`${h}h`);
      const start = new Date(now);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start);
      end.setHours(h + 2);
      dailyBars.push(
        bookings.filter((b: any) => {
          const d = new Date(b.created_at);
          return d >= start && d < end;
        }).length
      );
    }

    const weeklyLabels: string[] = [];
    const weeklyBars: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      weeklyLabels.push(WEEKDAYS[day.getDay()]);
      weeklyBars.push(
        bookings.filter((b: any) => {
          const d = new Date(b.created_at);
          return d >= day && d < next;
        }).length
      );
    }

    const monthlyLabels: string[] = [];
    const monthlyBars: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      monthlyLabels.push(MONTHS[month.getMonth()]);
      monthlyBars.push(
        bookings.filter((b: any) => {
          const d = new Date(b.created_at);
          return d >= month && d < next;
        }).length
      );
    }

    const startOfToday = phtStartOfDay(now);
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setMonth(now.getMonth() - 1);

    const periodMetrics = (since: Date): PeriodMetrics => {
      const inRange = bookings.filter((b: any) => new Date(b.created_at) >= since);
      const completed = inRange.filter((b: any) => b.status === 'completed');
      const revenue = completed.reduce((s: number, b: any) => s + num(b.total_fare), 0);
      // Highest-demand dropoff zone in range.
      const zoneCounts: Record<string, number> = {};
      inRange.forEach((b: any) => {
        const z = addr(b.dropoff_location);
        zoneCounts[z] = (zoneCounts[z] || 0) + 1;
      });
      const topZone =
        Object.entries(zoneCounts).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0] || '—';
      return {
        revenue,
        trips: completed.length,
        drivers: activeDrivers || allDrivers,
        avgFare: completed.length ? revenue / completed.length : 0,
        topZone,
      };
    };

    // Top routes (from → to) across all bookings.
    const routeCounts: Record<string, { from: string; to: string; trips: number }> = {};
    bookings.forEach((b: any) => {
      const from = addr(b.pickup_location);
      const to = addr(b.dropoff_location);
      const key = `${from}→${to}`;
      if (!routeCounts[key]) routeCounts[key] = { from, to, trips: 0 };
      routeCounts[key].trips++;
    });
    const routesSorted = Object.values(routeCounts).sort((a, b) => b.trips - a.trips).slice(0, 4);
    const maxRouteTrips = routesSorted[0]?.trips || 1;
    const topRoutes: TopRoute[] = routesSorted.map((r) => ({
      ...r,
      pct: Math.round((r.trips / maxRouteTrips) * 100),
    }));

    // Top drivers by completed trips.
    const topDrivers: TopDriver[] = (users as any[])
      .filter((u: any) => u.user_type === 'driver')
      .map(
        (u: any): TopDriver => ({
          id: u.id,
          name: u.name,
          rating: num(u.rating),
          trips: num(u.total_trips),
          earnings: num(u.total_earnings),
        })
      )
      .sort((a: TopDriver, b: TopDriver) => b.trips - a.trips)
      .slice(0, 3);

    return {
      bars: { Daily: dailyBars, Weekly: weeklyBars, Monthly: monthlyBars },
      labels: { Daily: dailyLabels, Weekly: weeklyLabels, Monthly: monthlyLabels },
      metrics: {
        Daily: periodMetrics(startOfToday),
        Weekly: periodMetrics(weekAgo),
        Monthly: periodMetrics(monthAgo),
      },
      topRoutes,
      topDrivers,
    };
  }

  // ── System health: real metrics + DB latency ────────────────────────────────
  async getHealth() {
    const t0 = Date.now();
    let reachable = true;
    const safe = (p: Promise<any[]>) => p.catch(() => { reachable = false; return [] as any[]; });
    const [users, bookings, franchises] = await Promise.all([
      safe(fetchAllRows<any>(() => supabase.from('users').select('id,user_type,current_status,status').order('id'))),
      safe(fetchAllRows<any>(() => supabase.from('bookings').select('id,status').order('id'))),
      safe(fetchAllRows<any>(() => supabase.from('franchise_applications').select('id,status').order('id'))),
    ]);
    const latency = Date.now() - t0;

    return {
      latency,
      reachable,
      activeUsers: users.filter((u: any) => u.status === 'active').length,
      activeDrivers: users.filter(
        (u: any) => u.user_type === 'driver' && (u.current_status === 'online' || u.current_status === 'on-trip')
      ).length,
      totalBookings: bookings.length,
      completedTrips: bookings.filter((b: any) => b.status === 'completed').length,
      pendingFranchises: franchises.filter(
        (f: any) => f.status !== 'issued' && f.status !== 'rejected'
      ).length,
    };
  }
}

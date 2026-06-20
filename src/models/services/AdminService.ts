import { supabase } from '@/config/supabase';
import { User } from '@/models/types';

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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
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
    const { data, error } = await supabase
      .from('users')
      .update({ verification_status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Permanently deletes a user's profile row. The admin "god mode" ALL policy
  // (migration 011) authorizes this; FKs cascade/null related rows.
  // Returns the deleted rows so we can detect a silent RLS block (0 rows, no
  // error) instead of pretending the delete succeeded.
  async deleteUser(id: string): Promise<void> {
    const { data, error } = await supabase.from('users').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(
        'The account could not be deleted. You may not have admin permission, or it was already removed. Try signing out and back in as an administrator.'
      );
    }
  }

  // ── Aggregate stats for the dashboard ────────────────────────────────────────
  async getStats(): Promise<AdminStats> {
    const [usersRes, bookingsRes, franchiseRes] = await Promise.all([
      supabase.from('users').select('user_type,status,verification_status,current_status'),
      supabase.from('bookings').select('status,total_fare,created_at'),
      supabase.from('franchise_applications').select('status'),
    ]);

    const users = usersRes.data || [];
    const bookings = bookingsRes.data || [];
    const franchises = franchiseRes.data || [];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

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
    const [bookingsRes, usersRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('status,total_fare,created_at,pickup_location,dropoff_location,driver_id'),
      supabase
        .from('users')
        .select('id,name,rating,total_trips,total_earnings,user_type,current_status'),
    ]);

    const bookings = bookingsRes.data || [];
    const users = usersRes.data || [];
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

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
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
    const [usersRes, bookingsRes, franchiseRes] = await Promise.all([
      supabase.from('users').select('user_type,current_status,status'),
      supabase.from('bookings').select('status'),
      supabase.from('franchise_applications').select('status'),
    ]);
    const latency = Date.now() - t0;

    const users = usersRes.data || [];
    const bookings = bookingsRes.data || [];
    const franchises = franchiseRes.data || [];
    const reachable = !usersRes.error && !bookingsRes.error;

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

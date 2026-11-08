/**
 * In-memory mock of the subset of the Supabase JS client used by this app.
 *
 * It implements just enough of the query builder, auth, rpc and realtime
 * surface so every service/repository keeps working unchanged when no Supabase
 * backend is configured. Data lives in module memory for the session and is
 * seeded from mockData.ts.
 *
 * Notable behaviour: when a new pending booking is inserted, a nearby online
 * driver "accepts" it after a short delay and the change is pushed to any
 * `booking-<id>` realtime channel — this drives the passenger booking flow
 * (ConfirmBooking -> ActiveTrip) without a real backend.
 */
import { buildSeedDatabase } from './mockData';

type Row = Record<string, any>;
type Result = { data: any; error: any; count?: number | null };

const db: Record<string, Row[]> = buildSeedDatabase();

const genId = (table: string) => `${table}-${Math.random().toString(36).slice(2, 10)}`;
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
const REQUIRED_MTOP_DOCS = ["Driver's License", 'Barangay Clearance', 'Community Tax Certificate (Cedula)', 'OR/CR of Tricycle Unit', 'Proof of Ownership', 'TODA Membership Certificate'];
const mtopDocsApproved = (documents: any) => Array.isArray(documents) && REQUIRED_MTOP_DOCS.every((name) =>
  documents.some((doc: any) => doc.name === name && doc.uploaded && doc.file_url && doc.review_status === 'approved')
);
// Mirrors migration 069: an approved/issued MTOP verifies the driver's account.
const verifyDriverForMtop = (app: any) => {
  if (app?.status !== 'approved' && app?.status !== 'issued') return;
  const driver = db.users.find((u) => u.id === app.driver_id && u.user_type === 'driver');
  if (driver) driver.verification_status = 'verified';
};

// ---------------------------------------------------------------------------
// Realtime channels
// ---------------------------------------------------------------------------
interface ChannelEntry {
  name: string;
  callbacks: Array<(payload: any) => void>;
}
const channels = new Map<string, ChannelEntry>();

const emitToChannel = (name: string, payload: any) => {
  const entry = channels.get(name);
  if (entry) entry.callbacks.forEach((cb) => cb(payload));
};

// ---------------------------------------------------------------------------
// Booking auto-accept simulation
// ---------------------------------------------------------------------------
const simulateDriverMatch = (bookingId: string) => {
  setTimeout(() => {
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking || booking.status !== 'pending') return;

    const driver =
      db.users.find((u) => u.user_type === 'driver' && u.current_status === 'online') ||
      db.users.find((u) => u.user_type === 'driver');

    booking.driver_id = driver ? driver.id : 'demo-driver';
    booking.status = 'accepted';
    booking.accepted_at = new Date().toISOString();

    emitToChannel(`booking-${bookingId}`, {
      eventType: 'UPDATE',
      schema: 'public',
      table: 'bookings',
      new: clone(booking),
      old: clone(booking),
    });
  }, 4000);
};

// ---------------------------------------------------------------------------
// D7 drop-off change (mirrors migration 087)
// ---------------------------------------------------------------------------
const kmBetween = (a: any, b: any) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const routeChangeFare = (booking: Row, distance: number) => {
  const km = Math.max(1, Math.ceil(distance || 0));
  let route = round2((Number(booking.base_fare ?? 120) + (km - 1) * Number(booking.per_km_rate ?? 10)) * Number(booking.peak_hour_multiplier ?? 1));
  if (booking.ride_type === 'priority') route += Math.max(12, route * 0.15);
  const count = Math.min(5, Math.max(1, Number(booking.passenger_count ?? 1)));
  const discount = round2(round2(route) * Number(booking.discount_pct ?? 0) / 100);
  return { total_fare: round2(route * count - discount), discount_amount: discount, estimated_duration: Math.ceil((distance / 30) * 60) };
};
const notifyMock = (userId: string | null, title: string, body: string, bookingId: string) => {
  if (!userId) return;
  if (!db.notifications) db.notifications = [];
  db.notifications.unshift({ id: genId('notifications'), user_id: userId, type: 'booking_update', title, body, booking_id: bookingId, read: false, created_at: new Date().toISOString() });
};
const paymentSent = (booking: Row) =>
  booking.payment_status === 'completed'
  || (db.ride_payment_submissions ?? []).some((p) => p.booking_id === booking.id && ['pending', 'verified'].includes(p.status));
const applyRouteChange = (change: Row, booking: Row, driverId: string | null) => {
  const fare = routeChangeFare(booking, Number(change.new_distance));
  Object.assign(change, {
    status: 'accepted', old_total_fare: booking.total_fare, old_discount_amount: booking.discount_amount ?? 0,
    new_total_fare: fare.total_fare, new_discount_amount: fare.discount_amount, new_estimated_duration: fare.estimated_duration,
    decided_at: new Date().toISOString(), decided_by: driverId,
  });
  Object.assign(booking, {
    dropoff_location: change.new_dropoff_location, distance: change.new_distance,
    estimated_duration: fare.estimated_duration, discount_amount: fare.discount_amount, total_fare: fare.total_fare,
  });
  notifyMock(booking.passenger_id, 'Drop-off changed', `Your driver accepted the new drop-off: ${booking.dropoff_location?.address || 'pinned on the map'}. New fare ₱${Number(booking.total_fare).toFixed(2)}.`, booking.id);
  emitToChannel(`booking-${booking.id}`, { eventType: 'UPDATE', schema: 'public', table: 'bookings', new: clone(booking), old: clone(booking) });
};
// Offline there is no second phone, so the demo driver answers by itself.
const simulateDriverRouteAnswer = (changeId: string) => {
  setTimeout(() => {
    const change = (db.booking_route_changes ?? []).find((c) => c.id === changeId);
    const booking = change && db.bookings.find((b) => b.id === change.booking_id);
    if (!change || !booking || change.status !== 'pending' || !['accepted', 'in-transit'].includes(booking.status) || paymentSent(booking)) return;
    applyRouteChange(change, booking, booking.driver_id);
  }, 6000);
};

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------
class QueryBuilder implements PromiseLike<Result> {
  private table: string;
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: any = null;
  private filters: Array<(row: Row) => boolean> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private offsetN = 0;
  private wantSelect = false;
  private isSingle = false;
  private countRequested = false;
  private headOnly = false;

  constructor(table: string) {
    this.table = table;
    if (!db[table]) db[table] = [];
  }

  // --- terminal-ish chainables ---
  select(_cols?: string, options?: { count?: 'exact'; head?: boolean }) {
    this.wantSelect = true;
    this.countRequested = options?.count === 'exact';
    this.headOnly = options?.head === true;
    return this;
  }
  insert(payload: any) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  upsert(payload: any) {
    this.op = 'upsert';
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }

  // --- filters / modifiers ---
  eq(column: string, value: any) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: any[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  gte(column: string, value: any) {
    this.filters.push((row) => row[column] >= value);
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }
  is(column: string, value: any) {
    this.filters.push((row) => (value === null ? row[column] == null : row[column] === value));
    return this;
  }
  not(column: string, op: string, value: any) {
    if (op === 'in') {
      const list = String(value).replace(/[()]/g, '').split(',').map((v) => v.trim());
      this.filters.push((row) => !list.includes(String(row[column])));
    } else if (op === 'is') {
      this.filters.push((row) => (value === null ? row[column] != null : row[column] !== value));
    }
    return this;
  }
  neq(column: string, value: any) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }
  maybeSingle() {
    this.isSingle = true;
    return this;
  }
  single() {
    this.isSingle = true;
    return this;
  }

  private matched(): Row[] {
    return db[this.table].filter((row) => this.filters.every((f) => f(row)));
  }

  private run(): Result {
    let data: any = null;

    if (this.op === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = items.map((item) => {
        const row: Row = {
          id: item.id ?? genId(this.table),
          created_at: item.created_at ?? new Date().toISOString(),
          ...item,
        };
        db[this.table].push(row);
        if (this.table === 'bookings' && row.status === 'pending' && !row.driver_id) {
          simulateDriverMatch(row.id);
        }
        return row;
      });
      data = Array.isArray(this.payload) ? inserted : inserted[0];
    } else if (this.op === 'update') {
      const rows = this.matched();
      rows.forEach((row) => {
        if (this.table === 'franchise_applications') {
          const next = { ...row, ...this.payload };
          if ((row.documents_verified_at || mtopDocsApproved(row.documents)) && next.status === 'rejected') {
            throw new Error('Approved MTOP files cannot be declined.');
          }
          if (row.documents_verified_at && this.payload.documents && JSON.stringify(this.payload.documents) !== JSON.stringify(row.documents)) {
            throw new Error('Verified MTOP files are locked.');
          }
          if (!row.documents_verified_at && next.documents_verified_at
            && (!mtopDocsApproved(next.documents) || next.status !== 'payment')) {
            throw new Error('File approval must move the MTOP application to payment.');
          }
        }
        if (this.table === 'users') {
          const actor = db.users.find((user) => user.auth_id === currentAuthUser?.id || user.id === currentAuthUser?.id);
          const next = { ...row, ...this.payload };
          if (this.payload.verification_status !== undefined
            && this.payload.verification_status !== row.verification_status
            && actor?.user_type !== 'admin') {
            throw new Error('Driver verification can only be changed by an administrator.');
          }
          if (next.user_type === 'driver'
            && (next.verification_status || 'pending') !== 'verified'
            && (next.current_status || 'offline') !== 'offline') {
            if (actor?.user_type === 'admin' && next.verification_status !== row.verification_status) {
              this.payload = { ...this.payload, current_status: 'offline' };
            } else {
              throw new Error('Driver verification is required before going online or operating trips.');
            }
          }
        }
        Object.assign(row, this.payload);
        if (this.table === 'franchise_applications') verifyDriverForMtop(row);
      });
      data = rows;
    } else if (this.op === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      data = items.map((item) => {
        const key = this.table === 'driver_locations' ? 'driver_id' : 'id';
        const existing = db[this.table].find((r) => r[key] === item[key]);
        if (existing) {
          Object.assign(existing, item);
          return existing;
        }
        const row = { id: item.id ?? genId(this.table), ...item };
        db[this.table].push(row);
        return row;
      });
    } else if (this.op === 'delete') {
      const matched = this.matched();
      const ids = new Set(matched);
      db[this.table] = db[this.table].filter((row) => !ids.has(row));
      data = matched;
    } else {
      data = this.matched();
    }

    // ordering + limit only meaningful for list results
    if (Array.isArray(data)) {
      if (this.orderBy) {
        const { column, ascending } = this.orderBy;
        data = [...data].sort((a, b) => {
          const av = a[column];
          const bv = b[column];
          if (av === bv) return 0;
          const cmp = av > bv ? 1 : -1;
          return ascending ? cmp : -cmp;
        });
      }
      if (this.limitN != null) data = data.slice(this.offsetN, this.offsetN + this.limitN);
    }

    const count = this.countRequested && Array.isArray(data) ? data.length : null;
    if (this.headOnly) return { data: null, error: null, count };
    if (this.isSingle) {
      const first = Array.isArray(data) ? data[0] : data;
      if (first == null) {
        return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
      }
      return { data: clone(first), error: null };
    }

    // insert/update without an explicit .select() still resolve OK
    return { data: clone(data), error: null, count };
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    let result: Result;
    try {
      result = this.run();
    } catch (error) {
      result = { data: null, error };
    }
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

// ---------------------------------------------------------------------------
// Auth (subset)
// ---------------------------------------------------------------------------
let currentAuthUser: { id: string; email: string } | null = null;

const auth = {
  async signUp({
    email,
    options,
  }: {
    email: string;
    password: string;
    options?: { data?: Record<string, any> };
  }) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));

    // Check if email already exists in mock DB
    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.users.find(u => String(u.email).toLowerCase() === normalizedEmail);
    if (existing) {
      return { 
        data: { user: null, session: null }, 
        error: { message: 'User already registered' } 
      };
    }

    const authId = `auth-${Math.random().toString(36).slice(2, 10)}`;
    const requestedType = options?.data?.user_type;
    const userType = requestedType === 'driver' ? 'driver' : 'passenger';
    db.users.push({
      id: `user-${Math.random().toString(36).slice(2, 10)}`,
      auth_id: authId,
      user_type: userType,
      email: normalizedEmail,
      phone: null,
      name: String(options?.data?.name || normalizedEmail.split('@')[0]),
      profile_photo_url: null,
      created_at: new Date().toISOString(),
      status: 'active',
      rating: 5,
      total_trips: 0,
      verification_status: userType === 'driver' ? 'pending' : null,
      current_status: userType === 'driver' ? 'offline' : undefined,
      profile_completed: false,
      license_number: options?.data?.license_number || null,
      toda_membership: options?.data?.toda_membership || null,
      vehicle_details: options?.data?.vehicle_details || null,
    });
    currentAuthUser = { id: authId, email: normalizedEmail };
    return {
      data: {
        user: { id: authId, email: normalizedEmail, identities: [{ provider: 'email' }] },
        session: { access_token: 'mock-jwt', user: currentAuthUser },
      },
      error: null,
    };
  },
  async signInWithPassword({ email }: { email: string; password: string }) {
    await new Promise(r => setTimeout(r, 800));

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => String(u.email).toLowerCase() === normalizedEmail);
    if (!user) {
      return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
    }
    // Return auth_id as the identity so findByAuthId() can locate the profile
    const authId = user.auth_id || user.id;
    currentAuthUser = { id: authId, email: normalizedEmail };
    return {
      data: {
        user: { id: authId, email: normalizedEmail },
        session: { access_token: 'mock-jwt', user: currentAuthUser },
      },
      error: null,
    };
  },
  async verifyOtp() {
    return {
      data: { user: null, session: null },
      error: { message: 'Email verification is unavailable in offline demo mode.' },
    };
  },
  async resend() {
    return {
      data: {},
      error: { message: 'Email delivery is unavailable in offline demo mode.' },
    };
  },
  async signOut(_options?: { scope?: string }) {
    currentAuthUser = null;
    return { error: null };
  },
  async resetPasswordForEmail(_email: string) {
    return {
      data: null,
      error: { message: 'Email delivery is unavailable in offline demo mode.' },
    };
  },
  async updateUser(_attributes: { password?: string; nonce?: string }) {
    if (!currentAuthUser) {
      return { data: { user: null }, error: { message: 'No verified session is active.' } };
    }
    return { data: { user: currentAuthUser }, error: null };
  },
  async reauthenticate() {
    return { error: { message: 'Email verification is unavailable in offline demo mode.' } };
  },
  async getUser() {
    return { data: { user: currentAuthUser }, error: null };
  },
  // Offline sessions never expire, so there are no auth events to emit.
  onAuthStateChange(_callback: (event: string, session: any) => void) {
    return { data: { subscription: { unsubscribe() {} } } };
  },
  async getSession() {
    return { 
      data: { 
        session: currentAuthUser ? { user: currentAuthUser, access_token: 'mock-jwt' } : null 
      }, 
      error: null 
    };
  },
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
export const mockSupabase: any = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  rpc: async (fn: string, params: any) => {
    const currentProfile = () => db.users.find((u) => u.auth_id === currentAuthUser?.id || u.id === currentAuthUser?.id);
    if (fn === 'admin_delete_user') {
      const me = currentProfile();
      if (me?.user_type !== 'admin') return { data: null, error: { message: 'Only administrators can delete accounts.' } };
      if (me.id === params?.p_user_id) return { data: null, error: { message: 'You cannot delete your own account.' } };
      if (db.users.some((u) => u.id === params?.p_user_id && u.status === 'deactivated')) {
        return { data: null, error: { message: 'Deactivated accounts are kept with their ride and violation records and cannot be deleted.' } };
      }
      const before = db.users.length;
      db.users = db.users.filter((u) => u.id !== params?.p_user_id);
      if (db.users.length === before) return { data: null, error: { message: 'That account no longer exists.' } };
      return { data: null, error: null };
    }
    if (fn === 'admin_deactivate_user') {
      const me = currentProfile();
      if (me?.user_type !== 'admin') return { data: null, error: { message: 'Only administrators can deactivate accounts.' } };
      if (me.id === params?.p_user_id) return { data: null, error: { message: 'You cannot deactivate your own account.' } };
      if (String(params?.p_reason ?? '').trim().length < 5) return { data: null, error: { message: 'Give the reason for the deactivation.' } };
      const target = db.users.find((u) => u.id === params?.p_user_id && u.user_type !== 'admin' && u.status !== 'deactivated');
      if (!target) return { data: null, error: { message: 'Only a driver or passenger account that is not yet deactivated can be deactivated.' } };
      Object.assign(target, {
        status: 'deactivated',
        deactivated_at: new Date().toISOString(),
        deactivated_by: me.id,
        deactivation_reason: String(params.p_reason).trim(),
        current_status: 'offline',
      });
      return { data: clone(target), error: null };
    }
    if (fn === 'resubmit_mtop_document') {
      const app = db.franchise_applications.find((row) => row.id === params?.p_application_id);
      const me = currentProfile();
      if (!app || !me || app.driver_id !== me.id) return { data: null, error: { message: 'MTOP application not found.' } };
      if (app.documents_verified_at || !['submitted', 'document_verification'].includes(app.status)) {
        return { data: null, error: { message: 'Documents can only be replaced while the application is in review.' } };
      }
      const doc = (app.documents || []).find((d: any) => d.name === params?.p_document_name);
      if (!doc || doc.review_status !== 'rejected') {
        return { data: null, error: { message: 'Only a rejected document can be re-uploaded.' } };
      }
      Object.assign(doc, {
        uploaded: true,
        file_url: params.p_file_url,
        file_name: params.p_file_name ?? null,
        uploaded_at: new Date().toISOString(),
        review_status: 'pending',
        review_remarks: null,
      });
      app.updated_at = new Date().toISOString();
      return { data: [clone(app)], error: null };
    }
    if (fn === 'find_nearby_drivers') {
      const drivers = db.users.filter(
        (u) => u.user_type === 'driver' && u.current_status === 'online'
      );
      return { data: clone(drivers.slice(0, params?.radius_km ? drivers.length : drivers.length)), error: null };
    }
    if (fn === 'get_driver_public_franchise') {
      const record = db.franchise_applications
        .filter((row) => row.driver_id === params?.p_driver_id && (row.status === 'issued' || row.mtop_number))
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
      if (!record) return { data: [], error: null };
      const expired = record.expiry_date && new Date(`${record.expiry_date}T23:59:59`).getTime() < Date.now();
      const protectedStatus = ['terminated', 'transferred', 'pending_renewal'].includes(record.franchise_status);
      return {
        data: [clone({
          driver_id: record.driver_id,
          mtop_number: record.mtop_number,
          body_number: record.body_number,
          plate_number: record.plate_number,
          franchise_status: expired && !protectedStatus ? 'expired' : (record.franchise_status || 'active'),
          current_holder_name: record.current_holder_name || record.driver_name,
          expiry_date: record.expiry_date || null,
          last_renewed_at: record.last_renewed_at || null,
          renewal_year: record.renewal_year || null,
        })],
        error: null,
      };
    }
    if (fn === 'get_ride_driver_payment_methods') {
      const booking = db.bookings.find((row) => row.id === params?.p_booking_id);
      const me = currentProfile();
      if (!booking || !booking.driver_id || !me || ![booking.passenger_id, booking.driver_id].includes(me.id) && me.user_type !== 'admin') {
        return { data: null, error: { message: 'You are not authorized to view this ride’s payment details.' } };
      }
      return { data: clone((db.driver_payment_methods ?? []).filter((row) => row.driver_id === booking.driver_id && row.is_enabled)), error: null };
    }
    if (fn === 'submit_ride_payment') {
      const booking = db.bookings.find((row) => row.id === params?.p_booking_id);
      const me = currentProfile();
      const method = (db.driver_payment_methods ?? []).find((row) => row.id === params?.p_method_id && row.is_enabled);
      if (!booking || !me || !method || booking.passenger_id !== me.id || !booking.driver_id || booking.driver_id !== method.driver_id) {
        return { data: null, error: { message: 'You cannot submit payment for this ride.' } };
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{5,63}$/.test(String(params?.p_reference || '').trim())
        || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(String(params?.p_proof_url || ''))) {
        return { data: null, error: { message: 'Valid payment proof and reference are required.' } };
      }
      const existing = (db.ride_payment_submissions ?? []).find((row) => row.booking_id === booking.id);
      if (existing && ['pending', 'verified'].includes(existing.status)) {
        return { data: null, error: { message: 'A payment has already been submitted for this ride.' } };
      }
      // Mirrors migration 087: pay only after the driver answered a drop-off change.
      if ((db.booking_route_changes ?? []).some((c) => c.booking_id === booking.id && c.status === 'pending')) {
        return { data: null, error: { message: 'Your driver has not answered your drop-off change yet. Wait for the answer, or withdraw the request, so you pay the right fare.' } };
      }
      const row = existing ?? { id: genId('ride_payment_submissions'), booking_id: booking.id, created_at: new Date().toISOString() };
      Object.assign(row, {
        passenger_id: booking.passenger_id, driver_id: booking.driver_id,
        driver_payment_method_id: method.id,
        payment_details_snapshot: { method_type: method.method_type, display_name: method.display_name, account_name: method.account_name, account_number: method.account_number, instructions: method.instructions },
        amount: booking.total_fare, payment_reference: String(params?.p_reference || '').trim(), proof_url: params?.p_proof_url,
        status: 'pending', rejection_reason: null, submitted_at: new Date().toISOString(), reviewed_at: null, reviewed_by: null, reviewed_by_role: null,
      });
      if (!existing) {
        if (!db.ride_payment_submissions) db.ride_payment_submissions = [];
        db.ride_payment_submissions.push(row);
      }
      return { data: [clone(row)], error: null };
    }
    if (fn === 'review_ride_payment') {
      const row = (db.ride_payment_submissions ?? []).find((item) => item.id === params?.p_payment_id);
      const me = currentProfile();
      if (!row || !me || (row.driver_id !== me.id && me.user_type !== 'admin') || row.status !== 'pending') {
        return { data: null, error: { message: 'You are not authorized to review this payment.' } };
      }
      row.status = params?.p_decision; row.rejection_reason = params?.p_reason ?? null;
      row.reviewed_at = new Date().toISOString(); row.reviewed_by = me.id; row.reviewed_by_role = me.user_type;
      const booking = db.bookings.find((item) => item.id === row.booking_id);
      if (booking && row.status === 'verified') {
        booking.payment_status = 'completed';
        const existingTransaction = (db.transactions ?? []).find((item) => item.booking_id === booking.id);
        const transaction = {
          id: existingTransaction?.id ?? genId('transactions'),
          booking_id: booking.id,
          passenger_id: row.passenger_id,
          driver_id: row.driver_id,
          amount: row.amount,
          payment_method: 'online',
          status: 'completed',
          created_at: existingTransaction?.created_at ?? new Date().toISOString(),
          completed_at: new Date().toISOString(),
          receipt_url: row.proof_url,
          notes: `Reference ${row.payment_reference}`,
        };
        if (existingTransaction) Object.assign(existingTransaction, transaction);
        else {
          if (!db.transactions) db.transactions = [];
          db.transactions.push(transaction);
        }
      }
      return { data: [clone(row)], error: null };
    }
    if (fn === 'switch_ride_payment_to_cash') {
      const booking = db.bookings.find((row) => row.id === params?.p_booking_id);
      const me = currentProfile();
      const payment = (db.ride_payment_submissions ?? []).find((row) => row.booking_id === booking?.id);
      if (!booking || !me || booking.passenger_id !== me.id || booking.status === 'completed' || ['pending', 'verified'].includes(payment?.status)) {
        return { data: null, error: { message: 'Payment can no longer be changed for this ride.' } };
      }
      booking.payment_method = 'cash';
      return { data: [clone(booking)], error: null };
    }
    if (fn === 'submit_mtop_payment') {
      // Migration 086: payments are recorded by the office.
      return { data: null, error: { message: 'MTOP payments are recorded by the FEDTODAB office. Pay at the office and keep your official receipt.' } };
    }
    if (fn === 'record_mtop_payment') {
      const app = (db.franchise_applications ?? []).find((row) => row.id === params?.p_application_id);
      const me = currentProfile();
      if (!me || me.user_type !== 'admin') return { data: null, error: { message: 'Administrator permission required.' } };
      if (!app || app.status !== 'payment' || app.payment_status === 'paid') return { data: null, error: { message: 'This MTOP application is not waiting for payment.' } };
      if (!app.billing_sent_at && !app.selected_payment_methods) return { data: null, error: { message: 'Send the billing statement before recording the payment.' } };
      if (!(Number(params?.p_amount) >= Number(app.fees))) return { data: null, error: { message: `Record the full fee of PHP ${Number(app.fees).toFixed(2)} (partial payments are not accepted).` } };
      const reference = String(params?.p_reference || '').trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9 /_-]{2,63}$/.test(reference)) return { data: null, error: { message: 'Enter the OR or reference number (3 to 64 letters or digits).' } };
      if (!['cash', 'gcash', 'bank', 'check'].includes(params?.p_method)) return { data: null, error: { message: 'Choose how the payment was made.' } };
      const now = new Date().toISOString();
      Object.assign(app, {
        status: 'approved', payment_status: 'paid', payment_review_status: 'verified',
        payment_verified_at: now, payment_verified_by: me.id, payment_rejection_reason: null,
        payment_method: params.p_method, payment_reference: reference,
        payment_amount: Number(params.p_amount), payment_paid_on: params.p_paid_on,
        payment_recorded_by: me.id, updated_at: now,
      });
      verifyDriverForMtop(app);
      return { data: [clone(app)], error: null };
    }
    if (fn === 'submit_change_of_unit_request') {
      const app = (db.franchise_applications ?? []).find((row) => row.id === params?.p_application_id);
      const me = currentProfile();
      if (!app || !me || app.driver_id !== me.id || app.status !== 'issued' || app.cou_status === 'pending') {
        return { data: null, error: { message: 'Issued MTOP not found or a Change of Unit request is already pending.' } };
      }
      Object.assign(app, {
        cou_status: 'pending', cou_unit_type: params.p_unit_type,
        cou_new_plate: params.p_new_plate, cou_new_body: params.p_new_body,
        cou_or_number: params.p_or_number, cou_cr_number: params.p_cr_number,
        cou_vehicle_make: params.p_vehicle_make, cou_vehicle_model: params.p_vehicle_model,
        cou_or_image: params.p_or_image, cou_cr_image: params.p_cr_image,
        cou_unit_image: params.p_unit_image, cou_requested_at: new Date().toISOString(),
        cou_reviewed_at: null, cou_reviewed_by: null, cou_rejection_reason: null,
        updated_at: new Date().toISOString(),
      });
      return { data: [clone(app)], error: null };
    }
    if (fn === 'review_mtop_payment') {
      const app = (db.franchise_applications ?? []).find((row) => row.id === params?.p_application_id);
      const me = currentProfile();
      if (!app || !me || me.user_type !== 'admin' || app.payment_review_status !== 'pending_review') return { data: null, error: { message: 'Payment is not pending review.' } };
      if (params.p_decision === 'verified') Object.assign(app, { status: 'approved', payment_status: 'paid', payment_review_status: 'verified', payment_verified_at: new Date().toISOString(), payment_verified_by: me.id, payment_rejection_reason: null });
      else Object.assign(app, { payment_review_status: 'rejected', payment_rejection_reason: params.p_reason });
      verifyDriverForMtop(app);
      return { data: [clone(app)], error: null };
    }
    if (fn === 'request_dropoff_change') {
      const me = currentProfile();
      const booking = db.bookings.find((b) => b.id === params?.p_booking_id);
      const fail = (message: string) => ({ data: null, error: { message } });
      if (!booking || !me || booking.passenger_id !== me.id) return fail('Booking not found.');
      if (!['accepted', 'in-transit'].includes(booking.status) || !booking.driver_id) return fail('The drop-off can only be changed while your driver is on the way or during the ride.');
      if (paymentSent(booking)) return fail('A payment was already sent for this ride, so the drop-off and fare can no longer change. Ask your driver directly.');
      if (!db.booking_route_changes) db.booking_route_changes = [];
      const mine = db.booking_route_changes.filter((c) => c.booking_id === booking.id);
      if (mine.some((c) => c.status === 'pending')) return fail('Your driver has not answered your last drop-off change yet. Wait for it, or withdraw it first.');
      if (mine.length >= 5) return fail('You have reached the limit of 5 drop-off changes for this ride. Talk to your driver.');
      const loc = params?.p_location ?? {};
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail('Choose a valid drop-off on the map.');
      const next = { latitude: lat, longitude: lng, address: String(loc.address || 'Pinned destination').slice(0, 300), ...(loc.details ? { details: String(loc.details).slice(0, 120) } : {}) };
      if (kmBetween(booking.dropoff_location, next) < 0.05) return fail('That is the same drop-off as now. Choose a different place.');
      const driverAt = booking.status === 'in-transit' ? (db.driver_locations ?? []).find((d) => d.driver_id === booking.driver_id) : null;
      const via = driverAt ? { latitude: Number(driverAt.latitude), longitude: Number(driverAt.longitude) } : null;
      const straight = via ? kmBetween(booking.pickup_location, via) + kmBetween(via, next) : kmBetween(booking.pickup_location, next);
      let distance = Number(params?.p_distance);
      if (!Number.isFinite(distance) || distance < straight * 0.95 || distance > straight * 3 + 2) distance = straight;
      distance = round2(distance);
      const fare = routeChangeFare(booking, distance);
      const change = {
        id: genId('booking_route_changes'), booking_id: booking.id, requested_by: me.id, booking_status: booking.status,
        old_dropoff_location: clone(booking.dropoff_location), old_distance: booking.distance, old_total_fare: booking.total_fare,
        old_discount_amount: booking.discount_amount ?? 0, new_dropoff_location: next, new_distance: distance,
        new_total_fare: fare.total_fare, new_discount_amount: fare.discount_amount, new_estimated_duration: fare.estimated_duration,
        via_location: via, status: 'pending', decline_reason: null, requested_at: new Date().toISOString(), decided_at: null, decided_by: null,
      };
      db.booking_route_changes.push(change);
      notifyMock(booking.driver_id, 'Passenger wants a new drop-off', `New drop-off: ${next.address}. New fare ₱${fare.total_fare.toFixed(2)} (was ₱${Number(booking.total_fare).toFixed(2)}). Open the trip to accept or decline.`, booking.id);
      simulateDriverRouteAnswer(change.id);
      return { data: clone(change), error: null };
    }
    if (fn === 'respond_dropoff_change') {
      const me = currentProfile();
      const change = (db.booking_route_changes ?? []).find((c) => c.id === params?.p_change_id);
      const booking = change && db.bookings.find((b) => b.id === change.booking_id);
      if (!change || !booking || !me || booking.driver_id !== me.id) return { data: null, error: { message: 'Drop-off change not found.' } };
      if (change.status !== 'pending') return { data: null, error: { message: `This drop-off change was already ${change.status === 'cancelled' ? 'withdrawn by the passenger' : change.status}.` } };
      if (!params?.p_accept) {
        const reason = String(params?.p_reason ?? '').trim().slice(0, 300) || null;
        Object.assign(change, { status: 'declined', decline_reason: reason, decided_at: new Date().toISOString(), decided_by: me.id });
        notifyMock(booking.passenger_id, 'Drop-off change declined', `Your driver kept the original drop-off${reason ? ` (${reason})` : ''}. Fare stays ₱${Number(booking.total_fare).toFixed(2)}.`, booking.id);
        return { data: clone(booking), error: null };
      }
      if (!['accepted', 'in-transit'].includes(booking.status)) return { data: null, error: { message: 'This ride is no longer in progress.' } };
      if (paymentSent(booking)) return { data: null, error: { message: 'A payment was already sent for this ride, so the fare can no longer change. Decline the request and agree on it with the passenger.' } };
      applyRouteChange(change, booking, me.id);
      return { data: clone(booking), error: null };
    }
    if (fn === 'cancel_dropoff_change') {
      const me = currentProfile();
      const change = (db.booking_route_changes ?? []).find((c) => c.id === params?.p_change_id);
      const booking = change && db.bookings.find((b) => b.id === change.booking_id);
      if (!change || !booking || !me || booking.passenger_id !== me.id) return { data: null, error: { message: 'Drop-off change not found.' } };
      if (change.status !== 'pending') return { data: null, error: { message: 'Your driver already answered this drop-off change.' } };
      Object.assign(change, { status: 'cancelled', decided_at: new Date().toISOString(), decided_by: me.id });
      notifyMock(booking.driver_id, 'Drop-off change withdrawn', 'The passenger kept the original drop-off.', booking.id);
      return { data: clone(change), error: null };
    }
    return { data: [], error: null };
  },
  channel: (name: string) => {
    let entry = channels.get(name);
    if (!entry) {
      entry = { name, callbacks: [] };
      channels.set(name, entry);
    }
    const chan: any = {
      _name: name,
      on(_event: string, _filter: any, cb: (payload: any) => void) {
        entry!.callbacks.push(cb);
        return chan;
      },
      subscribe() {
        return chan;
      },
      unsubscribe() {
        channels.delete(name);
      },
    };
    return chan;
  },
  removeChannel: (chan: any) => {
    if (chan?._name) channels.delete(chan._name);
  },
};

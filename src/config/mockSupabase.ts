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
const REQUIRED_MTOP_DOCS = ['Barangay Clearance', 'Community Tax Certificate (Cedula)', 'OR/CR of Tricycle Unit', 'Proof of Ownership', 'TODA Membership Certificate'];
const mtopDocsApproved = (documents: any) => Array.isArray(documents) && REQUIRED_MTOP_DOCS.every((name) =>
  documents.some((doc: any) => doc.name === name && doc.uploaded && doc.file_url && doc.review_status === 'approved')
);

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
// Query builder
// ---------------------------------------------------------------------------
class QueryBuilder implements PromiseLike<Result> {
  private table: string;
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: any = null;
  private filters: Array<(row: Row) => boolean> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
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
        Object.assign(row, this.payload);
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
      if (this.limitN != null) data = data.slice(0, this.limitN);
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
      if (booking && row.status === 'verified') booking.payment_status = 'completed';
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
      const app = (db.franchise_applications ?? []).find((row) => row.id === params?.p_application_id);
      const me = currentProfile();
      if (!app || !me || app.driver_id !== me.id || app.status !== 'payment') return { data: null, error: { message: 'This application is not ready for payment.' } };
      if (['pending_review', 'verified'].includes(app.payment_review_status)) return { data: null, error: { message: 'A payment is already pending review or verified.' } };
      if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{5,63}$/.test(String(params?.p_reference || '').trim())
        || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(String(params?.p_proof_url || ''))) {
        return { data: null, error: { message: 'Valid payment proof and reference are required.' } };
      }
      Object.assign(app, { payment_method: params.p_method, payment_reference: params.p_reference, payment_proof_url: params.p_proof_url, payment_review_status: 'pending_review', payment_submitted_at: new Date().toISOString(), payment_rejection_reason: null });
      return { data: [clone(app)], error: null };
    }
    if (fn === 'review_mtop_payment') {
      const app = (db.franchise_applications ?? []).find((row) => row.id === params?.p_application_id);
      const me = currentProfile();
      if (!app || !me || me.user_type !== 'admin' || app.payment_review_status !== 'pending_review') return { data: null, error: { message: 'Payment is not pending review.' } };
      if (params.p_decision === 'verified') Object.assign(app, { status: 'approved', payment_status: 'paid', payment_review_status: 'verified', payment_verified_at: new Date().toISOString(), payment_verified_by: me.id, payment_rejection_reason: null });
      else Object.assign(app, { payment_review_status: 'rejected', payment_rejection_reason: params.p_reason });
      return { data: [clone(app)], error: null };
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

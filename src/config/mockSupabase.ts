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
type Result = { data: any; error: any };

const db: Record<string, Row[]> = buildSeedDatabase();

const genId = (table: string) => `${table}-${Math.random().toString(36).slice(2, 10)}`;
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

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
  private op: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  private payload: any = null;
  private filters: Array<(row: Row) => boolean> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private wantSelect = false;
  private isSingle = false;

  constructor(table: string) {
    this.table = table;
    if (!db[table]) db[table] = [];
  }

  // --- terminal-ish chainables ---
  select(_cols?: string) {
    this.wantSelect = true;
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

  // --- filters / modifiers ---
  eq(column: string, value: any) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: any[]) {
    this.filters.push((row) => values.includes(row[column]));
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
      rows.forEach((row) => Object.assign(row, this.payload));
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

    if (this.isSingle) {
      const first = Array.isArray(data) ? data[0] : data;
      if (first == null) {
        return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
      }
      return { data: clone(first), error: null };
    }

    // insert/update without an explicit .select() still resolve OK
    return { data: clone(data), error: null };
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
  async signUp({ email }: { email: string; password: string }) {
    const authId = `auth-${Math.random().toString(36).slice(2, 10)}`;
    currentAuthUser = { id: authId, email };
    return { data: { user: { id: authId, email }, session: { access_token: 'mock' } }, error: null };
  },
  async signInWithPassword({ email }: { email: string; password: string }) {
    const user = db.users.find((u) => u.email === email);
    if (!user) {
      return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
    }
    currentAuthUser = { id: user.id, email };
    return {
      data: { user: { id: user.id, email }, session: { access_token: 'mock' } },
      error: null,
    };
  },
  async signOut() {
    currentAuthUser = null;
    return { error: null };
  },
  async resetPasswordForEmail(_email: string) {
    return { data: {}, error: null };
  },
  async getUser() {
    return { data: { user: currentAuthUser }, error: null };
  },
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
export const mockSupabase: any = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  rpc: async (fn: string, params: any) => {
    if (fn === 'find_nearby_drivers') {
      const drivers = db.users.filter(
        (u) => u.user_type === 'driver' && u.current_status === 'online'
      );
      return { data: clone(drivers.slice(0, params?.radius_km ? drivers.length : drivers.length)), error: null };
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

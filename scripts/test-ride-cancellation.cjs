const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const toolkit = require('@reduxjs/toolkit');
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in dependencies)) throw Error(name); return dependencies[name]; } });
  return exports;
}
let row, failure;
const db = { from(table) {
  assert.equal(table, 'bookings'); // Cancellation must not write another user's profile.
  let patch, filters = [];
  const run = async () => {
    if (failure) return { data: null, error: failure };
    const match = row && filters.every(test => test(row));
    if (match && patch) Object.assign(row, patch);
    return { data: match ? { ...row } : null, error: null };
  };
  const query = { update(p) { patch = p; assert.deepEqual(JSON.parse(JSON.stringify(p)), { status: 'cancelled' }); return query; },
    select() { return query; }, eq(key, value) { filters.push(r => r[key] === value); return query; },
    in(key, values) { filters.push(r => values.includes(r[key])); return query; }, maybeSingle: run, single: run };
  return query;
} };
const { BookingRepository } = load('src/models/repositories/BookingRepository.ts', { '@/config/supabase': { supabase: db } });
const { BookingService } = load('src/models/services/BookingService.ts', {
  '@/models/repositories/BookingRepository': { BookingRepository },
  '@/models/repositories/UserRepository': { UserRepository: class { updateDriverStatus() { throw Error('Passenger cannot update driver'); } } },
  './FareCalculationService': { FareCalculationService: class {} }, './NotificationService': { NotificationService: class {} }, '@/config/supabase': { supabase: db },
});
const slice = load('src/controllers/slices/bookingSlice.ts', {
  '@reduxjs/toolkit': toolkit, '@/models/services/BookingService': { BookingService },
  '@/models/repositories/BookingRepository': { BookingRepository }, '@/models/services/ActivityLogService': { ActivityLogService: { logActivity() {} } },
});
(async () => {
  for (const method of ['cash', 'online']) {
    for (const status of ['pending', 'accepted']) {
      row = { id: 'ride', status, payment_method: method, payment_status: 'pending', driver_id: status === 'accepted' ? 'driver' : null };
      const original = { ...row };
      const store = toolkit.configureStore({ reducer: slice.default });
      store.dispatch(slice.createBooking.fulfilled(original, 'create', {}));
      store.dispatch(slice.fetchActiveBooking.pending('old-refresh', 'passenger'));
      await store.dispatch(slice.cancelBooking('ride')).unwrap();
      assert.equal(row.status, 'cancelled');
      assert.equal(row.payment_method, method);
      assert.equal(store.getState().currentBooking, null);
      store.dispatch(slice.updateBookingStatus(original));
      store.dispatch(slice.fetchActiveBooking.fulfilled(original, 'old-refresh', 'passenger'));
      assert.equal(store.getState().currentBooking, null, 'late realtime/poll/restore must not revive cancelled ride');
      assert.equal(store.getState().searchingForDriver, false);
      await store.dispatch(slice.cancelBooking('ride')).unwrap(); // idempotent retry
      console.log(`PASS ${method} ${status}: persisted cancellation, preserved payment, stale callbacks ignored, retry safe`);
    }
  }
  row = { id: 'ride', status: 'in-transit', payment_method: 'cash' };
  await assert.rejects(new BookingService().cancelBooking('ride'), /already started/);
  assert.equal(row.status, 'in-transit');
  row = { id: 'ride', status: 'accepted', payment_method: 'online' };
  const store = toolkit.configureStore({ reducer: slice.default });
  store.dispatch(slice.createBooking.fulfilled({ ...row }, 'create', {}));
  failure = { message: 'Permission denied' };
  await assert.rejects(store.dispatch(slice.cancelBooking('ride')).unwrap());
  assert.equal(store.getState().currentBooking.status, 'accepted');
  assert.equal(store.getState().error, 'Permission denied');
  failure = null;
  store.dispatch(slice.fetchActiveBooking.pending('refresh', 'passenger'));
  store.dispatch(slice.fetchActiveBooking.fulfilled(null, 'refresh', 'passenger'));
  assert.equal(store.getState().currentBooking, null, 'server absence clears stale homepage ride');
  store.dispatch(slice.createBooking.fulfilled({ id: 'new', status: 'pending', payment_method: 'cash' }, 'new-create', {}));
  store.dispatch(slice.cancelBooking.fulfilled({ id: 'old', status: 'cancelled', payment_method: 'online' }, 'old-cancel', 'old'));
  assert.equal(store.getState().currentBooking.id, 'new');
  assert.equal(store.getState().currentBooking.payment_method, 'cash');
  console.log('PASS pickup race blocked, failed cancellation retained with error, empty refresh clears homepage, old cancellation preserves new ride/payment');
})().catch(error => { console.error(error); process.exitCode = 1; });

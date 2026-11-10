// 089 senior / PWD / student: the accepting driver checks the physical ID and approves (offline mock).
// Run: npx sucrase-node scripts/test-discount-approval.ts
import { mockSupabase as db } from '../src/config/mockSupabase';
import { discountNeedsApproval } from '../src/config/constants';

const expect = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};
const login = async (email: string) => {
  const { error } = await db.auth.signInWithPassword({ email, password: 'test-only' });
  if (error) throw error;
};
const booking = async (id: string) => (await db.from('bookings').select('*').eq('id', id).single()).data as any;

const newBooking = async (id: string, type: 'senior' | 'pwd' | 'student', count = 1) => {
  // 2 km → 120 + 10 = 130 per passenger, regular fare until approved.
  await db.from('bookings').insert({
    id, passenger_id: 'demo-passenger', driver_id: null, status: 'pending',
    payment_method: 'cash', payment_status: 'pending', total_fare: 130 * count, distance: 2,
    base_fare: 120, per_km_rate: 10, peak_hour_multiplier: 1, passenger_count: count, ride_type: 'standard',
    passenger_type: type, discount_pct: 0, discount_amount: 0, discount_status: 'pending',
    pickup_location: { latitude: 13.4452, longitude: 121.8401, address: 'Pickup' },
    dropoff_location: { latitude: 13.4632, longitude: 121.8401, address: 'Drop' },
  });
};

const run = async () => {
  expect(discountNeedsApproval('senior') && discountNeedsApproval('pwd') && discountNeedsApproval('student'), 'senior, PWD and student need the driver');
  expect(!discountNeedsApproval('regular') && !discountNeedsApproval(null), 'regular fare does not');

  const id = `test-pwd-${Date.now()}`;
  await newBooking(id, 'pwd');

  await login('passenger@demo.com');
  await db.from('bookings').update({ driver_id: 'demo-driver', status: 'accepted' }).eq('id', id);
  const self = await db.rpc('review_booking_discount', { p_booking_id: id, p_approve: true });
  expect(!!self.error, 'passenger cannot approve their own ID');
  expect((await booking(id)).total_fare === 130, 'regular ₱130 until the driver decides');

  await login('driver@demo.com');
  const ok = await db.rpc('review_booking_discount', { p_booking_id: id, p_approve: true });
  expect(!ok.error && (ok.data as any).discount_status === 'approved', 'driver approves the physical ID');
  expect((ok.data as any).discount_reviewed_by === 'demo-driver', 'the approving driver is recorded');
  const after = await booking(id);
  expect(after.discount_amount === 26 && after.total_fare === 104 && after.discount_pct === 20, 'approved: ₱26 off, ₱104 to pay');
  const again = await db.rpc('review_booking_discount', { p_booking_id: id, p_approve: false, p_reason: 'x' });
  expect(!!again.error, 'a decided ID cannot be reviewed again');
  const notes = (await db.from('notifications').select('*').eq('booking_id', id)).data as any[];
  expect(notes.some((n) => n.user_id === 'demo-passenger' && /PWD discount approved/.test(n.title)), 'passenger is notified of the approval');
  await db.from('bookings').update({ status: 'completed' }).eq('id', id);

  const sid = `test-student-${Date.now()}`;
  await login('passenger@demo.com');
  await newBooking(sid, 'student', 2);
  await db.from('bookings').update({ driver_id: 'demo-driver', status: 'accepted' }).eq('id', sid);
  await login('driver@demo.com');
  const noReason = await db.rpc('review_booking_discount', { p_booking_id: sid, p_approve: false, p_reason: ' ' });
  expect(!!noReason.error, 'rejecting needs a reason');
  const rej = await db.rpc('review_booking_discount', { p_booking_id: sid, p_approve: false, p_reason: 'ID expired' });
  const r = await booking(sid);
  expect(!rej.error && r.discount_status === 'rejected' && r.total_fare === 260 && r.discount_amount === 0, 'rejected: regular ₱260 stays');
  expect(r.discount_revoked_reason === 'ID expired', 'the reason is shown to the passenger');
  await db.from('bookings').update({ status: 'completed' }).eq('id', sid);

  const sen = `test-senior-${Date.now()}`;
  await login('passenger@demo.com');
  await newBooking(sen, 'senior');
  expect((await booking(sen)).total_fare === 130, 'senior pays the regular ₱130 until approved');
  await db.from('bookings').update({ driver_id: 'demo-driver', status: 'accepted' }).eq('id', sen);
  await login('driver@demo.com');
  const sOk = await db.rpc('review_booking_discount', { p_booking_id: sen, p_approve: true });
  const s2 = await booking(sen);
  expect(!sOk.error && s2.total_fare === 104 && s2.discount_amount === 26, 'senior approved: ₱26 off, ₱104');
  const sNotes = (await db.from('notifications').select('*').eq('booking_id', sen)).data as any[];
  expect(sNotes.some((n) => /Senior citizen discount approved/.test(n.title)), 'senior is notified of the approval');
  await db.from('bookings').update({ status: 'completed' }).eq('id', sen);

  console.log('\nAll discount approval checks passed.');
};

run().catch((e) => { console.error(e); process.exit(1); });

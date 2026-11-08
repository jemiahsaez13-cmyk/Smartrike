// D7 drop-off change on the offline mock (mirrors migration 087).
// Run: npx sucrase-node scripts/test-dropoff-change.ts
import { mockSupabase as db } from '../src/config/mockSupabase';

const expect = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};
const login = async (email: string) => {
  const { error } = await db.auth.signInWithPassword({ email, password: 'test-only' });
  if (error) throw error;
};
const booking = async (id: string) => (await db.from('bookings').select('*').eq('id', id).single()).data;
const changes = async (id: string) =>
  (await db.from('booking_route_changes').select('*').eq('booking_id', id).order('requested_at', { ascending: false })).data;

const run = async () => {
  const id = `test-dropoff-${Date.now()}`;
  // Senior discount, 2 passengers: 2 km → (120 + 10) × 2 − 26 = 234.
  await db.from('bookings').insert({
    id, passenger_id: 'demo-passenger', driver_id: 'demo-driver', status: 'accepted',
    payment_method: 'cash', payment_status: 'pending', total_fare: 234, distance: 2,
    base_fare: 120, per_km_rate: 10, peak_hour_multiplier: 1, passenger_count: 2, ride_type: 'standard',
    passenger_type: 'senior', discount_pct: 20, discount_amount: 26,
    pickup_location: { latitude: 13.4452, longitude: 121.8401, address: 'Pickup' },
    dropoff_location: { latitude: 13.4632, longitude: 121.8401, address: 'Old drop' },
  });

  await login('ana@mail.com');
  const stranger = await db.rpc('request_dropoff_change', { p_booking_id: id, p_location: { latitude: 13.48, longitude: 121.84, address: 'X' } });
  expect(!!stranger.error, 'another passenger cannot change the drop-off');

  await login('passenger@demo.com');
  const same = await db.rpc('request_dropoff_change', { p_booking_id: id, p_location: { latitude: 13.4632, longitude: 121.8401, address: 'Same' } });
  expect(!!same.error, 'the same drop-off is refused');

  const req = await db.rpc('request_dropoff_change', {
    p_booking_id: id, p_location: { latitude: 13.4812, longitude: 121.8401, address: 'Purok 3, New drop', details: 'Purok 3' }, p_distance: 4.6,
  });
  // 4.6 km → 5 km: 160 per passenger × 2 − 32 = 288.
  expect(!req.error && req.data.status === 'pending' && req.data.new_total_fare === 288, 'request is priced with the booking rates and discount (₱288)');
  expect((await booking(id)).dropoff_location.address === 'Old drop', 'booking keeps its drop-off until the driver answers');
  const twice = await db.rpc('request_dropoff_change', { p_booking_id: id, p_location: { latitude: 13.49, longitude: 121.84, address: 'Y' } });
  expect(!!twice.error, 'only one request can wait at a time');

  const notPax = await db.rpc('respond_dropoff_change', { p_change_id: req.data.id, p_accept: true });
  expect(!!notPax.error, 'the passenger cannot accept their own request');

  await login('driver@demo.com');
  const declined = await db.rpc('respond_dropoff_change', { p_change_id: req.data.id, p_accept: false, p_reason: 'Too far' });
  expect(!declined.error && declined.data.total_fare === 234, 'driver declines: fare stays ₱234');
  expect((await changes(id))[0].decline_reason === 'Too far', 'decline reason is kept in the audit');

  await login('passenger@demo.com');
  const req2 = await db.rpc('request_dropoff_change', { p_booking_id: id, p_location: { latitude: 13.4362, longitude: 121.8401, address: 'Behind' }, p_distance: 2 });
  expect(!req2.error, 'passenger asks again after a decline');
  const withdrawn = await db.rpc('cancel_dropoff_change', { p_change_id: req2.data.id });
  expect(!withdrawn.error && withdrawn.data.status === 'cancelled', 'passenger withdraws a waiting request');

  const req3 = await db.rpc('request_dropoff_change', { p_booking_id: id, p_location: { latitude: 13.4362, longitude: 121.8401, address: 'Behind' }, p_distance: 2 });
  await login('driver@demo.com');
  const accepted = await db.rpc('respond_dropoff_change', { p_change_id: req3.data.id, p_accept: true });
  expect(!accepted.error && accepted.data.dropoff_location.address === 'Behind', 'driver accepts: booking takes the new drop-off');
  // 2 km: 130 × 2 − 26 = 234.
  expect(accepted.data.total_fare === 234 && accepted.data.distance === 2, 'accepted fare and distance are recomputed');
  const audit = (await changes(id)).map((c: any) => c.status).sort().join(',');
  expect(audit === 'accepted,cancelled,declined', `audit keeps every request (${audit})`);

  await db.from('ride_payment_submissions').insert({ id: `pay-${id}`, booking_id: id, status: 'pending' });
  await login('passenger@demo.com');
  const afterPay = await db.rpc('request_dropoff_change', { p_booking_id: id, p_location: { latitude: 13.5, longitude: 121.84, address: 'Z' } });
  expect(!!afterPay.error, 'no change once a ride payment was sent');
  await db.from('ride_payment_submissions').delete().eq('id', `pay-${id}`);

  // ── Online payment on an unfinished ride ────────────────────────────────
  const image = 'data:image/png;base64,AAAA';
  await login('driver@demo.com');
  const { data: method } = await db.from('driver_payment_methods').insert({
    driver_id: 'demo-driver', method_type: 'gcash', display_name: 'GCash', account_name: 'Test Driver',
    account_number: '09170000000', instructions: null, qr_code_url: image, is_enabled: true,
  }).select().single();
  const onlineId = `test-dropoff-online-${Date.now()}`;
  await db.from('bookings').insert({
    id: onlineId, passenger_id: 'demo-passenger', driver_id: 'demo-driver', status: 'in-transit',
    payment_method: 'online', payment_status: 'pending', total_fare: 130, distance: 2,
    base_fare: 120, per_km_rate: 10, peak_hour_multiplier: 1, passenger_count: 1, ride_type: 'standard',
    pickup_location: { latitude: 13.4452, longitude: 121.8401, address: 'Pickup' },
    dropoff_location: { latitude: 13.4632, longitude: 121.8401, address: 'Old drop' },
  });
  const far = { latitude: 13.4812, longitude: 121.8401, address: 'New drop' };

  await login('passenger@demo.com');
  const waiting = await db.rpc('request_dropoff_change', { p_booking_id: onlineId, p_location: far, p_distance: 4 });
  expect(!waiting.error, 'online, not paid yet: passenger may ask for a new drop-off');
  const payDuring = await db.rpc('submit_ride_payment', { p_booking_id: onlineId, p_method_id: method.id, p_reference: 'PAY-D7-0001', p_proof_url: image });
  expect(!!payDuring.error && /drop-off change/.test(payDuring.error.message), 'cannot pay the old fare while the driver decides');
  await login('driver@demo.com');
  const onlineAccepted = await db.rpc('respond_dropoff_change', { p_change_id: waiting.data.id, p_accept: true });
  expect(!onlineAccepted.error && onlineAccepted.data.total_fare === 150, 'driver accepts: online fare becomes ₱150');

  await login('passenger@demo.com');
  const paid = await db.rpc('submit_ride_payment', { p_booking_id: onlineId, p_method_id: method.id, p_reference: 'PAY-D7-0002', p_proof_url: image });
  expect(!paid.error && paid.data[0].status === 'pending', 'passenger pays the new fare online');
  const afterProof = await db.rpc('request_dropoff_change', { p_booking_id: onlineId, p_location: { latitude: 13.5, longitude: 121.84, address: 'Later' } });
  expect(!!afterProof.error && /payment was already sent/.test(afterProof.error.message), 'paid online (proof sent), ride unfinished: destination cannot change');

  await login('driver@demo.com');
  const verified = await db.rpc('review_ride_payment', { p_payment_id: paid.data[0].id, p_decision: 'verified', p_reason: null });
  expect(!verified.error, 'driver verifies the online payment');
  expect((await booking(onlineId)).status === 'in-transit', 'ride is still unfinished');
  await login('passenger@demo.com');
  const afterVerify = await db.rpc('request_dropoff_change', { p_booking_id: onlineId, p_location: { latitude: 13.5, longitude: 121.84, address: 'Later' } });
  expect(!!afterVerify.error && /payment was already sent/.test(afterVerify.error.message), 'paid online (verified), ride unfinished: destination cannot change');

  const auto = await db.rpc('request_dropoff_change', { p_booking_id: id, p_location: { latitude: 13.5, longitude: 121.84, address: 'Auto' } });
  expect(!auto.error, 'request for the offline demo driver');
  await new Promise((resolve) => setTimeout(resolve, 6500));
  expect((await booking(id)).dropoff_location.address === 'Auto', 'offline demo driver accepts on its own');
};

run().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });

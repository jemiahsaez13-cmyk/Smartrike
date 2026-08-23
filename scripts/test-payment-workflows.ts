import { mockSupabase as db } from '../src/config/mockSupabase';
import { ManagementReportService } from '../src/models/services/ManagementReportService';

const image = 'data:image/png;base64,AAAA';
const expect = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
};

const login = async (email: string) => {
  const { error } = await db.auth.signInWithPassword({ email, password: 'test-only' });
  if (error) throw error;
};

const run = async () => {
  const passengerEmail = `passenger-registration-${Date.now()}@example.com`;
  const passengerSignup = await db.auth.signUp({
    email: passengerEmail,
    password: 'StrongPass123',
    options: { data: { name: 'Passenger Registration Test', user_type: 'passenger' } },
  });
  expect(!passengerSignup.error && !!passengerSignup.data.session, 'passenger registration creates an immediately usable account session');
  await db.auth.signOut();
  const passengerLogin = await db.auth.signInWithPassword({ email: passengerEmail, password: 'StrongPass123' });
  expect(!passengerLogin.error && !!passengerLogin.data.session, 'passenger can log in after registration');

  const signupEmail = `registration-${Date.now()}@example.com`;
  const signup = await db.auth.signUp({
    email: signupEmail,
    password: 'StrongPass123',
    options: {
      data: {
        name: 'Pending Driver Test',
        user_type: 'driver',
        license_number: 'TEST-LICENSE',
        vehicle_details: { plate_number: 'TEST-REG' },
      },
    },
  });
  expect(!signup.error && !!signup.data.session, 'driver registration creates an immediately usable account session');
  const { data: pendingDriver } = await db.from('users').select('*').eq('auth_id', signup.data.user.id).single();
  expect(pendingDriver.verification_status === 'pending' && pendingDriver.current_status === 'offline', 'new driver remains pending and offline until admin verification');
  await db.auth.signOut();
  const pendingLogin = await db.auth.signInWithPassword({ email: signupEmail, password: 'StrongPass123' });
  expect(!pendingLogin.error && !!pendingLogin.data.session, 'pending driver can log in before admin approval');
  const pendingOnline = await db.from('users').update({ current_status: 'online' }).eq('id', pendingDriver.id).select().single();
  expect(!!pendingOnline.error, 'pending driver cannot go online before admin approval');
  await login('admin@demo.com');
  const approvedDriver = await db.from('users').update({ verification_status: 'verified' }).eq('id', pendingDriver.id).select().single();
  expect(!approvedDriver.error && approvedDriver.data.verification_status === 'verified', 'admin can approve a pending driver');
  await db.auth.signInWithPassword({ email: signupEmail, password: 'StrongPass123' });
  const approvedOnline = await db.from('users').update({ current_status: 'online' }).eq('id', pendingDriver.id).select().single();
  expect(!approvedOnline.error && approvedOnline.data.current_status === 'online', 'approved driver can go online');
  await login('admin@demo.com');
  const rejectedDriver = await db.from('users').update({ verification_status: 'rejected' }).eq('id', pendingDriver.id).select().single();
  expect(!rejectedDriver.error && rejectedDriver.data.current_status === 'offline', 'rejecting driver verification forces the driver offline');

  await login('driver@demo.com');
  const { data: method, error: methodError } = await db.from('driver_payment_methods').insert({
    driver_id: 'demo-driver', method_type: 'gcash', display_name: 'GCash',
    account_name: 'Test Driver', account_number: '09170000000', instructions: 'Use QR',
    qr_code_url: image, is_enabled: true,
  }).select().single();
  expect(!methodError && method?.driver_id === 'demo-driver', 'driver adds an owned online payment method');
  const { data: methodWithoutQr, error: optionalQrError } = await db.from('driver_payment_methods').insert({
    driver_id: 'demo-driver', method_type: 'bank', display_name: 'Test Bank',
    account_name: 'Test Driver', account_number: '1234567890', instructions: null,
    qr_code_url: null, is_enabled: true,
  }).select().single();
  expect(!optionalQrError && methodWithoutQr?.qr_code_url === null, 'driver adds a payment method without a QR code');

  const bookingId = `test-online-${Date.now()}`;
  await db.from('bookings').insert({
    id: bookingId, passenger_id: 'demo-passenger', driver_id: 'demo-driver', status: 'accepted',
    payment_method: 'online', payment_status: 'pending', total_fare: 180,
    pickup_location: { latitude: 13.4452, longitude: 121.8401, address: 'Pickup' },
    dropoff_location: { latitude: 13.4477, longitude: 121.8389, address: 'Dropoff' },
  });

  await login('passenger@demo.com');
  const visible = await db.rpc('get_ride_driver_payment_methods', { p_booking_id: bookingId });
  expect(!visible.error && visible.data.length === 2 && visible.data.every((row: any) => row.driver_id === 'demo-driver'), 'passenger sees only the assigned driver payment methods, including one without QR');

  const invalid = await db.rpc('submit_ride_payment', { p_booking_id: bookingId, p_method_id: method.id, p_reference: '', p_proof_url: '' });
  expect(!!invalid.error, 'missing ride proof and reference are rejected');
  const submitted = await db.rpc('submit_ride_payment', { p_booking_id: bookingId, p_method_id: method.id, p_reference: 'PAY-123456', p_proof_url: image });
  expect(!submitted.error && submitted.data[0].status === 'pending', 'passenger submits screenshot and reference for review');
  const duplicate = await db.rpc('submit_ride_payment', { p_booking_id: bookingId, p_method_id: method.id, p_reference: 'PAY-123457', p_proof_url: image });
  expect(!!duplicate.error, 'duplicate pending ride payment is rejected');

  await login('ana@mail.com');
  const unrelated = await db.rpc('get_ride_driver_payment_methods', { p_booking_id: bookingId });
  expect(!!unrelated.error, 'another passenger cannot access assigned driver credentials');

  await login('driver@demo.com');
  const verified = await db.rpc('review_ride_payment', { p_payment_id: submitted.data[0].id, p_decision: 'verified', p_reason: null });
  expect(!verified.error && verified.data[0].status === 'verified', 'assigned driver verifies passenger payment');
  const { data: paidBooking } = await db.from('bookings').select('*').eq('id', bookingId).single();
  expect(paidBooking.payment_status === 'completed', 'verified payment synchronizes the booking paid status');
  const { data: passengerHistory } = await db.from('transactions').select('*').eq('passenger_id', 'demo-passenger');
  expect(passengerHistory.some((transaction: any) => transaction.booking_id === bookingId && transaction.status === 'completed'), 'verified payment appears in passenger payment history');
  const repeatedReview = await db.rpc('review_ride_payment', { p_payment_id: submitted.data[0].id, p_decision: 'verified', p_reason: null });
  expect(!!repeatedReview.error, 'verified payment cannot be reviewed twice');

  const requiredDocs = ['Barangay Clearance', 'Community Tax Certificate (Cedula)', 'OR/CR of Tricycle Unit', 'Proof of Ownership', 'TODA Membership Certificate']
    .map((name) => ({ name, uploaded: true, file_url: image, review_status: 'approved' }));
  const mtopId = `test-mtop-${Date.now()}`;
  await db.from('franchise_applications').insert({
    id: mtopId, driver_id: 'demo-driver', driver_name: 'Test Driver', toda: 'FEDTODAB', plate_number: 'TEST-01',
    type: 'new', status: 'document_verification', documents: requiredDocs, payment_status: 'pending',
    payment_review_status: 'awaiting_submission', fees: 1500,
  });
  await login('admin@demo.com');
  const approvedDocs = await db.from('franchise_applications').update({ documents: requiredDocs, documents_verified_at: new Date().toISOString(), reviewed_by: 'demo-admin', status: 'payment' }).eq('id', mtopId).select().single();
  expect(!approvedDocs.error && approvedDocs.data.status === 'payment', 'approved MTOP files move directly to payment');
  const decline = await db.from('franchise_applications').update({ status: 'rejected' }).eq('id', mtopId).select().single();
  expect(!!decline.error, 'MTOP cannot be declined after file confirmation');
  await login('driver@demo.com');
  const invalidMtop = await db.rpc('submit_mtop_payment', { p_application_id: mtopId, p_method: 'in_person', p_reference: '', p_proof_url: '' });
  expect(!!invalidMtop.error, 'MTOP payment requires proof and reference');
  const mtopSubmitted = await db.rpc('submit_mtop_payment', { p_application_id: mtopId, p_method: 'in_person', p_reference: 'RECEIPT-123', p_proof_url: image });
  expect(!mtopSubmitted.error && mtopSubmitted.data[0].payment_review_status === 'pending_review', 'driver submits MTOP payment proof for admin review');
  await login('admin@demo.com');
  const mtopVerified = await db.rpc('review_mtop_payment', { p_application_id: mtopId, p_decision: 'verified', p_reason: null });
  expect(!mtopVerified.error && mtopVerified.data[0].status === 'approved' && mtopVerified.data[0].payment_status === 'paid', 'admin verification advances MTOP payment to approved');

  const addressId = `test-address-${Date.now()}`;
  await db.from('saved_addresses').insert({ id: addressId, user_id: 'demo-passenger', label: 'Pinned Home', full_address: 'Boac, Marinduque', latitude: 13.445211, longitude: 121.840122, is_default: false });
  const { data: reopenedAddress } = await db.from('saved_addresses').select('*').eq('id', addressId).single();
  expect(reopenedAddress.latitude === 13.445211 && reopenedAddress.longitude === 121.840122, 'saved address reopens with the exact confirmed pin');
  await db.from('saved_addresses').update({ latitude: 13.447701, longitude: 121.838901 }).eq('id', addressId);
  const { data: movedAddress } = await db.from('saved_addresses').select('*').eq('id', addressId).single();
  expect(movedAddress.latitude === 13.447701 && movedAddress.longitude === 121.838901, 'edited address preserves the moved pin coordinates');

  const placeId = `test-place-${Date.now()}`;
  await db.from('popular_places').insert({ id: placeId, name: 'Pinned Place', address: 'Boac', category: 'Place', icon: 'map-marker', latitude: 13.4463, longitude: 121.8408, sort_order: 99, is_active: true });
  await db.from('popular_places').update({ latitude: 13.4419, longitude: 121.8442 }).eq('id', placeId);
  const { data: movedPlace } = await db.from('popular_places').select('*').eq('id', placeId).single();
  expect(movedPlace.latitude === 13.4419 && movedPlace.longitude === 121.8442, 'popular place stores the map-selected pin after editing');

  const reportService = new ManagementReportService();
  for (const type of ['franchise_status', 'active_franchises', 'renewals', 'transfers', 'terminations', 'violations', 'inventory'] as const) {
    const report = await reportService.generate({ type, category: 'all', franchiseStatus: 'all' });
    expect(Array.isArray(report.rows) && !!report.title, `management report loads on the ${type} filter`);
  }
  let invalidDateRejected = false;
  try { await reportService.generate({ type: 'franchise_status', dateFrom: '2026-12-31', dateTo: '2026-01-01' }); }
  catch { invalidDateRejected = true; }
  expect(invalidDateRejected, 'management reports reject an invalid date range');

  console.log('Payment, map persistence, and report workflow checks completed.');
};

run().catch((error) => { console.error(error); process.exit(1); });

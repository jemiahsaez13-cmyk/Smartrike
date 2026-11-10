// D3 baggage declaration (migration 088): labels + the offline mock keeps it.
// Run: npx sucrase-node scripts/test-baggage-declaration.ts
import { baggageSummary, BAGGAGE_SIZES, MAX_BAGGAGE_COUNT } from '../src/config/constants';
import { mockSupabase as db } from '../src/config/mockSupabase';

const expect = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

expect(baggageSummary({ baggage_count: 1, baggage_size: 'large' }) === '1 bag · Large', 'one bag');
expect(baggageSummary({ baggage_count: 3, baggage_size: 'medium' }) === '3 bags · biggest is Medium', 'several bags');
expect(baggageSummary({ baggage_count: 0, baggage_size: null }) === null, 'no baggage shows nothing');
expect(baggageSummary({ baggage_count: 2, baggage_size: null }) === null, 'count without size shows nothing');
expect(baggageSummary({ baggage_count: 2, baggage_size: 'huge' }) === null, 'unknown size shows nothing');
expect(baggageSummary(null) === null && baggageSummary({}) === null, 'old bookings without the columns');
expect(BAGGAGE_SIZES.join(',') === 'small,medium,large' && MAX_BAGGAGE_COUNT === 10, 'sizes and limit match migration 088');

(async () => {
  const { data: passenger } = await db.from('users').select('*').eq('user_type', 'passenger').limit(1).maybeSingle();
  const { data, error } = await db.from('bookings').insert({
    passenger_id: (passenger as any)?.id ?? 'p-test',
    driver_id: null,
    pickup_location: { latitude: 13.45, longitude: 121.84, address: 'Boac' },
    dropoff_location: { latitude: 13.46, longitude: 121.85, address: 'Mogpog' },
    status: 'pending',
    distance: 1.5,
    total_fare: 50,
    passenger_count: 1,
    baggage_count: 2,
    baggage_size: 'large',
  }).select().single();
  expect(!error, 'mock booking with baggage is created');
  const { data: stored } = await db.from('bookings').select('*').eq('id', (data as any).id).single();
  expect((stored as any).baggage_count === 2 && (stored as any).baggage_size === 'large', 'driver reads the declared baggage');
  expect(Number((stored as any).total_fare) === 50, 'no extra charge on the fare');
  console.log('\nAll baggage checks passed.');
})().catch((e) => { console.error(e); process.exit(1); });

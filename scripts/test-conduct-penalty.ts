// 091: a penalty (warning, suspension, deactivation) closes the conduct flag;
// only records made after it count toward a new flag.
// Run: npx sucrase-node scripts/test-conduct-penalty.ts
/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';

// ConductService uses the app's "@/..." imports; point them at src/, and the
// Supabase client at the offline mock.
const Module = require('module');
const load = Module._load;
Module._load = function (request: string, ...rest: any[]) {
  if (request === '@/config/supabase') return { supabase: require('../src/config/mockSupabase').mockSupabase };
  if (request.startsWith('@/')) request = path.join(__dirname, '../src', request.slice(2));
  return load.call(this, request, ...rest);
};
const { summarizeConduct } = require('../src/models/services/ConductService') as typeof import('../src/models/services/ConductService');

const expect = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const now = new Date('2026-11-22T12:00:00+08:00');
const v = (user: string, day: string, created: string) => ({
  driver_id: user, passenger_id: null, status: 'confirmed' as const,
  incident_date: day, created_at: `${created}T09:00:00+08:00`,
});
const threeStrikes = (user: string) => [
  v(user, '2026-11-18', '2026-11-18'),
  v(user, '2026-11-19', '2026-11-19'),
  v(user, '2026-11-20', '2026-11-20'),
];
const c = (user: string, at: string) => ({ passenger_id: user, cancelled_at: `${at}T10:00:00+08:00` });

// No penalty: three confirmed violations in 7 days flag the account.
let s = summarizeConduct(threeStrikes('d1'), [], now).get('d1')!;
expect(s.flagged && s.confirmedViolations === 3, 'three strikes flag the account');

// Warning after the strikes: flag closes, count restarts at zero.
let p = new Map([['d1', { status: 'active', conduct_action_at: '2026-11-21T08:00:00+08:00' }]]);
s = summarizeConduct(threeStrikes('d1'), [], now, p).get('d1') ?? ({ flagged: false, confirmedViolations: 0 } as any);
expect(!s.flagged && s.confirmedViolations === 0, 'a warning closes the flag and restarts the count');

// Two new violations after the warning: counted, not yet flagged.
const later = [...threeStrikes('d1'), v('d1', '2026-11-21', '2026-11-21'), v('d1', '2026-11-22', '2026-11-22')];
s = summarizeConduct(later, [], now, p).get('d1')!;
expect(!s.flagged && s.confirmedViolations === 2, 'only violations recorded after the warning count');

// A third new one flags the account again.
s = summarizeConduct([...later, v('d1', '2026-11-22', '2026-11-22')], [], now, p).get('d1')!;
expect(s.flagged && s.confirmedViolations === 3, 'three new strikes after the warning flag it again');

// Suspended / deactivated: never flagged, whatever the count.
for (const status of ['suspended', 'deactivated']) {
  p = new Map([['d1', { status, conduct_action_at: null as any }]]);
  s = summarizeConduct(threeStrikes('d1'), [], now, p).get('d1')!;
  expect(!s.flagged, `a ${status} account is not flagged`);
}

// Passenger cancellations follow the same rule.
const cancels = [c('p1', '2026-11-18'), c('p1', '2026-11-19'), c('p1', '2026-11-20')];
expect(summarizeConduct([], cancels, now).get('p1')!.repeatedCancellations, 'three invalid cancellations flag a passenger');
p = new Map([['p1', { status: 'active', conduct_action_at: '2026-11-20T12:00:00+08:00' }]]);
s = summarizeConduct([], cancels, now, p).get('p1') ?? ({ repeatedCancellations: false, invalidCancellations: 0 } as any);
expect(!s.repeatedCancellations && s.invalidCancellations === 0, 'a warning closes the cancellation flag');

// Another user's penalty does not affect this one.
p = new Map([['other', { status: 'suspended', conduct_action_at: '2026-11-21T08:00:00+08:00' }]]);
expect(summarizeConduct(threeStrikes('d1'), [], now, p).get('d1')!.flagged, "another user's penalty leaves this flag on");

console.log('All conduct penalty checks passed.');

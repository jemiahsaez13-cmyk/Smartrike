const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in dependencies)) throw Error(name); return dependencies[name]; } });
  return exports;
}
const { summarizeConduct, conductWindowStart } = load('src/models/services/ConductService.ts', {
  '@/config/supabase': { supabase: {} },
  '@/config/constants': { CONDUCT_FLAG_THRESHOLD: 3, CONDUCT_WINDOW_DAYS: 7 },
});

const now = new Date(2026, 10, 1, 15, 0); // Nov 1, 3 PM local
const start = conductWindowStart(now);
assert.equal(start.getDate(), 26, 'rolling window covers today plus the 6 days before');
assert.equal(start.getHours(), 0);

const v = (status, incident_date, who = 'd1') => ({ driver_id: who, passenger_id: null, status, incident_date });
let tally = summarizeConduct([
  v('confirmed', '2026-11-01'), v('resolved', '2026-10-29'), v('confirmed', '2026-10-26'),
  v('open', '2026-10-31'), v('dismissed', '2026-10-31'), v('confirmed', '2026-10-25'),
], [], now);
assert.equal(tally.get('d1').confirmedViolations, 3, 'only confirmed/resolved inside the window count');
assert.equal(tally.get('d1').flagged, true);
console.log('PASS three confirmed violations in 7 days flags the user; open, dismissed and older ones do not count');

tally = summarizeConduct([v('confirmed', '2026-11-01'), v('confirmed', '2026-10-30')], [], now);
assert.equal(tally.get('d1').flagged, false);
console.log('PASS two confirmed violations do not flag');

const c = (cancelled_at, passenger_id = 'p1') => ({ passenger_id, cancelled_at });
tally = summarizeConduct([], [
  c(new Date(2026, 10, 1, 9).toISOString()), c(new Date(2026, 9, 28, 9).toISOString()),
  c(new Date(2026, 9, 26, 0, 30).toISOString()), c(new Date(2026, 9, 25, 23).toISOString()),
], now);
assert.equal(tally.get('p1').invalidCancellations, 3);
assert.equal(tally.get('p1').repeatedCancellations, true);
assert.equal(tally.get('p1').flagged, false, 'cancellations alone never count as confirmed violations');
console.log('PASS repeated invalid cancellations are surfaced separately from confirmed violations');

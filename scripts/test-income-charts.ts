// B8 income charts: Philippine-time bucketing for daily / monthly / yearly.
// Run: npx sucrase-node scripts/test-income-charts.ts
import {
  buildIncomeBuckets,
  compactPeso,
  incomeBucketKeys,
  incomeChange,
  incomeHistoryStart,
  incomeKey,
  incomeStats,
  niceCeil,
} from '../src/utils/incomeUtils';

const expect = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

// 2026-11-11 09:30 in Manila (01:30 UTC).
const now = new Date('2026-11-11T01:30:00Z');

// ── Keys ──
expect(incomeKey('2026-11-10T17:00:00Z', 'day') === '2026-11-11', 'UTC 17:00 is the next day in Manila');
expect(incomeKey('2026-11-10T15:59:00Z', 'day') === '2026-11-10', 'UTC 15:59 is still the same day in Manila');
expect(incomeKey('2026-11-05', 'day') === '2026-11-05', 'plain dates are taken as Manila dates');
expect(incomeKey('2026-12-31T16:30:00Z', 'year') === '2027', 'New Year flips at Manila midnight');

const days = incomeBucketKeys('day', now);
expect(days.length === 7 && days[0] === '2026-11-05' && days[6] === '2026-11-11', '7 daily buckets ending today');
const months = incomeBucketKeys('month', now);
expect(months.length === 12 && months[0] === '2025-12' && months[11] === '2026-11', '12 monthly buckets across the year boundary');
const years = incomeBucketKeys('year', now);
expect(years.join(',') === '2022,2023,2024,2025,2026', '5 yearly buckets');
expect(incomeBucketKeys('month', new Date('2026-03-31T04:00:00Z'))[10] === '2026-02', 'month stepping does not skip February on the 31st');

// ── Totals ──
const entries = [
  { at: '2026-11-11T00:10:00Z', amount: 50 },   // today
  { at: '2026-11-10T20:00:00Z', amount: 30 },   // today (04:00 Manila)
  { at: '2026-11-10T03:00:00Z', amount: 40 },   // yesterday
  { at: '2026-10-15', amount: 500 },            // last month (plain date)
  { at: '2025-11-20T05:00:00Z', amount: 1000 }, // last year
  { at: '2019-01-01T05:00:00Z', amount: 9999 }, // outside every range
  { at: '', amount: 77 },                       // no date: ignored
];
const daily = buildIncomeBuckets(entries, 'day', now);
expect(daily[6].total === 80 && daily[6].count === 2 && daily[6].label === 'Today', 'today = ₱80 from 2 entries');
expect(daily[5].total === 40 && daily[5].label === 'Yesterday', 'yesterday = ₱40');
expect(daily[4].label === 'Mon, Nov 9' && daily[4].shortLabel === 'Mon', 'older day labels');

const monthly = buildIncomeBuckets(entries, 'month', now);
expect(monthly[11].total === 120 && monthly[10].total === 500, 'Nov = ₱120, Oct = ₱500');
expect(monthly[11].label === 'November 2026' && monthly[0].shortLabel === 'Dec', 'month labels');

const yearly = buildIncomeBuckets(entries, 'year', now);
expect(yearly[4].total === 620 && yearly[3].total === 1000, '2026 = ₱620, 2025 = ₱1000');
expect(yearly.reduce((s, b) => s + b.total, 0) === 1620, '2019 and undated entries are left out');

// ── Comparison ──
const up = incomeChange(80, 40);
expect(up.diff === 40 && up.pct === 100, '+₱40 (+100%)');
const down = incomeChange(120, 500);
expect(down.diff === -380 && Math.round(down.pct!) === -76, '−₱380 (−76%)');
expect(incomeChange(50, 0).pct === null, 'no percentage when the period before is zero');

// ── Query start ──
expect(incomeHistoryStart(now) === '2021-12-31T16:00:00.000Z', 'history starts Jan 1 2022, Manila time');

console.log('\nAll income chart checks passed.');

// ── Axis, short pesos, stats (chart polish) ──
expect(niceCeil(80) === 100 && niceCeil(120) === 200 && niceCeil(2100) === 2500 && niceCeil(4999) === 5000, 'axis tops round up to 1/2/2.5/5/10 steps');
expect(niceCeil(0) === 1 && niceCeil(1000) === 1000, 'axis top edge cases');
expect(compactPeso(850) === '₱850' && compactPeso(1234) === '₱1.2k' && compactPeso(12500) === '₱13k' && compactPeso(1500000) === '₱1.5M', 'short pesos');
expect(compactPeso(1000) === '₱1k' && compactPeso(-400) === '−₱400', 'short pesos trim .0 and keep the sign');
const s7 = incomeStats(daily);
expect(s7.total === 120 && s7.count === 3 && s7.activeBuckets === 2, 'range total, count, active days');
expect(Math.abs(s7.average - 120 / 7) < 1e-9, 'average includes empty days');
expect(s7.best?.label === 'Today' && s7.best.total === 80, 'best day');
expect(incomeStats(buildIncomeBuckets([], 'day', now)).best === null, 'no best period without income');
console.log('All chart polish checks passed.');

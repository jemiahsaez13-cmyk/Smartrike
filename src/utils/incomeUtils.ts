/**
 * Income bucketing for the B8 income charts (admin MTOP collections, driver
 * trip earnings). Buckets follow the Philippine calendar (UTC+8) so "today",
 * "this month" and "this year" flip at Manila midnight on any device.
 */
import { phtDayKey } from './dateUtils';

export type IncomeView = 'day' | 'month' | 'year';

export interface IncomeEntry {
  /** ISO timestamp, or a plain YYYY-MM-DD date (taken as a Philippine date). */
  at: string;
  amount: number;
}

export interface IncomeBucket {
  /** YYYY-MM-DD, YYYY-MM or YYYY. */
  key: string;
  /** Under the bar: "Mon", "Nov", "2026". */
  shortLabel: string;
  /** Headline: "Today", "Mon, Nov 10", "November 2026", "2026". */
  label: string;
  total: number;
  count: number;
}

/** How many buckets each view shows, ending with the current one. */
export const INCOME_BUCKETS: Record<IncomeView, number> = { day: 7, month: 12, year: 5 };

/** What the previous bucket is called in the comparison line. */
export const PREVIOUS_LABEL: Record<IncomeView, string> = {
  day: 'the day before',
  month: 'the month before',
  year: 'the year before',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Philippine calendar date (YYYY-MM-DD) of an entry. */
export const incomeDayKey = (at: string): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : phtDayKey(at);

export const incomeKey = (at: string, view: IncomeView): string => {
  const day = incomeDayKey(at);
  return view === 'day' ? day : view === 'month' ? day.slice(0, 7) : day.slice(0, 4);
};

/** The bucket keys shown for a view, oldest first, ending with the current one. */
export const incomeBucketKeys = (view: IncomeView, now: Date = new Date()): string[] => {
  const today = phtDayKey(now);
  const count = INCOME_BUCKETS[view];
  const keys: string[] = [];
  if (view === 'day') {
    const base = new Date(`${today}T00:00:00Z`).getTime();
    for (let i = count - 1; i >= 0; i -= 1) keys.push(new Date(base - i * DAY_MS).toISOString().slice(0, 10));
  } else if (view === 'month') {
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7)) - 1;
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(year, month - i, 1));
      keys.push(d.toISOString().slice(0, 7));
    }
  } else {
    const year = Number(today.slice(0, 4));
    for (let i = count - 1; i >= 0; i -= 1) keys.push(String(year - i));
  }
  return keys;
};

const labelFor = (key: string, view: IncomeView, todayKey: string): { shortLabel: string; label: string } => {
  if (view === 'year') return { shortLabel: key, label: key };
  const month = MONTHS[Number(key.slice(5, 7)) - 1];
  if (view === 'month') return { shortLabel: month.slice(0, 3), label: `${month} ${key.slice(0, 4)}` };
  const weekday = WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];
  const yesterday = new Date(new Date(`${todayKey}T00:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10);
  const label = key === todayKey
    ? 'Today'
    : key === yesterday
    ? 'Yesterday'
    : `${weekday}, ${month.slice(0, 3)} ${Number(key.slice(8, 10))}`;
  return { shortLabel: weekday, label };
};

/** Totals per bucket for the view (oldest first; the last one is the current period). */
export const buildIncomeBuckets = (
  entries: IncomeEntry[],
  view: IncomeView,
  now: Date = new Date()
): IncomeBucket[] => {
  const todayKey = phtDayKey(now);
  const buckets = incomeBucketKeys(view, now).map((key) => ({
    key,
    ...labelFor(key, view, todayKey),
    total: 0,
    count: 0,
  }));
  const index = new Map(buckets.map((bucket, i) => [bucket.key, i]));
  for (const entry of entries) {
    const amount = Number(entry.amount) || 0;
    if (!entry.at) continue;
    const i = index.get(incomeKey(entry.at, view));
    if (i === undefined) continue;
    buckets[i].total += amount;
    buckets[i].count += 1;
  }
  return buckets;
};

/** Change from the previous bucket; pct is null when the previous one is zero. */
export const incomeChange = (current: number, previous: number): { diff: number; pct: number | null } => ({
  diff: current - previous,
  pct: previous > 0 ? ((current - previous) / previous) * 100 : null,
});

/** Start of the oldest year bucket (Jan 1, PHT) as an ISO instant, for queries. */
export const incomeHistoryStart = (now: Date = new Date()): string => {
  const year = Number(phtDayKey(now).slice(0, 4)) - (INCOME_BUCKETS.year - 1);
  return new Date(`${year}-01-01T00:00:00+08:00`).toISOString();
};

/** Round up to a readable axis top: 1, 2, 2.5, 5 or 10 × a power of ten. */
export const niceCeil = (n: number): number => {
  if (!(n > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n) ?? 10;
  return step * pow;
};

/** Short peso for axis ticks and bar labels: ₱850, ₱1.2k, ₱12k, ₱1.5M. */
export const compactPeso = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const trim = (v: number) => (v >= 10 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ''));
  if (abs >= 1000000) return `${sign}₱${trim(abs / 1000000)}M`;
  if (abs >= 1000) return `${sign}₱${trim(abs / 1000)}k`;
  return `${sign}₱${Math.round(abs)}`;
};

export interface IncomeStats {
  total: number;
  count: number;
  /** Per bucket across the whole range, empty buckets included. */
  average: number;
  /** Highest-earning bucket; null when the range has no income. */
  best: IncomeBucket | null;
  /** Buckets that earned anything. */
  activeBuckets: number;
}

export const incomeStats = (buckets: IncomeBucket[]): IncomeStats => {
  const total = buckets.reduce((sum, b) => sum + b.total, 0);
  const best = buckets.reduce<IncomeBucket | null>((top, b) => (b.total > 0 && (!top || b.total > top.total) ? b : top), null);
  return {
    total,
    count: buckets.reduce((sum, b) => sum + b.count, 0),
    average: buckets.length ? total / buckets.length : 0,
    best,
    activeBuckets: buckets.filter((b) => b.total > 0).length,
  };
};

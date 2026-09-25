// Supabase/PostgREST caps every response at 1000 rows by default, so admin
// totals, analytics and broadcasts silently stopped counting past that point.

const PAGE_SIZE = 1000;

/**
 * Reads every row of a query by paging with `.range()`. `build` must return a
 * fresh query each call and should include a stable `.order()` so pages do
 * not overlap. The offline mock has no row cap, so a single request suffices.
 */
export async function fetchAllRows<T>(build: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = build();
    const { data, error } = typeof query.range === 'function'
      ? await query.range(from, from + PAGE_SIZE - 1)
      : await query;
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE || typeof query.range !== 'function') return rows;
  }
}

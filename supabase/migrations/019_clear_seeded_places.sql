-- =============================================================================
-- 019 · Start Popular Places empty
-- -----------------------------------------------------------------------------
-- Migration 018 seeded seven sample destinations. The platform should instead
-- start with NO popular places, so passengers only ever see what an admin has
-- actually added in the console. This removes the seed rows. Admin-added places
-- are unaffected on re-run (the seed used fixed names; we only clear those).
-- Idempotent: safe to run more than once.
-- =============================================================================

DELETE FROM public.popular_places
WHERE name IN (
  'Boac Cathedral',
  'Boac Poblacion',
  'Marinduque State University',
  'Gasan Public Market',
  'Santa Cruz Municipal Hall',
  'Buenavista Town Plaza',
  'Mount Malindig'
);

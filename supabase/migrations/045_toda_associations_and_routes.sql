-- =============================================================================
-- 045 · TODA Associations and Routes (Module 9)
--
-- Creates:
--   toda_associations  — registered TODAs in Boac (name, area, contact info)
--   toda_routes        — point-to-point fares per barangay pair per TODA
--
-- Idempotent and safe to re-run.
-- =============================================================================

-- ── toda_associations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.toda_associations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  area          VARCHAR(180),          -- general service area description
  contact_name  VARCHAR(120),          -- president / authorized rep
  contact_phone VARCHAR(30),
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT toda_associations_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_toda_associations_active
  ON public.toda_associations(is_active);

ALTER TABLE public.toda_associations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage toda associations" ON public.toda_associations;
CREATE POLICY "Admins manage toda associations" ON public.toda_associations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users read toda associations" ON public.toda_associations;
CREATE POLICY "Authenticated users read toda associations" ON public.toda_associations
  FOR SELECT TO authenticated
  USING (TRUE);

-- ── toda_routes ──────────────────────────────────────────────────────────────
-- Stores point-to-point fares between barangay pairs for a given TODA.
-- from_barangay / to_barangay are barangay names (Boac scope).
-- fare is in PHP (e.g. 15.00). Routes are directional but the app treats them
-- symmetrically (A→B == B→A) at query time.
CREATE TABLE IF NOT EXISTS public.toda_routes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toda_id         UUID NOT NULL REFERENCES public.toda_associations(id) ON DELETE CASCADE,
  from_barangay   VARCHAR(120) NOT NULL,
  to_barangay     VARCHAR(120) NOT NULL,
  fare            NUMERIC(8, 2) NOT NULL CHECK (fare >= 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT toda_routes_unique_pair
    UNIQUE (toda_id, from_barangay, to_barangay)
);

CREATE INDEX IF NOT EXISTS idx_toda_routes_toda
  ON public.toda_routes(toda_id);
CREATE INDEX IF NOT EXISTS idx_toda_routes_from
  ON public.toda_routes(from_barangay);

ALTER TABLE public.toda_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage toda routes" ON public.toda_routes;
CREATE POLICY "Admins manage toda routes" ON public.toda_routes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users read toda routes" ON public.toda_routes;
CREATE POLICY "Authenticated users read toda routes" ON public.toda_routes
  FOR SELECT TO authenticated
  USING (TRUE);

-- ── Realtime ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.toda_associations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.toda_routes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- =============================================================================
-- 035 · Passenger capacity + franchise registry + association inventory/reports
--
-- Adds persisted passenger headcount/fare metadata, the operational franchise
-- lifecycle requested by TODA/LGU, printable-agreement source records,
-- association inventory, driver violations, and a privacy-safe passenger RPC.
-- Idempotent and safe to re-run.
-- =============================================================================

-- ── Passenger booking details ───────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS passenger_count INTEGER NOT NULL DEFAULT 1
    CHECK (passenger_count BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS ride_type VARCHAR(20) NOT NULL DEFAULT 'standard'
    CHECK (ride_type IN ('standard', 'priority'));

-- ── Operational franchise registry (separate from application workflow) ────
ALTER TABLE public.franchise_applications
  ADD COLUMN IF NOT EXISTS body_number VARCHAR(30),
  ADD COLUMN IF NOT EXISTS franchise_status VARCHAR(30)
    CHECK (franchise_status IN ('active', 'expired', 'terminated', 'pending_renewal', 'transferred')),
  ADD COLUMN IF NOT EXISTS original_holder_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS current_holder_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS issued_at DATE,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS last_renewed_at DATE,
  ADD COLUMN IF NOT EXISTS renewal_year INTEGER;

UPDATE public.franchise_applications
SET franchise_status = COALESCE(franchise_status, 'active'),
    original_holder_name = COALESCE(original_holder_name, driver_name),
    current_holder_name = COALESCE(current_holder_name, driver_name),
    issued_at = COALESCE(issued_at, updated_at::date)
WHERE status = 'issued';

CREATE UNIQUE INDEX IF NOT EXISTS idx_franchise_body_number
  ON public.franchise_applications(toda, body_number)
  WHERE body_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_franchise_record_status
  ON public.franchise_applications(franchise_status);

CREATE TABLE IF NOT EXISTS public.franchise_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES public.franchise_applications(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL
    CHECK (event_type IN ('renewal', 'succession_transfer', 'third_party_transfer', 'termination')),
  from_holder VARCHAR(255),
  to_holder VARCHAR(255),
  relationship VARCHAR(40)
    CHECK (relationship IS NULL OR relationship IN ('spouse', 'unmarried_eldest_child', 'third_party')),
  reason TEXT,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  agreement_number VARCHAR(80),
  agreement_text TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_franchise_events_franchise ON public.franchise_events(franchise_id);
CREATE INDEX IF NOT EXISTS idx_franchise_events_type_date ON public.franchise_events(event_type, effective_date DESC);

ALTER TABLE public.franchise_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage franchise events" ON public.franchise_events;
CREATE POLICY "Admins manage franchise events" ON public.franchise_events
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Drivers view own franchise events" ON public.franchise_events;
CREATE POLICY "Drivers view own franchise events" ON public.franchise_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.franchise_applications fa
      WHERE fa.id = franchise_id AND fa.driver_id = public.current_app_user_id()
    )
  );

-- ── Driver association inventory ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.association_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name VARCHAR(180) NOT NULL,
  category VARCHAR(30) NOT NULL DEFAULT 'other'
    CHECK (category IN ('supplies', 'equipment', 'safety', 'office', 'other')),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  issued_quantity INTEGER NOT NULL DEFAULT 0 CHECK (issued_quantity >= 0),
  remaining_stock INTEGER NOT NULL DEFAULT 0 CHECK (remaining_stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'in_stock'
    CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock', 'damaged')),
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (issued_quantity <= quantity),
  CHECK (remaining_stock = quantity - issued_quantity)
);
CREATE INDEX IF NOT EXISTS idx_inventory_category_status
  ON public.association_inventory(category, status);

ALTER TABLE public.association_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage association inventory" ON public.association_inventory;
CREATE POLICY "Admins manage association inventory" ON public.association_inventory
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── Driver violations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchise_applications(id) ON DELETE SET NULL,
  violation_type VARCHAR(120) NOT NULL,
  description TEXT,
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  penalty TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_driver_violations_driver_date
  ON public.driver_violations(driver_id, incident_date DESC);

ALTER TABLE public.driver_violations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage driver violations" ON public.driver_violations;
CREATE POLICY "Admins manage driver violations" ON public.driver_violations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Drivers view own violations" ON public.driver_violations;
CREATE POLICY "Drivers view own violations" ON public.driver_violations
  FOR SELECT TO authenticated USING (driver_id = public.current_app_user_id());

-- ── Privacy-safe fields shown only to a matched passenger, driver, or admin ─
CREATE OR REPLACE FUNCTION public.get_driver_public_franchise(p_driver_id UUID)
RETURNS TABLE (
  driver_id UUID,
  mtop_number VARCHAR,
  body_number VARCHAR,
  plate_number VARCHAR,
  franchise_status VARCHAR,
  current_holder_name VARCHAR,
  expiry_date DATE,
  last_renewed_at DATE,
  renewal_year INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR public.current_app_user_id() = p_driver_id
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.driver_id = p_driver_id
        AND b.passenger_id = public.current_app_user_id()
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    fa.driver_id,
    fa.mtop_number::VARCHAR,
    fa.body_number::VARCHAR,
    fa.plate_number::VARCHAR,
    (CASE
      WHEN COALESCE(fa.franchise_status, 'active') NOT IN ('terminated', 'transferred', 'pending_renewal')
           AND fa.expiry_date IS NOT NULL AND fa.expiry_date < CURRENT_DATE THEN 'expired'
      ELSE COALESCE(fa.franchise_status, 'active')
    END)::VARCHAR,
    COALESCE(fa.current_holder_name, fa.driver_name)::VARCHAR,
    fa.expiry_date,
    fa.last_renewed_at,
    fa.renewal_year
  FROM public.franchise_applications fa
  WHERE fa.driver_id = p_driver_id
    AND (fa.status = 'issued' OR fa.mtop_number IS NOT NULL)
  ORDER BY fa.updated_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_driver_public_franchise(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_driver_public_franchise(UUID) TO authenticated;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.franchise_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.association_inventory; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_violations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

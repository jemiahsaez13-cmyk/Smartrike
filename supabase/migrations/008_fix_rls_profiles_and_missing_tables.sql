-- =============================================================================
-- 008 · Corrective migration for real Supabase auth + data layer
-- -----------------------------------------------------------------------------
-- Fixes the issues that prevented the app from working against a real backend:
--   1. Infinite-recursion RLS on the `users` admin policy (a policy on `users`
--      that itself SELECTs from `users`). Replaced with SECURITY DEFINER helpers.
--   2. Admin policies on activity_logs / system_health compared `users.id` to
--      `auth.uid()` (wrong column — auth.uid() is the auth_id).
--   3. Profile rows were created client-side after auth.signUp(), which fails
--      under RLS when there is no session yet (email confirmation). Replaced
--      with an auth.users INSERT trigger that creates the profile server-side.
--   4. `transactions` and `franchise_applications` tables were referenced by
--      the app but never created. Added here with matching columns + RLS.
--   5. Added the missing INSERT/UPDATE policies the app needs (notifications,
--      messages, passenger booking cancel, driver accept of pending bookings).
--
-- Idempotent: safe to run more than once.
-- =============================================================================

-- ── Helper functions (SECURITY DEFINER → bypass RLS, no recursion) ───────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND user_type = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ── Auto-create the public profile when an auth user is created ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta   jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  v_type text  := COALESCE(NULLIF(meta->>'user_type', ''), 'passenger');
BEGIN
  INSERT INTO public.users (
    auth_id, email, name, phone, user_type, status, rating, total_trips,
    license_number, toda_membership, vehicle_details, verification_status
  ) VALUES (
    new.id,
    new.email,
    COALESCE(NULLIF(meta->>'name', ''), split_part(new.email, '@', 1)),
    NULLIF(meta->>'phone', ''),
    v_type,
    'active',
    5.0,
    0,
    NULLIF(meta->>'license_number', ''),
    NULLIF(meta->>'toda_membership', ''),
    CASE WHEN meta ? 'vehicle_details' THEN meta->'vehicle_details' ELSE NULL END,
    CASE WHEN v_type = 'driver' THEN 'pending' ELSE NULL END
  )
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── USERS: fix recursive admin policy ────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage all users" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "Users insert own profile" ON public.users;

CREATE POLICY "Users insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Admins manage all users" ON public.users
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── BOOKINGS: admin view + passenger cancel + driver accept of pending ───────
DROP POLICY IF EXISTS "Admins view all bookings" ON public.bookings;
CREATE POLICY "Admins view all bookings" ON public.bookings
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Passengers update own bookings" ON public.bookings;
CREATE POLICY "Passengers update own bookings" ON public.bookings
  FOR UPDATE USING (passenger_id = public.current_app_user_id())
  WITH CHECK (passenger_id = public.current_app_user_id());

-- Drivers must be able to see still-pending requests in order to accept them.
DROP POLICY IF EXISTS "Drivers view pending bookings" ON public.bookings;
CREATE POLICY "Drivers view pending bookings" ON public.bookings
  FOR SELECT USING (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.users
                WHERE auth_id = auth.uid() AND user_type = 'driver')
  );

-- Accepting a pending booking sets driver_id to the accepting driver.
DROP POLICY IF EXISTS "Drivers accept pending bookings" ON public.bookings;
CREATE POLICY "Drivers accept pending bookings" ON public.bookings
  FOR UPDATE USING (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.users
                WHERE auth_id = auth.uid() AND user_type = 'driver')
  )
  WITH CHECK (driver_id = public.current_app_user_id());

-- ── NOTIFICATIONS: allow authenticated users to create them ──────────────────
DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
CREATE POLICY "Authenticated insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── MESSAGES: booking participants can send messages ─────────────────────────
DROP POLICY IF EXISTS "Participants insert messages" ON public.messages;
CREATE POLICY "Participants insert messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.passenger_id = public.current_app_user_id()
             OR b.driver_id = public.current_app_user_id())
    )
  );

-- ── FARE MATRIX: readable by any authenticated user ──────────────────────────
ALTER TABLE public.fare_matrix ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read fare matrix" ON public.fare_matrix;
CREATE POLICY "Authenticated read fare matrix" ON public.fare_matrix
  FOR SELECT TO authenticated USING (true);

-- ── ACTIVITY LOGS / SYSTEM HEALTH: fix admin checks (use is_admin) ───────────
DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
CREATE POLICY "Admins can view all logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view their own logs" ON public.activity_logs;
CREATE POLICY "Users can view their own logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Admins can view system health" ON public.system_health;
CREATE POLICY "Admins can view system health" ON public.system_health
  FOR SELECT TO authenticated USING (public.is_admin());

-- =============================================================================
-- TRANSACTIONS (referenced by TransactionRepository — was never created)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  passenger_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  driver_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount         DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'
                 CHECK (payment_method IN ('cash', 'gcash', 'paymaya')),
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'completed', 'failed')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  receipt_url    TEXT,
  notes          TEXT
);
CREATE INDEX IF NOT EXISTS idx_transactions_booking_id ON public.transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_passenger_id ON public.transactions(passenger_id);
CREATE INDEX IF NOT EXISTS idx_transactions_driver_id ON public.transactions(driver_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants view transactions" ON public.transactions;
CREATE POLICY "Participants view transactions" ON public.transactions
  FOR SELECT TO authenticated USING (
    passenger_id = public.current_app_user_id()
    OR driver_id = public.current_app_user_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Participants insert transactions" ON public.transactions;
CREATE POLICY "Participants insert transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (
    passenger_id = public.current_app_user_id()
    OR driver_id = public.current_app_user_id()
  );

DROP POLICY IF EXISTS "Participants update transactions" ON public.transactions;
CREATE POLICY "Participants update transactions" ON public.transactions
  FOR UPDATE TO authenticated USING (
    passenger_id = public.current_app_user_id()
    OR driver_id = public.current_app_user_id()
    OR public.is_admin()
  );

-- =============================================================================
-- FRANCHISE APPLICATIONS (MTOP — referenced by FranchiseRepository/Service)
-- Columns match the app's FranchiseApplication entity.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.franchise_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  driver_name       VARCHAR(255),
  toda              VARCHAR(100),
  plate_number      VARCHAR(20),
  type              VARCHAR(20) NOT NULL DEFAULT 'new'
                    CHECK (type IN ('new', 'renewal')),
  status            VARCHAR(30) NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'document_verification',
                                      'inspection', 'payment', 'approved',
                                      'issued', 'rejected')),
  documents         JSONB,
  inspection_result VARCHAR(20)
                    CHECK (inspection_result IN ('pending', 'passed', 'failed')),
  payment_status    VARCHAR(20) DEFAULT 'pending'
                    CHECK (payment_status IN ('pending', 'paid')),
  fees              DECIMAL(10,2),
  mtop_number       VARCHAR(50),
  remarks           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_franchise_driver_id ON public.franchise_applications(driver_id);
CREATE INDEX IF NOT EXISTS idx_franchise_status ON public.franchise_applications(status);

ALTER TABLE public.franchise_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers view own franchise" ON public.franchise_applications;
CREATE POLICY "Drivers view own franchise" ON public.franchise_applications
  FOR SELECT TO authenticated USING (
    driver_id = public.current_app_user_id() OR public.is_admin()
  );

DROP POLICY IF EXISTS "Drivers submit franchise" ON public.franchise_applications;
CREATE POLICY "Drivers submit franchise" ON public.franchise_applications
  FOR INSERT TO authenticated WITH CHECK (
    driver_id = public.current_app_user_id()
  );

DROP POLICY IF EXISTS "Drivers update own franchise" ON public.franchise_applications;
CREATE POLICY "Drivers update own franchise" ON public.franchise_applications
  FOR UPDATE TO authenticated USING (
    driver_id = public.current_app_user_id() OR public.is_admin()
  );

-- ── Realtime: ensure the tables the app subscribes to are published ──────────
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

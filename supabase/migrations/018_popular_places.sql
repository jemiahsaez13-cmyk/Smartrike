-- =============================================================================
-- 018 · Admin-managed Popular Places
-- -----------------------------------------------------------------------------
-- Moves the passenger "Popular Places" list out of hardcoded app config and into
-- the database so admins can add / edit / remove destinations (with a photo and
-- details) and have them appear instantly in the passenger app.
--
--   • Everyone signed in can read ACTIVE places.
--   • Admins can manage every place (is_admin() helper, migration 008).
--   • Published to realtime so passenger lists update live.
--   • Seeded with the seven real Boac/Marinduque destinations + photos.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.popular_places (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120) NOT NULL,
  address     VARCHAR(200),
  category    VARCHAR(40) NOT NULL DEFAULT 'Place',
  icon        VARCHAR(60) NOT NULL DEFAULT 'map-marker',
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  image_url   TEXT,                       -- base64 data-URI or https URL
  details     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_popular_places_active ON public.popular_places(is_active, sort_order);

ALTER TABLE public.popular_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads active places" ON public.popular_places;
CREATE POLICY "Anyone reads active places" ON public.popular_places
  FOR SELECT TO authenticated USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage places" ON public.popular_places;
CREATE POLICY "Admins manage places" ON public.popular_places
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Live updates for the passenger app.
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.popular_places; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ── Seed the real destinations (only if the table is empty) ───────────────────
INSERT INTO public.popular_places (name, address, category, icon, latitude, longitude, image_url, sort_order)
SELECT * FROM (VALUES
  ('Boac Cathedral', 'Immaculate Conception Parish, Boac', 'Landmark', 'church', 13.4477, 121.8389,
   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Boac_cathedral%2C_Marinduque.jpg/640px-Boac_cathedral%2C_Marinduque.jpg', 1),
  ('Boac Poblacion', 'Town center & public market, Boac', 'Town Center', 'city-variant-outline', 13.4452, 121.8401,
   'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Marinduque_2.JPG/640px-Marinduque_2.JPG', 2),
  ('Marinduque State University', 'Tanza, Boac', 'School', 'school-outline', 13.4101, 121.8456,
   'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Marinduque_State_College.JPG/640px-Marinduque_State_College.JPG', 3),
  ('Gasan Public Market', 'Gasan town proper', 'Market', 'storefront-outline', 13.3236, 121.8694,
   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Gasan_skyline.jpg/640px-Gasan_skyline.jpg', 4),
  ('Santa Cruz Municipal Hall', 'Poblacion, Santa Cruz', 'Government', 'bank-outline', 13.4767, 122.0267,
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Municipal_Hall_of_Santa_Cruz%2C_Marinduque.jpg/640px-Municipal_Hall_of_Santa_Cruz%2C_Marinduque.jpg', 5),
  ('Buenavista Town Plaza', 'Poblacion, Buenavista', 'Town Center', 'town-hall', 13.2606, 121.9436,
   'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Municipality_Of_Buenavista.jpg/640px-Municipality_Of_Buenavista.jpg', 6),
  ('Mount Malindig', 'Torrijos / Buenavista boundary', 'Nature', 'image-filter-hdr', 13.2419, 122.0203,
   'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Malindigsun2.jpg/640px-Malindigsun2.jpg', 7)
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM public.popular_places);

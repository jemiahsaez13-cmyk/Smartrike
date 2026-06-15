-- ── Allow new users to insert their own profile row on signup ──
-- Without this, AuthService.signUp() fails after auth.signUp() succeeds
-- because RLS blocks the INSERT with the user's JWT.
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth_id = auth.uid());

-- ── Allow bookings INSERT for passengers ───────────────────────
-- The existing policy only covers SELECT; passengers need to create bookings.
CREATE POLICY "passengers_insert_bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    passenger_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid() AND user_type = 'passenger'
    )
  );

-- ── Realtime ───────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

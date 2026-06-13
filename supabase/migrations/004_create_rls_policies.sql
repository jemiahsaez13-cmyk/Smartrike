ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON users FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Users update own profile" ON users FOR UPDATE USING (auth.uid() = auth_id);
CREATE POLICY "Admins manage all users" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth.uid() = auth_id AND user_type = 'admin')
);

CREATE POLICY "Passengers view own bookings" ON bookings FOR SELECT USING (
  passenger_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "Drivers view assigned bookings" ON bookings FOR SELECT USING (
  driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "Passengers create bookings" ON bookings FOR INSERT WITH CHECK (
  passenger_id IN (SELECT id FROM users WHERE auth_id = auth.uid() AND user_type = 'passenger')
);
CREATE POLICY "Drivers update assigned bookings" ON bookings FOR UPDATE USING (
  driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid() AND user_type = 'driver')
);

CREATE POLICY "Drivers update own location" ON driver_locations FOR ALL USING (
  driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid() AND user_type = 'driver')
);
CREATE POLICY "All authenticated users view driver locations" ON driver_locations FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Booking participants access messages" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings WHERE bookings.id = messages.booking_id AND (
      bookings.passenger_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR
      bookings.driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  )
);

CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

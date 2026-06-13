CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pickup_location JSONB NOT NULL,
  dropoff_location JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in-transit', 'completed', 'cancelled')),
  scheduled_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  distance DECIMAL(8,2),
  estimated_duration INTEGER,
  actual_duration INTEGER,
  base_fare DECIMAL(8,2) NOT NULL,
  per_km_rate DECIMAL(8,2) NOT NULL,
  total_fare DECIMAL(10,2) NOT NULL,
  peak_hour_multiplier DECIMAL(3,2) DEFAULT 1.00,
  payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'gcash', 'paymaya')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed')),
  passenger_rating JSONB,
  driver_rating JSONB,
  notes TEXT
);

CREATE INDEX idx_bookings_passenger ON bookings(passenger_id);
CREATE INDEX idx_bookings_driver ON bookings(driver_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);

CREATE TABLE fare_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_fare DECIMAL(8,2) NOT NULL DEFAULT 50.00,
  per_km_rate DECIMAL(8,2) NOT NULL DEFAULT 15.00,
  peak_hour_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.50,
  peak_hours_enabled BOOLEAN DEFAULT true
);

INSERT INTO fare_matrix (base_fare, per_km_rate, peak_hour_multiplier) VALUES (50.00, 15.00, 1.50);

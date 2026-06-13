CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('passenger', 'driver', 'admin')),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  name VARCHAR(255) NOT NULL,
  profile_photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_trips INTEGER DEFAULT 0,
  license_number VARCHAR(50),
  license_expiry DATE,
  verification_status VARCHAR(20) CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  vehicle_details JSONB,
  toda_membership VARCHAR(50),
  bank_account JSONB,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  completed_trips INTEGER DEFAULT 0,
  current_status VARCHAR(20) DEFAULT 'offline' CHECK (current_status IN ('online', 'offline', 'on-trip')),
  last_location_update TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_auth_id ON users(auth_id);

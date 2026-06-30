export interface User {
  id: string;
  auth_id: string;
  user_type: 'passenger' | 'driver' | 'admin';
  email: string;
  phone: string | null;
  name: string;
  profile_photo_url: string | null;
  created_at: Date;
  status: 'active' | 'inactive' | 'suspended';
  rating: number;
  total_trips: number;
  // Primary address captured during profile setup.
  home_address?: string | null;
  // Gate for the one-time profile-setup screen. New accounts (incl. Google
  // sign-in) start false; existing users are backfilled true.
  profile_completed?: boolean;
}

// A reusable address in the passenger's saved-address book (Shopee-style).
export interface SavedAddress {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  full_address: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: Date;
}

export interface Driver extends User {
  user_type: 'driver';
  license_number: string;
  license_expiry: Date;
  verification_status: 'pending' | 'verified' | 'rejected';
  vehicle_details: VehicleDetails;
  toda_membership: string;
  bank_account: BankAccount | null;
  total_earnings: number;
  completed_trips: number;
  current_status: 'online' | 'offline' | 'on-trip';
  last_location_update: Date;
}

export interface VehicleDetails {
  plate_number: string;
  make: string;
  model: string;
  year: number;
  color: string;
  capacity: number;
}

export interface BankAccount {
  bank_name: string;
  account_number: string;
  account_name: string;
}

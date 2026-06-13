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

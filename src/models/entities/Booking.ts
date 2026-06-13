export interface Booking {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  pickup_location: Location;
  dropoff_location: Location;
  status: BookingStatus;
  scheduled_time: Date | null;
  created_at: Date;
  accepted_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  distance: number;
  estimated_duration: number;
  actual_duration: number | null;
  base_fare: number;
  per_km_rate: number;
  total_fare: number;
  peak_hour_multiplier: number;
  payment_method: 'cash' | 'gcash' | 'paymaya';
  payment_status: 'pending' | 'completed';
  passenger_rating: Rating | null;
  driver_rating: Rating | null;
  notes: string | null;
}

export type BookingStatus = 'pending' | 'accepted' | 'in-transit' | 'completed' | 'cancelled';

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  place_id?: string;
}

export interface Rating {
  stars: number;
  comment: string;
  created_at: Date;
}

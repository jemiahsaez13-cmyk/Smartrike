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
  passenger_count: number;
  ride_type: 'standard' | 'priority';
  payment_method: 'cash' | 'gcash' | 'paymaya' | 'online';
  payment_status: 'pending' | 'completed';
  passenger_rating: Rating | null;
  driver_rating: Rating | null;
  notes: string | null;
  // Stamped by the server when the ride is cancelled (migration 077).
  cancelled_by?: 'passenger' | 'driver' | 'system' | 'admin' | null;
  cancellation_reason?: string | null;
  cancellation_valid?: boolean | null;
  cancelled_at?: Date | null;
  // Passenger fare discount (migration 080). total_fare is already net of it.
  passenger_type?: 'regular' | 'senior' | 'pwd' | 'student' | null;
  discount_pct?: number | null;
  discount_amount?: number | null;
  // Set when the driver removed the discount because the ID was not valid
  // (migration 081). total_fare is back to the regular fare.
  discount_revoked_at?: Date | string | null;
  discount_revoked_reason?: string | null;
  // PWD / student: 'pending' until the accepting driver approves the ID
  // (migration 089). total_fare is the regular fare until 'approved'.
  discount_status?: 'pending' | 'approved' | 'rejected' | null;
  discount_reviewed_at?: Date | string | null;
  // Baggage the passenger declared (D3, migration 088). No extra charge.
  baggage_count?: number | null;
  baggage_size?: 'small' | 'medium' | 'large' | null;
}

export type BookingStatus = 'pending' | 'accepted' | 'in-transit' | 'completed' | 'cancelled';

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  place_id?: string;
  /** Purok / sitio / landmark typed after picking a barangay; also leads `address`. */
  details?: string;
}

export interface Rating {
  stars: number;
  comment: string;
  created_at: Date;
}

/**
 * A passenger's request to change the drop-off during the ride (D7,
 * migration 087). Also the audit of the original drop-off and fare.
 * Only an accepted request changes the booking.
 */
export type BookingRouteChangeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface BookingRouteChange {
  id: string;
  booking_id: string;
  requested_by: string | null;
  booking_status: BookingStatus;
  old_dropoff_location: Location;
  old_distance: number | null;
  old_total_fare: number;
  old_discount_amount: number;
  new_dropoff_location: Location;
  new_distance: number;
  new_total_fare: number;
  new_discount_amount: number;
  new_estimated_duration: number | null;
  via_location: { latitude: number; longitude: number } | null;
  status: BookingRouteChangeStatus;
  decline_reason: string | null;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export type DriverPaymentMethodType = 'gcash' | 'bank' | 'other';

export interface DriverPaymentMethod {
  id: string;
  driver_id?: string;
  method_type: DriverPaymentMethodType;
  display_name: string;
  account_name: string;
  account_number: string;
  instructions: string | null;
  qr_code_url: string | null;
  is_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export type RidePaymentStatus = 'pending' | 'verified' | 'rejected';

export interface RidePaymentSubmission {
  id: string;
  booking_id: string;
  passenger_id: string;
  driver_id: string;
  driver_payment_method_id: string;
  payment_details_snapshot: Omit<DriverPaymentMethod, 'id' | 'driver_id' | 'qr_code_url' | 'is_enabled'>;
  amount: number;
  payment_reference: string;
  proof_url: string;
  status: RidePaymentStatus;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_role: 'driver' | 'admin' | null;
  passenger_name?: string;
  driver_name?: string;
}

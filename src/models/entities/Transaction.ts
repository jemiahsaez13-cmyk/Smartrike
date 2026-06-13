export interface Transaction {
  id: string;
  booking_id: string;
  passenger_id: string;
  driver_id: string;
  amount: number;
  payment_method: 'cash' | 'gcash' | 'paymaya';
  status: 'pending' | 'completed' | 'failed';
  created_at: Date;
  completed_at: Date | null;
  receipt_url: string | null;
  notes: string | null;
}

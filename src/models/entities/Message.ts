export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  message: string;
  timestamp: Date;
  read: boolean;
  sender_type: 'passenger' | 'driver';
}

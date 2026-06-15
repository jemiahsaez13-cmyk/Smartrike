export type NotificationType =
  | 'booking_request'
  | 'booking_accepted'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'driver_arrived'
  | 'trip_started'
  | 'payment_received'
  | 'franchise_status'
  | 'system_alert';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  booking_id?: string | null;
  read: boolean;
  created_at: string;
}

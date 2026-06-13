export interface PushNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'booking_update' | 'driver_arrival' | 'system_alert' | 'promotion';
  data?: Record<string, any>;
  read: boolean;
  created_at: Date;
}

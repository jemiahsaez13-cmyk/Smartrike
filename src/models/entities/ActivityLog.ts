export interface ActivityLog {
  id: string;
  user_id?: string;
  action_type: 'booking_created' | 'booking_completed' | 'booking_cancelled' | 'driver_status_changed' | 'system_alert' | 'user_action';
  entity_type: 'booking' | 'user' | 'driver' | 'system';
  entity_id?: string;
  description: string;
  metadata?: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'success';
  created_at: Date;
}

export interface SystemHealth {
  id: string;
  metric_name: string;
  metric_value: number;
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
}

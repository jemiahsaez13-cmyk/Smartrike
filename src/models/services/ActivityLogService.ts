import { supabase } from '@/config/supabase';
import { ActivityLog } from '@/models/entities/ActivityLog';

export class ActivityLogService {
  static async logActivity(log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<void> {
    try {
      await supabase.from('activity_logs').insert({
        user_id: log.user_id,
        action_type: log.action_type,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        description: log.description,
        metadata: log.metadata,
        severity: log.severity,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  static async getRecentLogs(limit: number = 50): Promise<ActivityLog[]> {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      return [];
    }
  }

  static async getLogsByUser(userId: string): Promise<ActivityLog[]> {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch user logs:', error);
      return [];
    }
  }
}

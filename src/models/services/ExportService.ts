import { Booking } from '@/models/types';
import { ActivityLog } from '@/models/entities/ActivityLog';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export class ExportService {
  static async exportBookingsToCSV(bookings: Booking[]): Promise<void> {
    try {
      const headers = ['ID', 'Passenger', 'Driver', 'Pickup', 'Dropoff', 'Fare', 'Status', 'Date'];
      const rows = bookings.map(b => [
        b.id,
        b.passenger_id,
        b.driver_id || 'N/A',
        b.pickup_location.address,
        b.dropoff_location.address,
        b.total_fare,
        b.status,
        new Date(b.created_at).toLocaleDateString()
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const fileUri = (FileSystem as any).documentDirectory + `bookings_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export bookings');
    }
  }

  static async exportLogsToCSV(logs: ActivityLog[]): Promise<void> {
    try {
      const headers = ['Action', 'Entity', 'Description', 'Severity', 'Timestamp'];
      const rows = logs.map(l => [
        l.action_type,
        l.entity_type,
        l.description,
        l.severity,
        new Date(l.created_at).toLocaleString()
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const fileUri = (FileSystem as any).documentDirectory + `activity_logs_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export logs');
    }
  }
}

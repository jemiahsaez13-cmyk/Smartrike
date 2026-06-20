import { Platform } from 'react-native';
import { Booking } from '@/models/types';
import { ActivityLog } from '@/models/entities/ActivityLog';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Quotes a CSV cell so commas, quotes, and newlines don't break columns.
const csvCell = (value: any): string => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Writes a CSV: browser download on web, share sheet on native.
const saveCsv = async (csvContent: string, fileName: string): Promise<void> => {
  if (Platform.OS === 'web') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }
  const fileUri = (FileSystem as any).documentDirectory + fileName;
  await FileSystem.writeAsStringAsync(fileUri, csvContent);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri);
  }
};

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

      const csvContent = [headers, ...rows]
        .map(row => row.map(csvCell).join(','))
        .join('\n');

      await saveCsv(csvContent, `bookings_${Date.now()}.csv`);
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

      const csvContent = [headers, ...rows]
        .map(row => row.map(csvCell).join(','))
        .join('\n');

      await saveCsv(csvContent, `activity_logs_${Date.now()}.csv`);
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export logs');
    }
  }
}

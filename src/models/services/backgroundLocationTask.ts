import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/config/supabase';

/**
 * Background GPS for on-duty drivers. The foreground `watchPositionAsync`
 * stream stops as soon as the driver switches apps (e.g. to a navigation app),
 * which froze their marker on the passenger's map. This task keeps posting to
 * `driver_locations` via an Android foreground service (persistent "You are
 * online" notification) and iOS background location updates.
 *
 * `defineTask` must run at module load, so this file is imported from App.tsx.
 */
export const DRIVER_LOCATION_TASK = 'smart-trike-driver-location';
export const DRIVER_ID_STORAGE_KEY = '@smart-trike/background-location-driver';

if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }: any) => {
      if (error) return;
      const locations = data?.locations as Array<{ coords: { latitude: number; longitude: number }; timestamp: number }> | undefined;
      const latest = locations?.[locations.length - 1];
      if (!latest) return;
      // The task can run after the JS context was restarted, so the driver id
      // is persisted rather than kept in memory.
      const driverId = await AsyncStorage.getItem(DRIVER_ID_STORAGE_KEY).catch(() => null);
      if (!driverId) return;
      await supabase.from('driver_locations').upsert(
        {
          driver_id: driverId,
          latitude: latest.coords.latitude,
          longitude: latest.coords.longitude,
          timestamp: new Date(latest.timestamp || Date.now()).toISOString(),
        },
        { onConflict: 'driver_id' }
      );
    });
  } catch (e) {
    console.warn('Background location task unavailable:', e);
  }
}

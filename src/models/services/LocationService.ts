import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/config/supabase';
import * as ExpoLocation from 'expo-location';
import { Location } from '@/models/types';
import { DRIVER_LOCATION_TASK, DRIVER_ID_STORAGE_KEY } from './backgroundLocationTask';

// Default position (Boac, Marinduque) used when device location is unavailable
// e.g. on web or when the user denies the permission. Keeps the booking flow
// usable in the prototype instead of hanging on a missing fix.
const DEFAULT_LOCATION: Location = {
  latitude: 13.4452,
  longitude: 121.8401,
  address: 'Current Location (Boac)'
};

export class LocationService {
  // Holds the active watchPositionAsync subscription so it can be stopped later.
  // Kept here (not in Redux) because the subscription object is non-serializable.
  private watchSub: { remove: () => void } | null = null;
  // Bumped on every start/stop so a watch that resolves after it was already
  // cancelled (fast online→offline toggles) is removed instead of leaking.
  private watchToken = 0;
  /** True while the background task (not the foreground watch) posts GPS to the server. */
  backgroundActive = false;

  async getCurrentPosition(): Promise<Location> {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') return DEFAULT_LOCATION;

      const location = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: 'Current Location'
      };
    } catch {
      return DEFAULT_LOCATION;
    }
  }

  async updateDriverLocation(driverId: string, location: Location): Promise<void> {
    // driver_locations.driver_id is UNIQUE, so upsert must conflict-target it —
    // otherwise every ping tries to INSERT a new row and hits a 409 on the
    // unique constraint. With onConflict it updates the driver's single row.
    const { error } = await supabase.from('driver_locations').upsert(
      {
        driver_id: driverId,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
      },
      { onConflict: 'driver_id' }
    );
    if (error) throw error;
  }

  async getDriverLocation(driverId: string): Promise<(Location & { timestamp?: string }) | null> {
    const { data, error } = await supabase
      .from('driver_locations')
      .select('*')
      .eq('driver_id', driverId)
      .single();
    if (error) return null;
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      address: '',
      timestamp: data.timestamp,
    };
  }

  async watchPosition(callback: (location: Location) => void): Promise<any> {
    return await ExpoLocation.watchPositionAsync(
      { accuracy: ExpoLocation.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
      (position) => callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        address: ''
      })
    );
  }

  // Begins streaming the device position to `callback` every ~5s, after ensuring
  // foreground permission. Any previous watch is stopped first so we never leak
  // two subscriptions. Returns false if permission was denied.
  async startWatching(callback: (location: Location) => void, driverId?: string): Promise<boolean> {
    this.stopForegroundWatch();
    const token = ++this.watchToken;
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted' || token !== this.watchToken) return false;
      if (driverId) await this.startBackgroundUpdates(driverId);
      if (token !== this.watchToken) {
        await this.stopBackgroundUpdates();
        return false;
      }
      const sub = await this.watchPosition(callback);
      if (token !== this.watchToken) {
        try { sub.remove(); } catch { /* web */ }
        return false;
      }
      this.watchSub = sub;
      return true;
    } catch (e) {
      // expo-location can be flaky on web; location streaming is non-critical.
      console.warn('startWatching skipped:', e);
      return false;
    }
  }

  // Keeps posting the driver's position while the app is in the background.
  // Best-effort: if the OS refuses (e.g. iOS without background permission),
  // the foreground watch still covers the time the app is open.
  // Start/stop calls are queued so a stop can never interleave with a start.
  private backgroundQueue: Promise<void> = Promise.resolve();
  private enqueue(op: () => Promise<void>): Promise<void> {
    this.backgroundQueue = this.backgroundQueue.then(op, op);
    return this.backgroundQueue;
  }

  private startBackgroundUpdates(driverId: string): Promise<void> {
    return this.enqueue(() => this.doStartBackgroundUpdates(driverId));
  }

  private stopBackgroundUpdates(): Promise<void> {
    return this.enqueue(() => this.doStopBackgroundUpdates());
  }

  private async doStartBackgroundUpdates(driverId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await AsyncStorage.setItem(DRIVER_ID_STORAGE_KEY, driverId);
      const running = await ExpoLocation.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => false);
      if (!running) {
        await ExpoLocation.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
          accuracy: ExpoLocation.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Smart Trike — you are on duty',
            notificationBody: 'Sharing your location with passengers while you are online.',
            notificationColor: '#3B634E',
          },
        });
      }
      this.backgroundActive = true;
    } catch (e) {
      this.backgroundActive = false;
      console.warn('Background location unavailable; using foreground updates only:', e);
    }
  }

  private async doStopBackgroundUpdates(): Promise<void> {
    this.backgroundActive = false;
    if (Platform.OS === 'web') return;
    try {
      await AsyncStorage.removeItem(DRIVER_ID_STORAGE_KEY);
      if (await ExpoLocation.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
        await ExpoLocation.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
      }
    } catch (e) {
      console.warn('stopBackgroundUpdates skipped:', e);
    }
  }

  stopWatching(): void {
    this.watchToken += 1;
    void this.stopBackgroundUpdates();
    this.stopForegroundWatch();
  }

  private stopForegroundWatch(): void {
    if (this.watchSub) {
      // expo-location's web build throws on .remove() (it calls a removed
      // LocationEventEmitter.removeSubscription). Guard it so cleanup never
      // crashes the screen; the watch is dropped either way.
      try {
        this.watchSub.remove();
      } catch (e) {
        console.warn('stopWatching remove skipped:', e);
      }
      this.watchSub = null;
    }
  }
}

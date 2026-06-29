import { supabase } from '@/config/supabase';
import * as ExpoLocation from 'expo-location';
import { Location } from '@/models/types';

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
    const { error } = await supabase.from('driver_locations').upsert({
      driver_id: driverId,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date().toISOString()
    });
    if (error) throw error;
  }

  async getDriverLocation(driverId: string): Promise<Location | null> {
    const { data, error } = await supabase
      .from('driver_locations')
      .select('*')
      .eq('driver_id', driverId)
      .single();
    if (error) return null;
    return { latitude: data.latitude, longitude: data.longitude, address: '' };
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
  async startWatching(callback: (location: Location) => void): Promise<boolean> {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') return false;
    this.stopWatching();
    this.watchSub = await this.watchPosition(callback);
    return true;
  }

  stopWatching(): void {
    if (this.watchSub) {
      this.watchSub.remove();
      this.watchSub = null;
    }
  }
}

import { supabase } from '@/config/supabase';
import * as ExpoLocation from 'expo-location';
import { Location } from '@/models/types';

export class LocationService {
  async getCurrentPosition(): Promise<Location> {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location permission denied');

    const location = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      address: ''
    };
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
}

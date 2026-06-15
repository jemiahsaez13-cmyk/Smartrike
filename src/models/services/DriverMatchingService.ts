import { supabase } from '@/config/supabase';
import { Location } from '@/models/types';
import { haversineDistance } from '@/utils/locationUtils';
import { DRIVER_SEARCH_RADIUS_KM } from '@/config/constants';

export interface NearbyDriver {
  id: string;
  name: string;
  rating: number;
  total_trips: number;
  current_status: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  etaMinutes?: number;
}

export class DriverMatchingService {
  async findNearbyDrivers(location: Location, radiusKm = DRIVER_SEARCH_RADIUS_KM): Promise<NearbyDriver[]> {
    try {
      const { data: drivers, error } = await supabase
        .from('users')
        .select('id, name, rating, total_trips, current_status')
        .eq('user_type', 'driver')
        .eq('current_status', 'online')
        .eq('status', 'active');

      if (error || !drivers) return [];

      const driverIds = drivers.map(d => d.id);
      const { data: locations } = await supabase
        .from('driver_locations')
        .select('driver_id, latitude, longitude')
        .in('driver_id', driverIds);

      const locMap: Record<string, { lat: number; lng: number }> = {};
      (locations ?? []).forEach(l => {
        locMap[l.driver_id] = { lat: l.latitude, lng: l.longitude };
      });

      const nearby: NearbyDriver[] = [];
      for (const driver of drivers) {
        const loc = locMap[driver.id];
        if (!loc) continue;
        const driverLoc: Location = { latitude: loc.lat, longitude: loc.lng, address: '' };
        const dist = haversineDistance(location, driverLoc);
        if (dist <= radiusKm) {
          nearby.push({
            ...driver,
            latitude: loc.lat,
            longitude: loc.lng,
            distanceKm: dist,
            etaMinutes: Math.ceil((dist / 30) * 60),
          });
        }
      }

      return nearby.sort((a, b) => {
        const distDiff = (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
        if (Math.abs(distDiff) > 0.5) return distDiff;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
    } catch {
      return [];
    }
  }

  async findBestDriver(location: Location): Promise<NearbyDriver | null> {
    const drivers = await this.findNearbyDrivers(location);
    return drivers.length > 0 ? drivers[0] : null;
  }

  async getDriverCount(location: Location, radiusKm = DRIVER_SEARCH_RADIUS_KM): Promise<number> {
    const drivers = await this.findNearbyDrivers(location, radiusKm);
    return drivers.length;
  }
}

import { supabase } from '@/config/supabase';
import { Location } from '@/models/types';

export class FareCalculationService {
  async getFareConfig() {
    // Tolerate 0 or >1 fare_matrix rows: take the first, fall back to LGU defaults.
    const { data, error } = await supabase
      .from('fare_matrix')
      .select('*')
      .limit(1)
      .maybeSingle();

    const cfg = (!error && data) ? data : {
      base_fare: 50.0,
      per_km_rate: 15.0,
      peak_hour_multiplier: 1.5,
      peak_hours_enabled: true,
    };

    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const isPeakHour = currentHour >= 6.5 && currentHour < 9;

    return {
      baseFare: Number(cfg.base_fare),
      perKmRate: Number(cfg.per_km_rate),
      multiplier: isPeakHour && cfg.peak_hours_enabled ? Number(cfg.peak_hour_multiplier) : 1.0
    };
  }

  calculateFare(distance: number, baseFare: number, perKmRate: number, multiplier: number): number {
    return Math.round((baseFare + distance * perKmRate) * multiplier * 100) / 100;
  }

  async calculateDistance(pickup: Location, dropoff: Location): Promise<number> {
    const R = 6371;
    const lat1 = pickup.latitude * Math.PI / 180;
    const lat2 = dropoff.latitude * Math.PI / 180;
    const deltaLat = (dropoff.latitude - pickup.latitude) * Math.PI / 180;
    const deltaLng = (dropoff.longitude - pickup.longitude) * Math.PI / 180;
    const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

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

    // Defaults match the official Boac LGU tricycle matrix (₱120 first km,
    // ₱10 per succeeding km, no peak surcharge).
    const cfg = (!error && data) ? data : {
      base_fare: 120.0,
      per_km_rate: 10.0,
      peak_hour_multiplier: 1.0,
      peak_hours_enabled: false,
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

  // Boac LGU matrix: ₱120 covers the first kilometer, then ₱10 for every
  // succeeding kilometer. Distance is rounded UP to the next whole kilometer,
  // so a 4.2 km trip is billed as 5 km. `multiplier` is normally 1 (no peak
  // surcharge) but is kept for forward-compatibility with a configurable matrix.
  calculateFare(distance: number, baseFare: number, perKmRate: number, multiplier: number = 1): number {
    const km = Math.max(1, Math.ceil(distance || 0));
    const fare = baseFare + (km - 1) * perKmRate;
    return Math.round(fare * (multiplier || 1) * 100) / 100;
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

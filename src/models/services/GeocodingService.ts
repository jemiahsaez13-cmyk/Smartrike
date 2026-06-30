import * as ExpoLocation from 'expo-location';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface SnappedPlace {
  latitude: number;
  longitude: number;
  address: string;
}

// Accuracy helpers for the map pin picker. `snapToRoad` uses Google's Roads API
// so a pin dropped slightly off a street is pulled onto the nearest drivable
// road — tricycles can only pick up/drop off on roads, so this avoids fares
// being computed to the middle of a building or field. `reverseGeocode` turns
// the final coordinate into a human-readable address.
export class GeocodingService {
  // Pull a coordinate onto the nearest road. Falls back to the original point
  // if the Roads API is unavailable (no key, offline, or quota).
  async snapToRoad(latitude: number, longitude: number): Promise<{ latitude: number; longitude: number }> {
    if (!GOOGLE_KEY) return { latitude, longitude };
    try {
      const url = `https://roads.googleapis.com/v1/nearestRoads?points=${latitude},${longitude}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const pt = json?.snappedPoints?.[0]?.location;
      if (pt && typeof pt.latitude === 'number' && typeof pt.longitude === 'number') {
        return { latitude: pt.latitude, longitude: pt.longitude };
      }
    } catch {
      // Ignore and fall back to the raw coordinate.
    }
    return { latitude, longitude };
  }

  // Build a readable address from a coordinate using the device geocoder
  // (expo-location). Returns a coordinate string if no address is found.
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
      const r = results?.[0];
      if (r) {
        const parts = [
          r.name && r.name !== r.street ? r.name : null,
          r.street,
          r.district,
          r.city || r.subregion,
        ].filter(Boolean);
        const line = Array.from(new Set(parts)).join(', ');
        if (line) return line;
      }
    } catch {
      // Geocoder can be unavailable (e.g. web) — fall through to coordinates.
    }
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }

  // Turn a typed address into coordinates (e.g. a saved address with no pin yet).
  // Returns null if it can't be located.
  async forwardGeocode(address: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const results = await ExpoLocation.geocodeAsync(address);
      const r = results?.[0];
      if (r && typeof r.latitude === 'number' && typeof r.longitude === 'number') {
        return { latitude: r.latitude, longitude: r.longitude };
      }
    } catch {
      // Geocoder unavailable — caller falls back.
    }
    return null;
  }

  // Snap + reverse-geocode in one call, returning everything the picker needs.
  async resolvePin(latitude: number, longitude: number): Promise<SnappedPlace> {
    const snapped = await this.snapToRoad(latitude, longitude);
    const address = await this.reverseGeocode(snapped.latitude, snapped.longitude);
    return { ...snapped, address };
  }
}

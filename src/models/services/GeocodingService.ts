import * as ExpoLocation from 'expo-location';

// On-device geocoding helpers (expo-location) for the map pin picker. No Google
// Roads/Directions APIs are used — `reverseGeocode` names a dropped pin and
// `forwardGeocode` locates a typed address, both via the phone's own geocoder.
export class GeocodingService {
  // Build a readable address from a coordinate using the device geocoder.
  // Returns a coordinate string if no address is found.
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
}

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Fetches real driving distance between two points from the Google Directions
// API, used for accurate fare computation. Returns null on any failure (no key,
// offline, CORS on web, quota) so callers fall back to straight-line distance.
// Note: this is used for DISTANCE ONLY — the map line stays a cosmetic curve.
export class DirectionsService {
  async getRoadDistanceKm(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<number | null> {
    if (!GOOGLE_KEY) return null;
    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${origin.latitude},${origin.longitude}` +
        `&destination=${destination.latitude},${destination.longitude}` +
        `&mode=driving&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const route = json?.routes?.[0];
      if (!route) return null;
      const meters = (route.legs ?? []).reduce(
        (sum: number, leg: any) => sum + (leg?.distance?.value ?? 0),
        0
      );
      return meters > 0 ? meters / 1000 : null;
    } catch {
      return null;
    }
  }
}

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface RouteResult {
  // Points along the actual road route, ready to feed a <Polyline />.
  coordinates: { latitude: number; longitude: number }[];
  // Driving distance of the route in kilometres (sum of all legs).
  distanceKm: number;
}

// Decode a Google "encoded polyline" string into lat/lng points.
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

// Fetches a driving route between two points from the Google Directions API so
// the map can draw a road-following line and the fare can use real road
// distance. Returns null on any failure (no key, offline, CORS on web, quota)
// so callers fall back to a straight line + haversine distance.
export class DirectionsService {
  async getRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<RouteResult | null> {
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

      const encoded = route.overview_polyline?.points;
      const coordinates = encoded ? decodePolyline(encoded) : [];
      const meters = (route.legs ?? []).reduce(
        (sum: number, leg: any) => sum + (leg?.distance?.value ?? 0),
        0
      );
      if (!coordinates.length || !meters) return null;

      return { coordinates, distanceKm: meters / 1000 };
    } catch {
      return null;
    }
  }
}

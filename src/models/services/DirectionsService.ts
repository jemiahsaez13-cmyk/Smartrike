const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

type LatLng = { latitude: number; longitude: number };

export interface RoadRoute {
  /** Real driving distance in km (sum of all legs). */
  distanceKm: number;
  /** Driving duration in minutes. */
  durationMin: number;
  /** Decoded overview polyline — the actual road path to draw on the map. */
  points: LatLng[];
}

// Decodes a Google "encoded polyline" string into coordinates.
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
const decodePolyline = (encoded: string): LatLng[] => {
  const points: LatLng[] = [];
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
};

// Fetches the real driving route between two points from the Google Directions
// API: road-following polyline (for the map line) plus distance/duration (for
// fare + ETA accuracy). Returns null on any failure (no key, offline, CORS on
// web, quota) so callers fall back to a straight line / haversine distance.
export class DirectionsService {
  async getRoute(origin: LatLng, destination: LatLng): Promise<RoadRoute | null> {
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
      const legs = route.legs ?? [];
      const meters = legs.reduce((sum: number, leg: any) => sum + (leg?.distance?.value ?? 0), 0);
      const seconds = legs.reduce((sum: number, leg: any) => sum + (leg?.duration?.value ?? 0), 0);
      if (meters <= 0) return null;
      // Prefer the detailed per-step path (hugs the road tightly); fall back to
      // the coarser overview polyline if steps are missing.
      let points: LatLng[] = [];
      for (const leg of legs) {
        for (const step of leg?.steps ?? []) {
          const enc = step?.polyline?.points;
          if (enc) points = points.concat(decodePolyline(enc));
        }
      }
      if (points.length < 2 && route.overview_polyline?.points) {
        points = decodePolyline(route.overview_polyline.points);
      }
      if (points.length < 2) return null;
      return {
        distanceKm: meters / 1000,
        durationMin: Math.max(1, Math.round(seconds / 60)),
        points,
      };
    } catch {
      return null;
    }
  }

  // Back-compat: distance-only helper used by the fare estimator.
  async getRoadDistanceKm(origin: LatLng, destination: LatLng): Promise<number | null> {
    const route = await this.getRoute(origin, destination);
    return route ? route.distanceKm : null;
  }
}

import { Location } from '@/models/types';

export function haversineDistance(a: Location, b: Location): number {
  const R = 6371;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function estimateETA(distanceKm: number, speedKph = 30): number {
  return Math.ceil((distanceKm / speedKph) * 60);
}

export function formatETA(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function coordinatesInBounds(
  lat: number,
  lng: number,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): boolean {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

// Approximate bounding box for Boac, Marinduque
export const BOAC_BOUNDS = {
  minLat: 13.38,
  maxLat: 13.55,
  minLng: 121.80,
  maxLng: 121.90,
};

export function isInBoac(lat: number, lng: number): boolean {
  return coordinatesInBounds(lat, lng, BOAC_BOUNDS);
}

export function midpoint(a: Location, b: Location): Location {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    address: '',
  };
}

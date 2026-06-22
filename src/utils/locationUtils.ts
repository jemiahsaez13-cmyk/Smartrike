import { Location } from '@/models/types';
import { BOAC_CENTER, FARE } from '@/config/constants';

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

export interface PlaceEstimate {
  distanceKm: number;
  etaMin: number;
  fare: number;
}

// Quick estimate for a popular destination, measured from the Boac town center
// (the typical pickup point). Fare uses the official Boac matrix: ₱base for the
// first km, then ₱per-km for each succeeding km, distance rounded up.
export function placeEstimate(
  place: { lat: number; lng: number },
  origin: { latitude: number; longitude: number } = BOAC_CENTER
): PlaceEstimate {
  const km = haversineDistance(
    { latitude: origin.latitude, longitude: origin.longitude, address: '' },
    { latitude: place.lat, longitude: place.lng, address: '' }
  );
  const whole = Math.max(1, Math.ceil(km));
  const fare = FARE.BASE + (whole - 1) * FARE.PER_KM;
  const etaMin = Math.max(3, estimateETA(km, 22)); // tricycle ~22 km/h average
  return { distanceKm: km, etaMin, fare };
}

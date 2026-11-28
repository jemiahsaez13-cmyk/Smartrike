import { MARINDUQUE_TOWNS } from '@/config/marinduque';
import type { Location } from '@/models/entities/Booking';

/**
 * A driver may accept a ride only when their TODA has a route for the trip's
 * barangays (either direction). The same matching runs on the server in
 * public.driver_toda_covers_booking (migration 093) — keep the two in step.
 */
export interface RoutePair {
  from_barangay: string;
  to_barangay: string;
}

/** Lower-case words only, "Poblacion" dropped: "Isok I (Poblacion)" == "Isok I". */
export const barangayKey = (value?: string | null): string =>
  (value ?? '')
    .toLowerCase()
    .replace(/\bpoblacion\b/g, ' ')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();

/** True when `text` (already a key) names the barangay as whole words. */
const mentions = (text: string, barangay: string): boolean => {
  const key = barangayKey(barangay);
  return !!key && ` ${text} `.includes(` ${key} `);
};

/**
 * A place is in a barangay when it was picked from the barangay list with that
 * barangay, or — for GPS, pinned or older places — its address names it.
 */
const placeIn = (place: Location | null | undefined, barangay: string): boolean => {
  if (!place) return false;
  if (place.barangay?.trim()) return barangayKey(place.barangay) === barangayKey(barangay);
  return mentions(barangayKey(place.address), barangay);
};

export const routeCoversTrip = (
  routes: RoutePair[],
  pickup: Location | null | undefined,
  dropoff: Location | null | undefined,
): boolean =>
  routes.some((route) =>
    (placeIn(pickup, route.from_barangay) && placeIn(dropoff, route.to_barangay))
    || (placeIn(pickup, route.to_barangay) && placeIn(dropoff, route.from_barangay)));

const BOAC_BARANGAYS = MARINDUQUE_TOWNS.find((town) => town.name === 'Boac')?.barangays ?? [];

/** The Boac barangay a piece of text names, if any (longest name wins). */
export const findBoacBarangay = (...texts: (string | null | undefined)[]): string | undefined => {
  const byLength = [...BOAC_BARANGAYS].sort((a, b) => barangayKey(b).length - barangayKey(a).length);
  for (const text of texts) {
    const key = barangayKey(text);
    if (!key) continue;
    const hit = byLength.find((barangay) => mentions(key, barangay));
    if (hit) return hit;
  }
  return undefined;
};

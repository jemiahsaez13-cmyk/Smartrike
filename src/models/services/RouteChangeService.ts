import { supabase } from '@/config/supabase';
import { Booking, BookingRouteChange, Location } from '@/models/types';
import { DirectionsService } from '@/models/services/DirectionsService';
import { FareCalculationService } from '@/models/services/FareCalculationService';
import { haversineDistance } from '@/utils/locationUtils';

const directions = new DirectionsService();
const fares = new FareCalculationService();
let nextChannel = 0;

const migrationHint = (message: string) =>
  /booking_route_changes|request_dropoff_change|respond_dropoff_change|cancel_dropoff_change|could not find the function/i.test(message)
    ? 'Changing the drop-off needs database migration 087. Apply it in the Supabase SQL editor, then try again.'
    : message;

type LatLng = { latitude: number; longitude: number };

export interface RouteChangeQuote {
  distanceKm: number;
  totalFare: number;
  discountAmount: number;
  /** Driver position the distance went through (during the ride). */
  via: LatLng | null;
}

/** Road distance of one leg, or the straight line when Directions is unavailable. */
const legKm = async (from: LatLng, to: LatLng): Promise<number> => {
  const road = await directions.getRoute(from, to).catch(() => null);
  return road?.distanceKm ?? haversineDistance({ ...from, address: '' }, { ...to, address: '' });
};

/**
 * Passenger-initiated drop-off change during the ride (D7, migration 087).
 * The server recomputes distance and fare; `quote` only previews them.
 */
export class RouteChangeService {
  /**
   * Same rules as the server (migration 087): during the ride the part already
   * ridden counts (pickup → driver → new drop-off); before pickup it is
   * pickup → new drop-off. Priced with the booking's own rates and discount.
   */
  static async quote(booking: Booking, dropoff: Location, driverPosition?: LatLng | null): Promise<RouteChangeQuote> {
    const pickup = booking.pickup_location;
    const via = booking.status === 'in-transit' && driverPosition ? driverPosition : null;
    const distanceKm = via
      ? (await legKm(pickup, via)) + (await legKm(via, dropoff))
      : await legKm(pickup, dropoff);
    const rideType = booking.ride_type === 'priority' ? 'priority' : 'standard';
    const base = Number(booking.base_fare ?? 120);
    const perKm = Number(booking.per_km_rate ?? 10);
    const mult = Number(booking.peak_hour_multiplier ?? 1) || 1;
    const gross = fares.calculateFareForPassengers(distanceKm, base, perKm, booking.passenger_count ?? 1, mult, rideType);
    const one = fares.calculateFareForPassengers(distanceKm, base, perKm, 1, mult, rideType);
    const discountAmount = Math.round(one * Number(booking.discount_pct ?? 0)) / 100;
    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      totalFare: Math.round((gross - discountAmount) * 100) / 100,
      discountAmount,
      via,
    };
  }

  /** Passenger: ask the driver to go to a new drop-off. */
  static async request(bookingId: string, dropoff: Location, distanceKm?: number | null): Promise<BookingRouteChange> {
    const { data, error } = await supabase.rpc('request_dropoff_change', {
      p_booking_id: bookingId,
      p_location: dropoff,
      p_distance: distanceKm ?? null,
    });
    if (error) throw new Error(migrationHint(String(error.message || 'The drop-off change could not be sent.')));
    return data as BookingRouteChange;
  }

  /** Passenger: withdraw a request the driver has not answered yet. */
  static async cancel(changeId: string): Promise<BookingRouteChange> {
    const { data, error } = await supabase.rpc('cancel_dropoff_change', { p_change_id: changeId });
    if (error) throw new Error(migrationHint(String(error.message || 'The request could not be withdrawn.')));
    return data as BookingRouteChange;
  }

  /** Assigned driver: accept (the booking takes the new drop-off and fare) or decline. */
  static async respond(changeId: string, accept: boolean, reason?: string | null): Promise<Booking> {
    const { data, error } = await supabase.rpc('respond_dropoff_change', {
      p_change_id: changeId,
      p_accept: accept,
      p_reason: reason ?? null,
    });
    if (error) throw new Error(migrationHint(String(error.message || 'The answer could not be sent.')));
    return data as Booking;
  }

  /** Every request for the ride, newest first (the audit trail). */
  static async list(bookingId: string): Promise<BookingRouteChange[]> {
    const { data, error } = await supabase
      .from('booking_route_changes')
      .select('*')
      .eq('booking_id', bookingId)
      .order('requested_at', { ascending: false });
    if (error) throw new Error(migrationHint(String(error.message || 'Drop-off changes could not be loaded.')));
    return (data as BookingRouteChange[]) ?? [];
  }

  /**
   * Live list of the ride's requests (newest first). Realtime is the signal;
   * polling keeps it working where the table is not published yet.
   */
  static watch(bookingId: string, onChange: (changes: BookingRouteChange[]) => void) {
    let stopped = false;
    let running = false;
    let again = false;
    const refresh = async () => {
      if (stopped) return;
      if (running) { again = true; return; }
      running = true;
      try {
        do {
          again = false;
          try {
            const rows = await RouteChangeService.list(bookingId);
            if (!stopped) onChange(rows);
          } catch { /* Before migration 087 or offline: keep the last state. */ }
        } while (again && !stopped);
      } finally { running = false; }
    };
    const channel = supabase.channel(`route-changes-${bookingId}-${++nextChannel}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_route_changes', filter: `booking_id=eq.${bookingId}` }, () => { void refresh(); })
      .subscribe();
    void refresh();
    const poll = setInterval(() => { void refresh(); }, 4000);
    return {
      refresh,
      stop: () => { stopped = true; clearInterval(poll); void supabase.removeChannel(channel); },
    };
  }
}

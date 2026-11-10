import { BookingRepository } from '@/models/repositories/BookingRepository';
import { UserRepository } from '@/models/repositories/UserRepository';
import { FareCalculationService, MAX_TRICYCLE_PASSENGERS } from './FareCalculationService';
import { NotificationService } from './NotificationService';
import { Booking, Location, Rating } from '@/models/types';
import { supabase } from '@/config/supabase';
import {
  BAGGAGE_SIZES,
  BaggageSize,
  BookingPassengerType,
  MAX_BAGGAGE_COUNT,
  NO_DRIVER_CANCELLATION_REASON,
  REQUEST_FRESHNESS_MINUTES,
  baggageSummary,
  discountNeedsApproval,
} from '@/config/constants';

// Parses a timestamp as UTC when it arrives without a timezone suffix.
const toMs = (value: unknown): number => {
  const s = String(value);
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  return new Date(iso).getTime();
};

/**
 * A request nobody accepted within REQUEST_FRESHNESS_MINUTES is hidden from
 * drivers, so the passenger's search must end at the same point.
 */
export const isStalePendingBooking = (booking: Pick<Booking, 'status' | 'created_at'> | null | undefined): boolean =>
  !!booking
  && booking.status === 'pending'
  && Date.now() - toMs(booking.created_at) >= REQUEST_FRESHNESS_MINUTES * 60 * 1000;

export class BookingService {
  bookingRepo = new BookingRepository();
  userRepo = new UserRepository();
  fareService = new FareCalculationService();
  notificationService = new NotificationService();

  async createBooking(
    passengerId: string,
    pickup: Location,
    dropoff: Location,
    options: {
      scheduledTime?: Date;
      notes?: string;
      paymentMethod?: 'cash' | 'gcash' | 'paymaya' | 'online';
      passengerCount?: number;
      rideType?: 'standard' | 'priority';
      distanceKm?: number;
      passengerType?: BookingPassengerType;
      /** D3: bags declared by the passenger (0 = none) and the biggest one's size. */
      baggageCount?: number;
      baggageSize?: BaggageSize | null;
    } = {}
  ): Promise<Booking> {
    // One ride at a time. An expired search is closed first so it never blocks
    // a new booking.
    const active = await this.bookingRepo.findActiveByPassenger(passengerId);
    if (active) {
      if (isStalePendingBooking(active)) {
        await this.bookingRepo.cancel(active.id, NO_DRIVER_CANCELLATION_REASON);
      } else {
        throw new Error(active.status === 'pending'
          ? 'You are already waiting for a driver. Cancel that request before booking another ride.'
          : 'You already have an ongoing ride. Finish it before booking another.');
      }
    }

    const passengerCount = Math.floor(options.passengerCount ?? 1);
    if (passengerCount < 1 || passengerCount > MAX_TRICYCLE_PASSENGERS) {
      throw new Error(`A tricycle can carry 1 to ${MAX_TRICYCLE_PASSENGERS} passengers.`);
    }
    const baggageCount = Math.floor(options.baggageCount ?? 0);
    if (baggageCount < 0 || baggageCount > MAX_BAGGAGE_COUNT) {
      throw new Error(`Declare 0 to ${MAX_BAGGAGE_COUNT} bags.`);
    }
    const baggageSize = baggageCount > 0 ? options.baggageSize ?? null : null;
    if (baggageCount > 0 && (!baggageSize || !BAGGAGE_SIZES.includes(baggageSize))) {
      throw new Error('Choose the size of your biggest bag.');
    }
    const rideType = options.rideType ?? 'standard';
    const rawDistance = options.distanceKm && options.distanceKm > 0
      ? options.distanceKm
      : await this.fareService.calculateDistance(pickup, dropoff);
    // The column stores 2 decimals and the server re-prices from that value
    // (migration 068), so price from the same rounded number.
    const distance = Math.round(rawDistance * 100) / 100;
    const { baseFare, perKmRate, multiplier } = await this.fareService.getFareConfig();
    const passengerType = options.passengerType ?? 'regular';
    const quote = this.fareService.quoteFare(
      distance,
      baseFare,
      perKmRate,
      passengerCount,
      multiplier,
      rideType,
      passengerType
    );
    // 089: PWD / student pay the regular fare until the accepting driver
    // approves the ID; the server prices it the same way.
    const needsApproval = discountNeedsApproval(passengerType);
    const totalFare = needsApproval
      ? this.fareService.quoteFare(distance, baseFare, perKmRate, passengerCount, multiplier, rideType, 'regular').totalFare
      : quote.totalFare;
    const estimatedDuration = Math.ceil(distance / 30 * 60);

    const row: Omit<Booking, 'id' | 'created_at'> = {
      passenger_id: passengerId,
      driver_id: null,
      pickup_location: pickup,
      dropoff_location: dropoff,
      status: 'pending',
      scheduled_time: options.scheduledTime || null,
      distance,
      estimated_duration: estimatedDuration,
      actual_duration: null,
      base_fare: baseFare,
      per_km_rate: perKmRate,
      total_fare: totalFare,
      peak_hour_multiplier: multiplier,
      passenger_count: passengerCount,
      ride_type: rideType,
      payment_method: options.paymentMethod || 'cash',
      // Every method starts unpaid. Online (demo) settles at pickup — the
      // passenger is prompted to pay when the driver confirms pickup; cash and
      // legacy wallet methods settle on trip completion.
      payment_status: 'pending',
      passenger_rating: null,
      driver_rating: null,
      notes: options.notes || null,
      // Discount columns only exist after migration 080; a regular booking
      // leaves them out so it still works on an older database.
      ...(passengerType !== 'regular'
        ? needsApproval
          ? { passenger_type: passengerType, discount_pct: 0, discount_amount: 0, discount_status: 'pending' as const }
          : { passenger_type: passengerType, discount_pct: quote.discountPct, discount_amount: quote.discountAmount }
        : {}),
      // Baggage columns only exist after migration 088; no baggage leaves them out.
      ...(baggageCount > 0 ? { baggage_count: baggageCount, baggage_size: baggageSize } : {}),
      accepted_at: null,
      started_at: null,
      completed_at: null
    };

    // On a database without the newest columns, drop them and try again so
    // the passenger can still book: before 089 the discount is applied at
    // booking (080); before 088 the baggage goes into the notes.
    let attempt = row;
    let booking: Booking | null = null;
    for (let tries = 0; !booking; tries += 1) {
      try {
        booking = await this.bookingRepo.create(attempt);
      } catch (error: any) {
        const message = String(error?.message || '');
        if (tries < 2 && 'discount_status' in attempt && /discount_status/.test(message)) {
          const { discount_status: _status, ...rest } = attempt;
          attempt = rest;
        } else if (tries < 2 && 'baggage_count' in attempt && /baggage_(count|size)/.test(message)) {
          const { baggage_count: _count, baggage_size: _size, ...rest } = attempt;
          const note = `Baggage: ${baggageSummary({ baggage_count: baggageCount, baggage_size: baggageSize })}`;
          attempt = { ...rest, notes: [rest.notes, note].filter(Boolean).join(' • ') };
        } else {
          throw error;
        }
      }
    }

    // Best-effort driver notification — the booking is already created, so a
    // notification/RLS hiccup must not fail the whole request. Drivers also
    // discover pending requests by polling when they go online.
    try {
      const nearbyDrivers = await this.userRepo.findAvailableDrivers(pickup, 5);
      await this.notificationService.notifyDrivers(nearbyDrivers, booking);
    } catch (e) {
      console.warn('notifyDrivers skipped:', e);
    }
    return booking;
  }

  async acceptBooking(bookingId: string, driverId: string): Promise<Booking> {
    const ongoing = await this.bookingRepo.findActiveByDriver(driverId);
    if (ongoing) throw new Error('Finish your current trip before accepting another ride.');
    const booking = await this.bookingRepo.assignDriver(bookingId, driverId);
    await this.userRepo.updateDriverStatus(driverId, 'on-trip');
    // Best-effort: notifying the passenger must never roll back the accept.
    try {
      await this.notificationService.notifyPassenger(
        booking.passenger_id,
        'Driver on the way',
        'A driver accepted your ride and is heading to your pickup point.'
      );
    } catch (e) {
      console.warn('passenger accept notification skipped:', e);
    }
    return booking;
  }

  async startTrip(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.updateStatus(bookingId, 'in-transit');
    // Best-effort, passenger-only: the driver initiated this, so only the
    // passenger is told the trip started.
    try {
      await this.notificationService.notifyPassenger(
        booking.passenger_id,
        'Trip started',
        'You have been picked up — enjoy the ride!'
      );
    } catch (e) {
      console.warn('trip-start notification skipped:', e);
    }
    return booking;
  }

  async completeTrip(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.updateStatus(bookingId, 'completed');
    // Best-effort: flipping the driver back to "online" must never block the
    // trip from completing. (The booking-completion DB trigger also does this.)
    if (booking.driver_id) {
      try {
        await this.userRepo.updateDriverStatus(booking.driver_id, 'online');
      } catch (e) {
        console.warn('driver status update skipped:', e);
      }
    }

    // For e-money fares (gcash / paymaya), settle the trip atomically: debit the
    // passenger's wallet and credit the driver's via the SECURITY DEFINER RPC
    // (migration 021). Best-effort and idempotent — a payment hiccup (e.g. no
    // wallet / low balance) must not block trip completion; the fare can then be
    // collected in cash. The booking's payment_status reflects the outcome.
    if (booking.payment_method === 'gcash' || booking.payment_method === 'paymaya') {
      try {
        const { data, error } = await supabase.rpc('pay_trip_with_emoney', {
          p_booking_id: bookingId,
        });
        if (error) throw error;
        if (data?.status === 'paid' || data?.status === 'already_paid') {
          booking.payment_status = 'completed';
        }
      } catch (e) {
        console.warn('e-money trip settlement skipped:', e);
      }
    }

    // Passenger-only completion notice (the driver pressed the button).
    try {
      await this.notificationService.notifyPassenger(
        booking.passenger_id,
        'Trip completed',
        `Fare ₱${(booking.total_fare ?? 0).toFixed(2)} — thanks for riding with Smart Trike!`
      );
    } catch (e) {
      console.warn('trip-complete notification skipped:', e);
    }
    return booking;
  }

  async rateTrip(
    bookingId: string,
    rating: Rating,
    target: 'passenger' | 'driver' = 'passenger'
  ): Promise<Booking> {
    return await this.bookingRepo.submitRating(bookingId, rating, target);
  }

  // Driver rates the passenger after a completed trip.
  async ratePassenger(bookingId: string, rating: Rating): Promise<Booking> {
    return await this.bookingRepo.submitDriverRating(bookingId, rating);
  }

  async cancelBooking(bookingId: string, reason: string): Promise<Booking> {
    // Only mutate the passenger-owned booking. Driver availability is released
    // and the driver is notified by database triggers (migration 068), never
    // by a passenger writing another user's rows.
    return this.bookingRepo.cancel(bookingId, reason);
  }
}

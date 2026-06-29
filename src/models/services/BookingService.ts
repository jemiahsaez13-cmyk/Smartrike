import { BookingRepository } from '@/models/repositories/BookingRepository';
import { UserRepository } from '@/models/repositories/UserRepository';
import { FareCalculationService } from './FareCalculationService';
import { NotificationService } from './NotificationService';
import { Booking, Location, Rating } from '@/models/types';
import { supabase } from '@/config/supabase';

export class BookingService {
  bookingRepo = new BookingRepository();
  userRepo = new UserRepository();
  fareService = new FareCalculationService();
  notificationService = new NotificationService();

  async createBooking(
    passengerId: string,
    pickup: Location,
    dropoff: Location,
    options: { scheduledTime?: Date; notes?: string; paymentMethod?: 'cash' | 'gcash' | 'paymaya' } = {}
  ): Promise<Booking> {
    const distance = await this.fareService.calculateDistance(pickup, dropoff);
    const { baseFare, perKmRate, multiplier } = await this.fareService.getFareConfig();
    const totalFare = this.fareService.calculateFare(distance, baseFare, perKmRate, multiplier);
    const estimatedDuration = Math.ceil(distance / 30 * 60);

    const booking = await this.bookingRepo.create({
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
      payment_method: options.paymentMethod || 'cash',
      payment_status: 'pending',
      passenger_rating: null,
      driver_rating: null,
      notes: options.notes || null,
      accepted_at: null,
      started_at: null,
      completed_at: null
    });

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
    await this.userRepo.updateDriverStatus(driverId, 'on-trip');
    const booking = await this.bookingRepo.assignDriver(bookingId, driverId);
    await this.notificationService.notifyPassenger(booking.passenger_id, 'Driver Accepted', 'Your driver is on the way!');
    return booking;
  }

  async startTrip(bookingId: string): Promise<Booking> {
    return await this.bookingRepo.updateStatus(bookingId, 'in-transit');
  }

  async completeTrip(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.updateStatus(bookingId, 'completed');
    if (booking.driver_id) await this.userRepo.updateDriverStatus(booking.driver_id, 'online');

    // For e-money fares (gcash / paymaya), settle the trip atomically: debit the
    // passenger's wallet and credit the driver's via the SECURITY DEFINER RPC
    // (migration 021). Best-effort and idempotent — a payment hiccup (e.g. no
    // wallet / low balance) must not block trip completion; the fare can then be
    // collected in cash. The booking's payment_status reflects the outcome.
    if (booking.payment_method && booking.payment_method !== 'cash') {
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

  async cancelBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) throw new Error('Booking not found');
    if (booking.driver_id) await this.userRepo.updateDriverStatus(booking.driver_id, 'online');
    return await this.bookingRepo.updateStatus(bookingId, 'cancelled');
  }
}

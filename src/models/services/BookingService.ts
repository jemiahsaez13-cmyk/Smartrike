import { BookingRepository } from '@/models/repositories/BookingRepository';
import { UserRepository } from '@/models/repositories/UserRepository';
import { FareCalculationService } from './FareCalculationService';
import { NotificationService } from './NotificationService';
import { Booking, Location } from '@/models/types';

export class BookingService {
  bookingRepo = new BookingRepository();
  userRepo = new UserRepository();
  fareService = new FareCalculationService();
  notificationService = new NotificationService();

  async createBooking(passengerId: string, pickup: Location, dropoff: Location, scheduledTime?: Date): Promise<Booking> {
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
      scheduled_time: scheduledTime || null,
      distance,
      estimated_duration: estimatedDuration,
      actual_duration: null,
      base_fare: baseFare,
      per_km_rate: perKmRate,
      total_fare: totalFare,
      peak_hour_multiplier: multiplier,
      payment_method: 'cash',
      payment_status: 'pending',
      passenger_rating: null,
      driver_rating: null,
      notes: null,
      accepted_at: null,
      started_at: null,
      completed_at: null
    });

    const nearbyDrivers = await this.userRepo.findAvailableDrivers(pickup, 5);
    await this.notificationService.notifyDrivers(nearbyDrivers, booking);
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
    return booking;
  }

  async cancelBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) throw new Error('Booking not found');
    if (booking.driver_id) await this.userRepo.updateDriverStatus(booking.driver_id, 'online');
    return await this.bookingRepo.updateStatus(bookingId, 'cancelled');
  }
}

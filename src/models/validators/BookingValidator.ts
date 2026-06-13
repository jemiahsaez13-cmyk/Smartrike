import { Location } from '@/models/types';

export class BookingValidator {
  static validateLocation(location: Location): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!location.latitude || location.latitude < -90 || location.latitude > 90) {
      errors.push('Invalid latitude');
    }
    if (!location.longitude || location.longitude < -180 || location.longitude > 180) {
      errors.push('Invalid longitude');
    }
    if (!location.address?.trim()) errors.push('Address is required');
    return { valid: errors.length === 0, errors };
  }

  static validateBookingRequest(pickup: Location, dropoff: Location): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const pickupValidation = this.validateLocation(pickup);
    if (!pickupValidation.valid) errors.push(...pickupValidation.errors.map(e => `Pickup: ${e}`));
    
    const dropoffValidation = this.validateLocation(dropoff);
    if (!dropoffValidation.valid) errors.push(...dropoffValidation.errors.map(e => `Dropoff: ${e}`));
    
    if (pickup.latitude === dropoff.latitude && pickup.longitude === dropoff.longitude) {
      errors.push('Pickup and dropoff locations cannot be the same');
    }
    return { valid: errors.length === 0, errors };
  }
}

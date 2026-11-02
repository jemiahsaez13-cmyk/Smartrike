import { supabase } from '@/config/supabase';
import { Booking } from '@/models/types';

const migrationHint = (message: string) =>
  /booking_discount_ids|attach_discount_id|revert_booking_discount|could not find the function/i.test(message)
    ? 'The discount ID needs database migration 081. Apply it in the Supabase SQL editor, then try again.'
    : message;

/**
 * Discount ID photo on a booking and the driver's "ID not valid" fare revert
 * (D5, migration 081). The photo lives in its own table so it is not sent
 * with every booking query.
 */
export class DiscountIdService {
  /** Passenger, while the booking is still pending. */
  static async attach(bookingId: string, image: string): Promise<void> {
    const { error } = await supabase.rpc('attach_discount_id', { p_booking_id: bookingId, p_image: image });
    if (error) throw new Error(migrationHint(String(error.message || 'The ID photo could not be uploaded.')));
  }

  /** The ID photo, or null when none was uploaded. RLS follows the booking. */
  static async get(bookingId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('booking_discount_ids')
      .select('image_url')
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (error) throw new Error(migrationHint(String(error.message || 'The ID photo could not be loaded.')));
    return (data as { image_url: string } | null)?.image_url ?? null;
  }

  /** Assigned driver: the ID is missing or not valid, so the regular fare applies. */
  static async revert(bookingId: string, reason: string): Promise<Booking> {
    const { data, error } = await supabase.rpc('revert_booking_discount', {
      p_booking_id: bookingId,
      p_reason: reason,
    });
    if (error) throw new Error(migrationHint(String(error.message || 'The fare could not be changed.')));
    return data as Booking;
  }
}

import { supabase } from '@/config/supabase';
import { Booking } from '@/models/types';

const migrationHint = (message: string) =>
  /review_booking_discount|discount_status/i.test(message)
    ? 'Approving the discount ID needs database migration 089. Apply it in the Supabase SQL editor, then try again.'
    : /revert_booking_discount|could not find the function/i.test(message)
    ? 'The discount ID needs database migration 081. Apply it in the Supabase SQL editor, then try again.'
    : message;

/**
 * The driver's decision on a passenger's fare discount. The driver checks the
 * physical ID at pickup; no ID photo is uploaded or stored (migration 089).
 */
export class DiscountIdService {
  /**
   * Assigned driver (migration 089): approve the senior / PWD / student ID so the
   * discount comes off the fare, or reject it (reason required) so the
   * regular fare stays. Returns the updated booking.
   */
  static async review(bookingId: string, approve: boolean, reason?: string): Promise<Booking> {
    const { data, error } = await supabase.rpc('review_booking_discount', {
      p_booking_id: bookingId,
      p_approve: approve,
      p_reason: reason ?? null,
    });
    if (error) throw new Error(migrationHint(String(error.message || 'The ID could not be reviewed.')));
    return (Array.isArray(data) ? data[0] : data) as Booking;
  }
}

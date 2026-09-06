import { supabase } from '@/config/supabase';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Booking } from '@/models/types';
import { RidePaymentSubmission } from '@/models/entities/RidePayment';
import { RidePaymentService } from './RidePaymentService';

let nextChannel = 0;

// One observer reconciles both the proof and the booking after verification.
// Realtime is an invalidation signal; polling also works before publication setup.
export const watchRidePayment = (
  bookingId: string,
  onChange: (submission: RidePaymentSubmission | null, booking: Booking | null) => void,
) => {
  const payments = new RidePaymentService();
  const bookings = new BookingRepository();
  let stopped = false;
  let running = false;
  let revision = 0;
  const refresh = async () => {
    revision += 1;
    if (running || stopped) return;
    running = true;
    try {
      let requested: number;
      do {
        requested = revision;
        try {
          const [submission, booking] = await Promise.all([
            payments.getForBooking(bookingId), bookings.findById(bookingId),
          ]);
          if (!stopped && requested === revision) onChange(submission, booking);
        } catch { /* Retain confirmed state and retry after reconnect/poll. */ }
      } while (!stopped && requested !== revision);
    } finally { running = false; }
  };
  const channel = supabase.channel(`ride-payment-sync-${bookingId}-${++nextChannel}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_payment_submissions', filter: `booking_id=eq.${bookingId}` }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` }, refresh)
    .subscribe((status: string) => { if (status === 'SUBSCRIBED') void refresh(); });
  void refresh();
  const poll = setInterval(() => { if (!running) void refresh(); }, 3000);
  return {
    refresh,
    stop: () => { stopped = true; clearInterval(poll); void supabase.removeChannel(channel); },
  };
};

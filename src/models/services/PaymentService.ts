import { TransactionRepository } from '@/models/repositories/TransactionRepository';
import { Transaction } from '@/models/types';
import { isTodayPHT, phtStartOfWeek, phtStartOfMonth } from '@/utils/dateUtils';

const repo = new TransactionRepository();

export class PaymentService {
  async createTransaction(
    bookingId: string,
    passengerId: string,
    driverId: string,
    amount: number,
    paymentMethod: 'cash' | 'gcash' | 'paymaya'
  ): Promise<Transaction> {
    return repo.create({
      booking_id: bookingId,
      passenger_id: passengerId,
      driver_id: driverId,
      amount,
      payment_method: paymentMethod,
      status: 'pending',
      completed_at: null,
      receipt_url: null,
      notes: null,
    });
  }

  async completePayment(transactionId: string): Promise<Transaction> {
    return repo.complete(transactionId);
  }

  async getPassengerTransactions(passengerId: string): Promise<Transaction[]> {
    return repo.findByPassenger(passengerId);
  }

  async getDriverTransactions(driverId: string): Promise<Transaction[]> {
    return repo.findByDriver(driverId);
  }

  async getDriverEarnings(driverId: string): Promise<{
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime: number;
  }> {
    const allTransactions = await repo.findByDriver(driverId, 500);

    // Philippine time, matching the dashboard's daily goal (driverSlice), so
    // "today" means the same thing on every screen and every device.
    const weekStart = phtStartOfWeek();
    const monthStart = phtStartOfMonth();

    const sum = (txns: Transaction[]) => txns.reduce((acc, t) => acc + (t.amount ?? 0), 0);

    return {
      today: sum(allTransactions.filter(t => t.created_at && isTodayPHT(t.created_at))),
      thisWeek: sum(allTransactions.filter(t => t.created_at && new Date(t.created_at) >= weekStart)),
      thisMonth: sum(allTransactions.filter(t => t.created_at && new Date(t.created_at) >= monthStart)),
      allTime: sum(allTransactions),
    };
  }
}

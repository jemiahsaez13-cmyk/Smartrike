import { supabase } from '@/config/supabase';
import { Transaction } from '@/models/types';

export class TransactionRepository {
  async create(transaction: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...transaction, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  async findByBooking(bookingId: string): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('booking_id', bookingId)
      .single();
    if (error) return null;
    return data;
  }

  async findByDriver(driverId: string, limit = 50): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async findByPassenger(passengerId: string, limit = 50): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('passenger_id', passengerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async complete(id: string, receiptUrl?: string): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        receipt_url: receiptUrl ?? null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getTotalEarnings(driverId: string, since?: Date): Promise<number> {
    let query = supabase
      .from('transactions')
      .select('amount')
      .eq('driver_id', driverId)
      .eq('status', 'completed');
    if (since) query = query.gte('created_at', since.toISOString());
    const { data, error } = await query;
    if (error) return 0;
    return (data ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0);
  }
}

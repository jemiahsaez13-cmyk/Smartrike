import { supabase } from '@/config/supabase';
import {
  DriverPaymentMethod,
  DriverPaymentMethodType,
  RidePaymentSubmission,
} from '@/models/entities/RidePayment';

export interface SaveDriverPaymentMethodInput {
  id?: string;
  driverId: string;
  methodType: DriverPaymentMethodType;
  displayName: string;
  accountName: string;
  accountNumber: string;
  instructions?: string;
  qrCodeUrl?: string | null;
  isEnabled: boolean;
}

const validImage = (value: string) =>
  /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value) && value.length <= 3_500_000;
const validReference = (value: string) => /^[A-Za-z0-9][A-Za-z0-9 _-]{5,63}$/.test(value.trim());

export class RidePaymentService {
  async listDriverMethods(driverId: string): Promise<DriverPaymentMethod[]> {
    const { data, error } = await supabase
      .from('driver_payment_methods')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as DriverPaymentMethod[];
  }

  async saveDriverMethod(input: SaveDriverPaymentMethodInput): Promise<DriverPaymentMethod> {
    const displayName = input.displayName.trim();
    const accountName = input.accountName.trim();
    const accountNumber = input.accountNumber.trim();
    if (displayName.length < 2) throw new Error('Enter a payment method name.');
    if (accountName.length < 2) throw new Error('Enter the account holder name.');
    if (accountNumber.length < 4) throw new Error('Enter a valid account or mobile number.');
    const qrCodeUrl = input.qrCodeUrl?.trim() || null;
    if (qrCodeUrl && !validImage(qrCodeUrl)) throw new Error('Choose a valid QR image under 2.5 MB, or leave it empty.');
    const row = {
      driver_id: input.driverId,
      method_type: input.methodType,
      display_name: displayName,
      account_name: accountName,
      account_number: accountNumber,
      instructions: input.instructions?.trim() || null,
      qr_code_url: qrCodeUrl,
      is_enabled: input.isEnabled,
      updated_at: new Date().toISOString(),
    };
    const query = input.id
      ? supabase.from('driver_payment_methods').update(row).eq('id', input.id).eq('driver_id', input.driverId)
      : supabase.from('driver_payment_methods').insert(row);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data as DriverPaymentMethod;
  }

  async setMethodEnabled(driverId: string, id: string, isEnabled: boolean): Promise<void> {
    const { error } = await supabase
      .from('driver_payment_methods')
      .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('driver_id', driverId);
    if (error) throw error;
  }

  async getMethodsForRide(bookingId: string): Promise<DriverPaymentMethod[]> {
    const { data, error } = await supabase.rpc('get_ride_driver_payment_methods', {
      p_booking_id: bookingId,
    });
    if (error) throw error;
    return (data ?? []) as DriverPaymentMethod[];
  }

  async getForBooking(bookingId: string): Promise<RidePaymentSubmission | null> {
    const { data, error } = await supabase
      .from('ride_payment_submissions')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as RidePaymentSubmission | null) ?? null;
  }

  async switchToCash(bookingId: string) {
    const { data, error } = await supabase.rpc('switch_ride_payment_to_cash', { p_booking_id: bookingId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('The payment method could not be changed.');
    return row;
  }

  async submit(bookingId: string, methodId: string, reference: string, proofUrl: string) {
    if (!methodId) throw new Error('Choose one of the driver’s available payment methods.');
    if (!validReference(reference)) throw new Error('Enter a valid reference (6 to 64 letters or numbers).');
    if (!validImage(proofUrl)) throw new Error('Upload a valid payment screenshot under 2.5 MB.');
    const { data, error } = await supabase.rpc('submit_ride_payment', {
      p_booking_id: bookingId,
      p_method_id: methodId,
      p_reference: reference.trim(),
      p_proof_url: proofUrl,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('The payment could not be submitted.');
    return row as RidePaymentSubmission;
  }

  async listForDriver(driverId: string): Promise<RidePaymentSubmission[]> {
    return this.listSubmissions('driver_id', driverId);
  }

  async listAll(): Promise<RidePaymentSubmission[]> {
    return this.listSubmissions();
  }

  private async listSubmissions(column?: 'driver_id', value?: string): Promise<RidePaymentSubmission[]> {
    let query = supabase
      .from('ride_payment_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(200);
    if (column && value) query = query.eq(column, value);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as RidePaymentSubmission[];

    // Collect all unique user IDs (passengers + drivers) then resolve names
    // in a single query to avoid N+1 fetches.
    const allUserIds = [...new Set([
      ...rows.map((row) => row.passenger_id),
      ...rows.map((row) => row.driver_id),
    ].filter(Boolean))];

    if (allUserIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id,name')
        .in('id', allUserIds);
      const names = new Map<string, string>(
        (users ?? []).map((user: any) => [user.id, user.name])
      );
      rows.forEach((row) => {
        row.passenger_name = names.get(row.passenger_id) ?? 'Passenger';
        row.driver_name = names.get(row.driver_id) ?? 'Driver';
      });
    }
    return rows;
  }

  async review(id: string, decision: 'verified' | 'rejected', reason?: string) {
    if (decision === 'rejected' && !reason?.trim()) throw new Error('Enter a rejection reason.');
    const { data, error } = await supabase.rpc('review_ride_payment', {
      p_payment_id: id,
      p_decision: decision,
      p_reason: reason?.trim() || null,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('The payment is no longer pending review.');
    return row as RidePaymentSubmission;
  }
}

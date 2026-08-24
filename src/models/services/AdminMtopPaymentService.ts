import { supabase } from '@/config/supabase';
import {
  AdminMtopPaymentMethod,
  AdminMtopPaymentMethodType,
} from '@/models/entities/AdminMtopPaymentMethod';

export interface SaveAdminMtopPaymentMethodInput {
  id?: string;
  adminId: string;
  methodType: AdminMtopPaymentMethodType;
  displayName: string;
  accountName: string;
  /** gcash / bank only */
  accountNumber?: string;
  /** face_to_face only */
  address?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  instructions?: string;
  /** gcash / bank only */
  qrCodeUrl?: string | null;
  isEnabled: boolean;
}

const validImage = (value: string) =>
  /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value) && value.length <= 3_500_000;

/**
 * Returns true when a Supabase error is caused by the table not existing yet
 * (migration 042 pending). Callers that only read data can return [] gracefully;
 * callers that write should re-throw with a human-readable message.
 */
const isTableMissing = (error: any): boolean =>
  typeof error?.message === 'string' &&
  (error.message.includes('admin_mtop_payment_methods') ||
    error.code === '42P01' ||
    error.message.toLowerCase().includes('schema cache'));

const TABLE_MISSING_MSG =
  'The billing methods table has not been created yet. ' +
  'Please apply migration 042_admin_mtop_payment_methods.sql in the Supabase SQL editor.';

export class AdminMtopPaymentService {
  async listMethods(adminId: string): Promise<AdminMtopPaymentMethod[]> {
    const { data, error } = await supabase
      .from('admin_mtop_payment_methods')
      .select('*')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: true });
    if (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
    return (data ?? []) as AdminMtopPaymentMethod[];
  }

  /** Returns all ENABLED methods regardless of admin_id (shown to applicants). */
  async listEnabledMethods(): Promise<AdminMtopPaymentMethod[]> {
    const { data, error } = await supabase
      .from('admin_mtop_payment_methods')
      .select('*')
      .eq('is_enabled', true)
      .order('created_at', { ascending: true });
    if (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
    return (data ?? []) as AdminMtopPaymentMethod[];
  }

  async saveMethod(input: SaveAdminMtopPaymentMethodInput): Promise<AdminMtopPaymentMethod> {
    const displayName = input.displayName.trim();
    const accountName = input.accountName.trim();

    if (displayName.length < 2) throw new Error('Enter a display name for this payment method.');
    if (accountName.length < 2) throw new Error('Enter a contact / account holder name.');

    const isFaceToFace = input.methodType === 'face_to_face';

    if (!isFaceToFace) {
      const num = (input.accountNumber ?? '').trim();
      if (num.length < 4) throw new Error('Enter a valid account or mobile number.');
    } else {
      const addr = (input.address ?? '').trim();
      if (addr.length < 5) throw new Error('Enter the payment venue address.');
    }

    const qrCodeUrl = input.qrCodeUrl?.trim() || null;
    if (qrCodeUrl && !validImage(qrCodeUrl)) {
      throw new Error('Choose a valid QR image under 2.5 MB, or leave it empty.');
    }

    const row = {
      admin_id: input.adminId,
      method_type: input.methodType,
      display_name: displayName,
      account_name: accountName,
      account_number: isFaceToFace ? null : (input.accountNumber?.trim() || null),
      address: isFaceToFace ? (input.address?.trim() || null) : null,
      location_lat: isFaceToFace ? (input.locationLat ?? null) : null,
      location_lng: isFaceToFace ? (input.locationLng ?? null) : null,
      instructions: input.instructions?.trim() || null,
      qr_code_url: isFaceToFace ? null : qrCodeUrl,
      is_enabled: input.isEnabled,
      updated_at: new Date().toISOString(),
    };

    const query = input.id
      ? supabase
          .from('admin_mtop_payment_methods')
          .update(row)
          .eq('id', input.id)
          .eq('admin_id', input.adminId)
      : supabase.from('admin_mtop_payment_methods').insert(row);

    const { data, error } = await query.select().single();
    if (error) {
      if (isTableMissing(error)) throw new Error(TABLE_MISSING_MSG);
      throw error;
    }
    return data as AdminMtopPaymentMethod;
  }

  async setEnabled(
    adminId: string,
    id: string,
    isEnabled: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('admin_mtop_payment_methods')
      .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('admin_id', adminId);
    if (error) {
      if (isTableMissing(error)) throw new Error(TABLE_MISSING_MSG);
      throw error;
    }
  }

  async deleteMethod(adminId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('admin_mtop_payment_methods')
      .delete()
      .eq('id', id)
      .eq('admin_id', adminId);
    if (error) {
      if (isTableMissing(error)) throw new Error(TABLE_MISSING_MSG);
      throw error;
    }
  }
}

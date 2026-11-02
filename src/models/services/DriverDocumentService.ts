import { supabase } from '@/config/supabase';
import { DriverDocument } from '@/models/entities/DriverDocument';

/**
 * Read-only access to the photos drivers uploaded at sign-up before the MTOP
 * application took over that role (migration 078). New drivers no longer
 * upload here; admins can still see older uploads on the driver profile.
 */
export class DriverDocumentService {
  /** The driver's own documents, or any driver's for an admin (RLS decides). */
  async listForDriver(driverId: string): Promise<DriverDocument[]> {
    const { data, error } = await supabase
      .from('driver_documents')
      .select('*')
      .eq('driver_id', driverId);
    if (error) throw new Error(String(error.message || 'Documents could not be loaded.'));
    return (data ?? []) as DriverDocument[];
  }
}

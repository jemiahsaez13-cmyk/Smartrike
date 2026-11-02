import { supabase } from '@/config/supabase';
import {
  DriverApplicationDraft,
  DriverDocument,
  DriverDocumentReview,
  DriverDocumentsStatus,
  DriverDocumentType,
} from '@/models/entities/DriverDocument';

// The registration form's photos are held here (not in navigation params or
// sign-up metadata, which would put megabytes into the URL or the JWT) until
// the email OTP creates the account and they can be uploaded.
const pendingDrafts = new Map<string, DriverApplicationDraft>();

const migrationHint = (message: string) =>
  /driver_documents|submit_driver_documents|could not find the function/i.test(message)
    ? 'Driver documents need database migration 078. Apply it in the Supabase SQL editor, then try again.'
    : message;

export class DriverDocumentService {
  static holdDraft(email: string, draft: DriverApplicationDraft) {
    pendingDrafts.set(email.toLowerCase(), draft);
  }

  /** Kept until the code is accepted, so a mistyped code can be retried. */
  static getDraft(email: string): DriverApplicationDraft | undefined {
    return pendingDrafts.get(email.toLowerCase());
  }

  static clearDraft(email: string) {
    pendingDrafts.delete(email.toLowerCase());
  }

  /** Uploads missing or rejected documents for the signed-in driver. */
  async submit(draft: DriverApplicationDraft): Promise<DriverDocumentsStatus> {
    const documents = (Object.entries(draft.documents) as [DriverDocumentType, string | undefined][])
      .filter(([, url]) => !!url)
      .map(([doc_type, file_url]) => ({ doc_type, file_url }));
    const { data, error } = await supabase.rpc('submit_driver_documents', {
      p_home_address: draft.homeAddress.trim(),
      p_documents: documents,
    });
    if (error) throw new Error(migrationHint(String(error.message || 'Your documents could not be submitted.')));
    return data as DriverDocumentsStatus;
  }

  /** The driver's own documents, or any driver's for an admin (RLS decides). */
  async listForDriver(driverId: string): Promise<DriverDocument[]> {
    const { data, error } = await supabase
      .from('driver_documents')
      .select('*')
      .eq('driver_id', driverId);
    if (error) throw new Error(migrationHint(String(error.message || 'Documents could not be loaded.')));
    return (data ?? []) as DriverDocument[];
  }

  /** Admin verdict on one document. Rejections need a reason the driver sees. */
  async review(id: string, status: Exclude<DriverDocumentReview, 'pending'>, remarks?: string): Promise<DriverDocument> {
    if (status === 'rejected' && !remarks?.trim()) throw new Error('Give the reason for rejecting this document.');
    const { data, error } = await supabase
      .from('driver_documents')
      .update({ review_status: status, review_remarks: status === 'rejected' ? remarks!.trim() : null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(migrationHint(String(error.message || 'The review could not be saved.')));
    return data as DriverDocument;
  }
}

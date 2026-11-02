// ─── Driver registration documents (migration 078) ───────────────────────────

export type DriverDocumentType =
  | 'drivers_license'
  | 'plate'
  | 'official_receipt'
  | 'certificate_of_registration';

export type DriverDocumentReview = 'pending' | 'approved' | 'rejected';

/** Summary kept on users.driver_documents_status by database triggers. */
export type DriverDocumentsStatus = 'missing' | 'pending' | 'approved' | 'rejected';

export interface DriverDocument {
  id: string;
  driver_id: string;
  doc_type: DriverDocumentType;
  /** data: URI of the photo (same storage approach as MTOP documents). */
  file_url: string;
  file_name: string | null;
  review_status: DriverDocumentReview;
  review_remarks: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/** Every driver must upload all four before an admin can approve them. */
export const DRIVER_DOCUMENT_TYPES: { type: DriverDocumentType; label: string; hint: string }[] = [
  { type: 'drivers_license', label: "Driver's License", hint: 'Front of your license, all text readable' },
  { type: 'plate', label: 'Plate Number', hint: 'Photo of the tricycle plate' },
  { type: 'official_receipt', label: 'Official Receipt (OR)', hint: 'Latest LTO Official Receipt' },
  { type: 'certificate_of_registration', label: 'Certificate of Registration (CR)', hint: 'LTO Certificate of Registration' },
];

export const DRIVER_DOCUMENT_LABEL: Record<DriverDocumentType, string> = Object.fromEntries(
  DRIVER_DOCUMENT_TYPES.map((d) => [d.type, d.label])
) as Record<DriverDocumentType, string>;

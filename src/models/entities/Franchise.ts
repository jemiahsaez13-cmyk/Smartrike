/**
 * MTOP / Franchise domain types (capstone Module 4: Securing Franchise).
 *
 * Models the LGU franchise lifecycle FEDTODAB coordinates: requirement
 * submission -> document verification -> inspection -> payment -> approval ->
 * issuance, plus renewals.
 */

export type FranchiseStatus =
  | 'submitted'
  | 'document_verification'
  | 'inspection'
  | 'payment' 
  | 'approved'
  | 'issued'
  | 'rejected';

export type FranchiseType = 'new' | 'renewal';

/** Operational standing of an issued franchise (separate from application review). */
export type FranchiseRecordStatus =
  | 'active'
  | 'expired'
  | 'terminated'
  | 'pending_renewal'
  | 'transferred';

export type FranchiseEventType =
  | 'renewal'
  | 'succession_transfer'
  | 'third_party_transfer'
  | 'termination'
  | 'change_of_unit';

export type SuccessorRelationship = 'spouse' | 'unmarried_eldest_child';

export type ChangeOfUnitStatus = 'pending' | 'approved' | 'rejected';

// Per-document verdict the admin records while reviewing an application.
export type DocumentReviewStatus = 'pending' | 'approved' | 'rejected';

export interface FranchiseDocument {
  name: string;
  uploaded: boolean;
  // URI/URL pointing to the uploaded scan so the admin can view it. Either an
  // http(s) URL or a data: URI (image/PDF picked on-device).
  file_url?: string | null;
  // Original filename of the picked file, shown to driver and admin.
  file_name?: string | null;
  // ISO timestamp the driver uploaded the document.
  uploaded_at?: string | null;
  // Admin verdict for this specific document.
  review_status?: DocumentReviewStatus;
  // Admin note (e.g. why a document was rejected).
  review_remarks?: string | null;
}

export interface FranchiseApplication {
  id: string;
  driver_id: string;
  driver_name: string;
  toda: string;
  plate_number: string;
  type: FranchiseType;
  status: FranchiseStatus;
  documents: FranchiseDocument[];
  inspection_result: 'pending' | 'passed' | 'failed' | null;
  payment_status: 'pending' | 'paid';
  payment_method?: 'in_person' | null;
  /**
   * Serialised JSON array of the AdminMtopPaymentMethod objects the admin
   * selected when they clicked "Send Billing". Stored as JSONB in Supabase.
   * Undefined / null means the admin hasn't sent a billing notification yet.
   */
  selected_payment_methods?: import('./AdminMtopPaymentMethod').AdminMtopPaymentMethod[] | null;
  /**
   * Snapshot of the single AdminMtopPaymentMethod the driver picked when they
   * submitted their payment proof. Set by a patch call right after the driver
   * taps "Submit Payment for Verification". Null until then.
   */
  chosen_payment_method_snapshot?: import('./AdminMtopPaymentMethod').AdminMtopPaymentMethod | null;
  payment_proof_url?: string | null;
  payment_reference?: string | null;
  payment_review_status?: 'awaiting_submission' | 'pending_review' | 'verified' | 'rejected';
  payment_submitted_at?: string | null;
  payment_verified_at?: string | null;
  payment_verified_by?: string | null;
  payment_rejection_reason?: string | null;
  /**
   * ISO date-time string set when the driver books a face-to-face payment
   * appointment.  Null until the driver submits the appointment form.
   */
  appointment_date?: string | null;
  fees: number;
  mtop_number: string | null;
  /** TODA-assigned tricycle body number shown to passengers after matching. */
  body_number?: string | null;
  /** Operational standing of an issued franchise. */
  franchise_status?: FranchiseRecordStatus | null;
  original_holder_name?: string | null;
  current_holder_name?: string | null;
  issued_at?: string | null;
  expiry_date?: string | null;
  last_renewed_at?: string | null;
  renewal_year?: number | null;
  remarks: string | null;
  // Set the moment an admin approves every submitted document.
  documents_verified_at?: string | null;
  // App user id of the admin who verified the documents.
  reviewed_by?: string | null;
  created_at: string;
  updated_at: string;
  /** Change of Unit request fields — driver-initiated, admin-reviewed */
  cou_status?: ChangeOfUnitStatus | null;
  cou_new_plate?: string | null;
  cou_new_body?: string | null;
  cou_or_number?: string | null;
  cou_cr_number?: string | null;
  cou_requested_at?: string | null;
  cou_reviewed_at?: string | null;
  cou_reviewed_by?: string | null;
  cou_rejection_reason?: string | null;
  cou_or_image?: string | null;
  cou_cr_image?: string | null;
  cou_unit_image?: string | null;
}

// Documents required by the LGU for an MTOP application.
export const REQUIRED_DOCUMENTS = [
  'Barangay Clearance',
  'Community Tax Certificate (Cedula)',
  'OR/CR of Tricycle Unit',
  'Proof of Ownership',
  'TODA Membership Certificate',
];

// Ordered lifecycle used to render the progress stepper.
export const FRANCHISE_FLOW: FranchiseStatus[] = [
  'submitted',
  'document_verification',
  'payment',
  'issued',
];

export const FRANCHISE_STATUS_LABEL: Record<FranchiseStatus, string> = {
  submitted: 'Submitted',
  document_verification: 'Verifying Documents',
  inspection: 'Unit Inspection',
  payment: 'Payment of Fees',
  approved: 'Approved',
  issued: 'MTOP Issued',
  rejected: 'Rejected',
};

export const DOCUMENT_REVIEW_LABEL: Record<DocumentReviewStatus, string> = {
  pending: 'Awaiting Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const FRANCHISE_RECORD_STATUS_LABEL: Record<FranchiseRecordStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  terminated: 'Terminated',
  pending_renewal: 'Pending Renewal',
  transferred: 'Transferred',
};

export interface FranchiseEvent {
  id: string;
  franchise_id: string;
  event_type: FranchiseEventType;
  from_holder: string | null;
  to_holder: string | null;
  relationship: SuccessorRelationship | 'third_party' | null;
  reason: string | null;
  effective_date: string;
  agreement_number: string | null;
  agreement_text: string | null;
  /** New plate number recorded on a change_of_unit event. */
  new_plate_number?: string | null;
  /** New body number recorded on a change_of_unit event. */
  new_body_number?: string | null;
  /** OR number of the new unit (from LTO). */
  or_number?: string | null;
  /** CR number of the new unit (from LTO). */
  cr_number?: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PublicDriverFranchise {
  driver_id: string;
  mtop_number: string | null;
  body_number: string | null;
  plate_number: string | null;
  franchise_status: FranchiseRecordStatus;
  current_holder_name: string | null;
  expiry_date: string | null;
  last_renewed_at: string | null;
  renewal_year: number | null;
}

// Treats a missing review_status as "pending" so legacy rows behave sensibly.
export const docReviewStatus = (doc: FranchiseDocument): DocumentReviewStatus =>
  doc.review_status ?? 'pending';

export const allDocumentsUploaded = (docs: FranchiseDocument[]): boolean =>
  docs.length > 0 && docs.every((d) => d.uploaded);

// True only when every required document has been uploaded AND approved.
export const allDocumentsApproved = (docs: FranchiseDocument[]): boolean =>
  docs.length > 0 && docs.every((d) => d.uploaded && docReviewStatus(d) === 'approved');

export const anyDocumentRejected = (docs: FranchiseDocument[]): boolean =>
  docs.some((d) => docReviewStatus(d) === 'rejected');

export interface DocumentReviewSummary {
  total: number;
  uploaded: number;
  approved: number;
  rejected: number;
  pending: number;
}

export const summarizeDocuments = (docs: FranchiseDocument[]): DocumentReviewSummary => ({
  total: docs.length,
  uploaded: docs.filter((d) => d.uploaded).length,
  approved: docs.filter((d) => docReviewStatus(d) === 'approved').length,
  rejected: docs.filter((d) => docReviewStatus(d) === 'rejected').length,
  pending: docs.filter((d) => d.uploaded && docReviewStatus(d) === 'pending').length,
});

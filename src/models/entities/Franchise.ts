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

// Per-document verdict the admin records while reviewing an application.
export type DocumentReviewStatus = 'pending' | 'approved' | 'rejected';

export interface FranchiseDocument {
  name: string;
  uploaded: boolean;
  // URI/URL pointing to the uploaded scan so the admin can view it.
  file_url?: string | null;
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
  fees: number;
  mtop_number: string | null;
  remarks: string | null;
  // Set the moment an admin approves every submitted document.
  documents_verified_at?: string | null;
  // App user id of the admin who verified the documents.
  reviewed_by?: string | null;
  created_at: string;
  updated_at: string;
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
  'inspection',
  'payment',
  'approved',
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

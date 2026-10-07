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
  | 'suspended'
  | 'transferred'
  /** Superseded by a later issued renewal of the same franchise (migration 073). */
  | 'renewed';

export type FranchiseEventType =
  | 'renewal'
  | 'succession_transfer'
  | 'third_party_transfer'
  | 'termination'
  | 'change_of_unit';

export type SuccessorRelationship = 'spouse' | 'child' | 'parent' | 'sibling' | 'other_relative';

export const SUCCESSOR_RELATIONSHIP_LABEL: Record<SuccessorRelationship, string> = {
  spouse: 'Spouse',
  child: 'Child',
  parent: 'Parent',
  sibling: 'Sibling',
  other_relative: 'Other relative',
};

/** Readable label for any stored relationship, including legacy values. */
export const relationshipLabel = (value: string | null | undefined): string =>
  !value ? '' : SUCCESSOR_RELATIONSHIP_LABEL[value as SuccessorRelationship]
    ?? value.replace(/_/g, ' ');

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
  /** Driver account license number captured when the application is submitted. */
  license_number?: string | null;
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
  /** App account of the current holder after a succession (migration 070). */
  current_holder_id?: string | null;
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
  cou_unit_type?: 'sidecar' | 'motor' | 'both' | null;
  cou_vehicle_make?: string | null;
  cou_vehicle_model?: string | null;
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
  vehicle_make?: string | null;
  vehicle_model?: string | null;
}

// Documents required by the LGU for an MTOP application.
export const REQUIRED_DOCUMENTS = [
  "Driver's License",
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

export const FRANCHISE_RECORD_STATUS_LABEL: Record<FranchiseRecordStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  terminated: 'Terminated',
  pending_renewal: 'Due for Renewal',
  suspended: 'Suspended',
  transferred: 'Transferred',
  renewed: 'Renewed',
};

// ── MTOP term and annual renewal rules (mirrors migration 073) ─────────────
// A term runs 3 years from issuance. Every year the MTOP is renewed between
// January 1 and March 31: January is the regular period, February–March the
// grace period. One missed year suspends the MTOP; three terminate it.
export const MTOP_TERM_YEARS = 3;
export const RENEWAL_LAST_MONTH = 3; // March

const pad = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISODate = (value?: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Expiry date (YYYY-MM-DD) of a term issued on `issuedAt`. */
export const mtopExpiryFrom = (issuedAt: string): string => {
  const d = parseISODate(issuedAt) ?? new Date();
  d.setFullYear(d.getFullYear() + MTOP_TERM_YEARS);
  return toISODate(d);
};

export const formatLongDate = (value?: string | null): string => {
  const d = parseISODate(value);
  return d ? d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
};

export type RenewalPhase = 'regular' | 'grace' | 'closed';

export interface RenewalStanding {
  issuedAt: string | null;
  expiryDate: string | null;
  /** Whole days until expiry (negative once expired). */
  daysToExpiry: number | null;
  /** Latest year this franchise is renewed for (the issue year counts). */
  coveredYear: number | null;
  phase: RenewalPhase;
  /** This year's renewal is still outstanding. */
  dueThisYear: boolean;
  /** The driver may file a renewal today. */
  canRenew: boolean;
  /** Renewal years that passed March 31 unrenewed. */
  missedYears: number;
  /** Next January 1 the renewal window opens, when it is closed now. */
  nextWindowYear: number;
}

export const renewalStanding = (
  app: Pick<FranchiseApplication, 'issued_at' | 'expiry_date' | 'renewal_year' | 'franchise_status'>,
  today: Date = new Date()
): RenewalStanding => {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const issued = parseISODate(app.issued_at);
  const expiryDate = app.expiry_date ? String(app.expiry_date).slice(0, 10) : app.issued_at ? mtopExpiryFrom(app.issued_at) : null;
  const expiry = parseISODate(expiryDate);
  const startOfToday = new Date(year, today.getMonth(), today.getDate());
  const daysToExpiry = expiry ? Math.round((expiry.getTime() - startOfToday.getTime()) / 86_400_000) : null;
  const coveredYear = app.renewal_year ?? (issued ? issued.getFullYear() : null);
  const phase: RenewalPhase = month === 1 ? 'regular' : month <= RENEWAL_LAST_MONTH ? 'grace' : 'closed';
  const dueThisYear = coveredYear !== null && coveredYear < year;
  const missedYears = coveredYear === null
    ? 0
    : Math.max(0, year - coveredYear - (month <= RENEWAL_LAST_MONTH ? 1 : 0));
  const blocked = app.franchise_status === 'terminated' || app.franchise_status === 'transferred' || app.franchise_status === 'renewed';
  return {
    issuedAt: app.issued_at ? String(app.issued_at).slice(0, 10) : null,
    expiryDate,
    daysToExpiry,
    coveredYear,
    phase,
    dueThisYear,
    canRenew: phase !== 'closed' && dueThisYear && !blocked,
    missedYears,
    nextWindowYear: phase === 'closed' ? year + 1 : year,
  };
};

export interface FranchiseEvent {
  id: string;
  franchise_id: string;
  event_type: FranchiseEventType;
  from_holder: string | null;
  to_holder: string | null;
  /** App account of the successor on a succession_transfer event. */
  to_user_id?: string | null;
  /** Legacy rows may still hold 'unmarried_eldest_child'. */
  relationship: SuccessorRelationship | 'unmarried_eldest_child' | 'third_party' | null;
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

/** Driver-requested succession, reviewed by an admin (migration 074). */
export type SuccessionRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SuccessionRequest {
  id: string;
  franchise_id: string;
  requested_by: string;
  requested_by_name: string;
  /** Holder's answer to "Does your successor have a Smart Trike account?" */
  successor_has_account: boolean;
  /** Matched account when the holder answered yes; set by the admin on approval. */
  successor_id: string | null;
  /** Name as typed by the holder. */
  successor_name: string;
  successor_email: string | null;
  successor_phone: string | null;
  relationship: SuccessorRelationship;
  reason: string;
  status: SuccessionRequestStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
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

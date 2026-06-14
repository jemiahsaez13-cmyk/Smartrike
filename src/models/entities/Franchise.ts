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

export interface FranchiseDocument {
  name: string;
  uploaded: boolean;
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

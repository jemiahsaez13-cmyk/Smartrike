/**
 * Admin-configured payment methods presented to MTOP applicants during the
 * billing step of the franchise lifecycle.
 *
 * - gcash / bank  → account details + optional QR code (same shape as driver
 *   payment methods, but owned by the admin/TODA office).
 * - face_to_face  → office address + optional map pin (no account number).
 */

export type AdminMtopPaymentMethodType = 'gcash' | 'bank' | 'face_to_face';

export interface AdminMtopPaymentMethod {
  id: string;
  /** Auth user id of the admin who created/owns this record. */
  admin_id: string;
  method_type: AdminMtopPaymentMethodType;
  /** Short name shown in the billing modal, e.g. "GCash – TODA Office". */
  display_name: string;
  /** Account holder name (gcash/bank) or contact person (face_to_face). */
  account_name: string;
  /** Account / mobile number (gcash/bank). Null for face_to_face. */
  account_number: string | null;
  /** Address of the payment venue for face_to_face. Null for gcash/bank. */
  address: string | null;
  /** Latitude of the payment venue pin (face_to_face only). */
  location_lat: number | null;
  /** Longitude of the payment venue pin (face_to_face only). */
  location_lng: number | null;
  /** Human-readable instructions shown to the applicant. */
  instructions: string | null;
  /** Optional QR code data-URI (gcash/bank). Null for face_to_face. */
  qr_code_url: string | null;
  is_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

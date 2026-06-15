import { isNotEmpty, isValidPlateNumber, isValidPhilippinePhone } from '@/utils/validationUtils';

export interface FranchiseFormData {
  applicant_name: string;
  applicant_contact: string;
  plate_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | string;
  toda_zone: string;
}

export class FranchiseValidator {
  static validate(data: FranchiseFormData): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    if (!isNotEmpty(data.applicant_name)) {
      errors.applicant_name = 'Full name is required';
    }

    if (!isValidPhilippinePhone(data.applicant_contact)) {
      errors.applicant_contact = 'Enter a valid PH phone number (09XXXXXXXXX)';
    }

    if (!isValidPlateNumber(data.plate_number)) {
      errors.plate_number = 'Format: ABC-1234';
    }

    if (!isNotEmpty(data.vehicle_make)) {
      errors.vehicle_make = 'Vehicle brand is required';
    }

    if (!isNotEmpty(data.vehicle_model)) {
      errors.vehicle_model = 'Vehicle model is required';
    }

    const year = Number(data.vehicle_year);
    if (!year || year < 1990 || year > new Date().getFullYear() + 1) {
      errors.vehicle_year = 'Enter a valid year';
    }

    if (!isNotEmpty(data.toda_zone)) {
      errors.toda_zone = 'TODA zone is required';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  static validateDocument(uri: string | null): boolean {
    if (!uri) return false;
    const lower = uri.toLowerCase();
    return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.pdf');
  }
}

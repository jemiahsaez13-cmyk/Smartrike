export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const PASSWORD_REQUIREMENTS =
  'Use at least 8 characters with an uppercase letter, a lowercase letter, and a number.';

export function isValidPhilippinePhone(phone: string): boolean {
  return /^(09|\+639)\d{9}$/.test(phone.trim());
}

export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('One number');
  return { valid: errors.length === 0, errors };
}

export function isValidPlateNumber(plate: string): boolean {
  return /^[A-Z]{3}-\d{3,4}$/.test(plate.trim().toUpperCase());
}

export function isValidLicenseNumber(license: string): boolean {
  return license.trim().length >= 5;
}

/** Uppercases and collapses separators so "abc  1234" and "ABC-1234" compare equal. */
export function normalizePlateNumber(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');
}

/**
 * LTO plate formats used by tricycles/motorcycles and older vehicles:
 * letters then digits ("123 ABC" is the new MC series, "AB 1234", "ABC 1234")
 * or digits then letters ("1234 AB", "123 ABC"). Space or dash separator optional.
 */
export function isValidDriverPlateNumber(plate: string): boolean {
  const p = normalizePlateNumber(plate);
  return /^([A-Z]{1,3}[ -]?\d{3,5}|\d{3,4}[ -]?[A-Z]{2,3})$/.test(p);
}

export const PLATE_NUMBER_FORMAT = 'Use a valid LTO plate, e.g. "123 ABC", "AB 1234" or "ABC 1234".';

/** Normalizes an LTO license number to the "A01-23-456789" form when possible. */
export function normalizeDriverLicenseNumber(license: string): string {
  const compact = license.trim().toUpperCase().replace(/[\s-]/g, '');
  const m = /^([A-Z]\d{2})(\d{2})(\d{6})$/.exec(compact);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : license.trim().toUpperCase();
}

/** LTO driver's license: 1 letter + 10 digits, written A01-23-456789. */
export function isValidDriverLicenseNumber(license: string): boolean {
  return /^[A-Z]\d{2}-\d{2}-\d{6}$/.test(normalizeDriverLicenseNumber(license));
}

export const LICENSE_NUMBER_FORMAT =
  'It should be 1 letter and 10 digits, like "A01-23-456789" (as printed on your LTO license).';

export function isNotEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && amount > 0 && isFinite(amount);
}

export function sanitize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

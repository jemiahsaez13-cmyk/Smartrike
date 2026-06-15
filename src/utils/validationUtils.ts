export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

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

export function isNotEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && amount > 0 && isFinite(amount);
}

export function sanitize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

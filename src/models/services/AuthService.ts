import { supabase } from '@/config/supabase';
import { UserRepository } from '@/models/repositories/UserRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  PASSWORD_REQUIREMENTS,
  isValidDriverPlateNumber,
  isValidDriverLicenseNumber,
  normalizePlateNumber,
  normalizeDriverLicenseNumber,
  PLATE_NUMBER_FORMAT,
  LICENSE_NUMBER_FORMAT,
} from '@/utils/validationUtils';

type AttemptType = 'login' | 'password-reset';

const ATTEMPT_STORAGE_KEY = '@smart-trike/auth-attempts-v1';
const ATTEMPT_LIMITS: Record<AttemptType, { max: number; windowMs: number }> = {
  login: { max: 5, windowMs: 15 * 60 * 1000 },
  'password-reset': { max: 3, windowMs: 15 * 60 * 1000 },
};

export class AuthService {
  userRepo = new UserRepository();

  private assertValidEmail(email: string) {
    if (!isValidEmail(email)) {
      throw new Error('Please enter a valid email address.');
    }
  }

  private assertValidPassword(password: string) {
    const result = isValidPassword(password);
    if (!result.valid) throw new Error(`Weak password. ${PASSWORD_REQUIREMENTS}`);
  }

  private async readAttempts(): Promise<Record<AttemptType, number[]>> {
    try {
      const stored = await AsyncStorage.getItem(ATTEMPT_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      return {
        login: Array.isArray(parsed.login) ? parsed.login : [],
        'password-reset': Array.isArray(parsed['password-reset'])
          ? parsed['password-reset']
          : [],
      };
    } catch {
      return { login: [], 'password-reset': [] };
    }
  }

  private async assertAttemptAllowed(type: AttemptType) {
    const attempts = await this.readAttempts();
    const now = Date.now();
    const { max, windowMs } = ATTEMPT_LIMITS[type];
    const recent = attempts[type].filter((timestamp) => now - timestamp < windowMs);

    if (recent.length >= max) {
      const remainingMs = windowMs - (now - recent[0]);
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
      throw new Error(`Too many attempts. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`);
    }

    if (recent.length !== attempts[type].length) {
      await AsyncStorage.setItem(
        ATTEMPT_STORAGE_KEY,
        JSON.stringify({ ...attempts, [type]: recent })
      );
    }
  }

  private async recordAttempt(type: AttemptType) {
    const attempts = await this.readAttempts();
    const now = Date.now();
    const { windowMs } = ATTEMPT_LIMITS[type];
    attempts[type] = attempts[type]
      .filter((timestamp) => now - timestamp < windowMs)
      .concat(now);
    await AsyncStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(attempts));
  }

  private async clearAttempts(type: AttemptType) {
    const attempts = await this.readAttempts();
    attempts[type] = [];
    await AsyncStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(attempts));
  }

  private authError(error: any, fallback: string): Error {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    const status = Number(error?.status || 0);

    if (status === 429 || code.includes('rate_limit') || message.includes('rate limit') || message.includes('security purposes')) {
      return new Error('Too many requests. Please wait a moment before trying again.');
    }
    if (code.includes('otp_expired') || message.includes('expired')) {
      return new Error('This verification code has expired. Request a new code and try again.');
    }
    if (code.includes('otp') || message.includes('token') || message.includes('verification code')) {
      return new Error('The verification code is incorrect. Check the code or request a new one.');
    }
    if (code.includes('weak_password') || message.includes('password should be') || message.includes('weak password')) {
      return new Error(`Weak password. ${PASSWORD_REQUIREMENTS}`);
    }
    if (code.includes('email_not_confirmed') || message.includes('email not confirmed')) {
      return new Error('Please verify your email address before signing in.');
    }
    if (message.includes('failed to fetch') || message.includes('network')) {
      return new Error('Unable to reach the authentication service. Check your connection and try again.');
    }
    return new Error(error?.message || fallback);
  }

  // Fetches the public.users profile created by the handle_new_user trigger,
  // retrying briefly to absorb replication lag after the auth insert.
  private async fetchProfileWithRetry(authId: string, attempts = 5) {
    let user = null;
    for (let i = 0; i < attempts && !user; i++) {
      user = await this.userRepo.findByAuthId(authId);
      if (!user) await new Promise((r) => setTimeout(r, 400));
    }
    return user;
  }

  // Maps Supabase signup failures to a message that says exactly what went
  // wrong. The generic authError() is tuned for OTP/login flows and would, for
  // example, report a captcha "token" failure as a wrong verification code.
  private signupError(error: any): Error {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    const status = Number(error?.status || 0);
    const reasons: string[] = Array.isArray(error?.reasons) ? error.reasons : [];

    if (code === 'email_exists' || code === 'user_already_exists' || message.includes('already registered') || message.includes('already exists')) {
      return new Error('This email is already registered. Sign in instead, or use "Forgot password" if you cannot remember it.');
    }
    if (code === 'over_email_send_rate_limit' || message.includes('email rate limit')) {
      return new Error('Too many sign-ups were made in a short time, so the verification email could not be sent. Please try again after a while (up to an hour).');
    }
    if (status === 429 || code.includes('rate_limit') || message.includes('rate limit') || message.includes('security purposes')) {
      const secs = /after (\d+) seconds/.exec(message)?.[1];
      return new Error(secs
        ? `Too many sign-up attempts. Please wait ${secs} seconds and try again.`
        : 'Too many sign-up attempts from this device or network. Please wait a few minutes and try again.');
    }
    if (code === 'signup_disabled' || message.includes('signups not allowed') || message.includes('signup is disabled')) {
      return new Error('New account registration is currently turned off. Please contact the Smart Trike administrator.');
    }
    if (code === 'email_address_invalid' || code === 'email_address_not_authorized' || (message.includes('email address') && message.includes('invalid'))) {
      return new Error('This email address cannot be used. Please use a real, active email address (e.g. Gmail or Yahoo).');
    }
    if (code === 'weak_password' || message.includes('password should') || message.includes('weak password')) {
      if (reasons.includes('pwned') || message.includes('pwned') || message.includes('leaked')) {
        return new Error('This password has appeared in a known data breach. Please choose a different password.');
      }
      return new Error(`Weak password. ${PASSWORD_REQUIREMENTS}`);
    }
    if (code.includes('captcha') || message.includes('captcha')) {
      return new Error('Security check failed. Please try again.');
    }
    if (code === 'unexpected_failure' || message.includes('database error')) {
      // The handle_new_user trigger failed while saving the profile row.
      return new Error('Your account could not be saved on the server. Please double-check your details (name, license number, plate number) and try again. If it keeps happening, contact support.');
    }
    if (status === 0 || message.includes('failed to fetch') || message.includes('network')) {
      return new Error('No internet connection or the server is unreachable. Check your connection and try again.');
    }
    if (status >= 500) {
      return new Error('The server is having problems right now. Please try again in a few minutes.');
    }
    return new Error(error?.message || 'Account creation failed. Please try again.');
  }

  // Mirrors the screen's checks so a failed signup always names the wrong field,
  // and keeps values inside the users table column limits (VARCHAR 50/255) that
  // would otherwise surface only as a vague "Database error saving new user".
  private assertValidDriverDetails(userData: any) {
    const license = String(userData?.license_number || '').trim();
    const plate = String(userData?.vehicle_details?.plate_number || '').trim();

    if (!license) throw new Error('License number is required for driver accounts.');
    if (!isValidDriverLicenseNumber(license)) throw new Error(`Invalid license number. ${LICENSE_NUMBER_FORMAT}`);
    if (!plate) throw new Error('Vehicle plate number is required for driver accounts.');
    if (!isValidDriverPlateNumber(plate)) throw new Error(`Invalid plate number. ${PLATE_NUMBER_FORMAT}`);
  }

  async signUp(email: string, password: string, userData: any) {
    const normalizedEmail = normalizeEmail(email);
    this.assertValidEmail(normalizedEmail);
    this.assertValidPassword(password);

    const name = String(userData?.name || '').trim();
    if (!name) throw new Error('Please enter your name.');
    if (name.length > 255) throw new Error('Name is too long (maximum 255 characters).');

    const isDriver = userData?.user_type === 'driver';
    if (isDriver) this.assertValidDriverDetails(userData);

    // Only public signup roles are accepted. The database trigger repeats this
    // enforcement so a modified client cannot create an administrator.
    const safeUserData = {
      name,
      user_type: isDriver ? 'driver' : 'passenger',
      ...(isDriver
        ? {
            license_number: normalizeDriverLicenseNumber(String(userData.license_number)),
            vehicle_details: {
              ...userData.vehicle_details,
              plate_number: normalizePlateNumber(String(userData.vehicle_details.plate_number)),
            },
          }
        : {}),
    };

    // 1. Create the Auth User. The profile row in `public.users` is created
    //    server-side by the `handle_new_user` trigger (migration 008) from the
    //    metadata below — this works even when there is no session yet and
    //    avoids the RLS-on-insert problem.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: safeUserData },
    });

    if (authError) throw this.signupError(authError);

    if (!authData.user) throw new Error('Account creation failed: the server returned no user. Please try again.');

    // With email confirmation on, Supabase returns a user with no identities
    // instead of an error when the address is already registered.
    if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
      throw new Error('This email is already registered. Sign in instead, or use "Forgot password" if you cannot remember it.');
    }

    // Preserve the original registration behavior when the project confirms
    // new email accounts server-side: hosted Auth can still return no session
    // from signUp even though the database confirmation trigger has completed.
    // An immediate password sign-in obtains that session without relying on an
    // SMTP code that this deployment has not configured.
    let session = authData.session;
    if (!session) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      session = signInData?.session ?? null;
    }

    // If a future deployment explicitly enables email confirmation and SMTP,
    // keep the existing code-verification route as a safe fallback.
    if (!session) {
      return { user: null, session: null, needsEmailConfirmation: true as const };
    }

    // Registration is complete immediately and the trigger-created profile is
    // available to both passengers and still-pending drivers.
    const user = await this.fetchProfileWithRetry(authData.user.id);
    if (!user) {
      // The auth account already exists, so retrying signup would now say
      // "already registered" - point the user at sign-in instead.
      throw new Error('Your account was created, but your profile is still loading. Please go to Sign In and log in with the email and password you just used.');
    }

    return { user, session, needsEmailConfirmation: false as const };
  }

  async verifySignupCode(email: string, code: string) {
    const normalizedEmail = normalizeEmail(email);
    this.assertValidEmail(normalizedEmail);
    if (!/^\d{6}$/.test(code.trim())) {
      throw new Error('Enter the complete 6-digit verification code.');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: code.trim(),
      type: 'email',
    });
    if (error) throw this.authError(error, 'Email verification failed.');
    if (!data?.user) throw new Error('Email verification failed. Request a new code and try again.');

    // Verification completes registration, but users explicitly sign in from
    // the login screen afterwards. Remove the temporary verification session.
    await supabase.auth.signOut({ scope: 'local' });
  }

  async resendSignupCode(email: string) {
    const normalizedEmail = normalizeEmail(email);
    this.assertValidEmail(normalizedEmail);
    const { error } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
    if (error) throw this.authError(error, 'A new verification code could not be sent.');
  }

  async signIn(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    this.assertValidEmail(normalizedEmail);
    if (!password) throw new Error('Please enter your password.');
    await this.assertAttemptAllowed('login');

    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: normalizedEmail,
      password 
    });
    
    if (error) {
      await this.recordAttempt('login');
      if (String(error.message || '').toLowerCase().includes('invalid login credentials')) {
        throw new Error('Incorrect email or password. Please try again.');
      }
      throw this.authError(error, 'Sign in failed. Please try again.');
    }

    await this.clearAttempts('login');

    // Look up by auth_id (UUID from the session)
    const user = await this.userRepo.findByAuthId(data.user.id);
    if (!user) {
      // Handle edge case: Auth exists but profile doesn't
      throw new Error('Your profile was not found. Please contact support.');
    }
    
    if (user.status !== 'active') {
      // The password was correct, so Supabase already stored a session. Drop
      // it, or the next app launch would restore it and skip this check.
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error(this.inactiveMessage(user.status));
    }

    return { user, session: data.session };
  }

  private inactiveMessage(status: string): string {
    if (status === 'suspended') {
      return 'Your account has been suspended by the TODA administrator. Please contact the FEDTODAB office to appeal.';
    }
    return 'Your account is inactive. Please contact the FEDTODAB office to reactivate it.';
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async resetPassword(email: string) {
    const normalizedEmail = normalizeEmail(email);
    this.assertValidEmail(normalizedEmail);
    await this.assertAttemptAllowed('password-reset');
    await this.recordAttempt('password-reset');

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
    if (error) {
      const message = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '').toLowerCase();
      // Keep reset requests enumeration-safe even if a backend deployment
      // returns an explicit missing-user error instead of the normal 200.
      if (code.includes('user_not_found') || message.includes('user not found')) return;
      throw this.authError(error, 'The password-reset email could not be sent. Please try again.');
    }
  }

  async verifyPasswordResetCode(email: string, code: string) {
    const normalizedEmail = normalizeEmail(email);
    this.assertValidEmail(normalizedEmail);
    if (!code.trim()) throw new Error('Enter the verification code from your email.');
    if (!/^\d{6}$/.test(code.trim())) throw new Error('Enter the complete 6-digit verification code.');

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: code.trim(),
      type: 'recovery',
    });
    if (error) throw this.authError(error, 'Password-reset verification failed.');
    if (!data?.session || !data?.user) {
      throw new Error('Password-reset verification failed. Request a new code and try again.');
    }
  }

  async completePasswordReset(email: string, newPassword: string) {
    const normalizedEmail = normalizeEmail(email);
    this.assertValidEmail(normalizedEmail);
    this.assertValidPassword(newPassword);

    const { data: sessionData } = await supabase.auth.getSession();
    const sessionEmail = normalizeEmail(sessionData?.session?.user?.email || '');
    if (!sessionData?.session?.user || sessionEmail !== normalizedEmail) {
      throw new Error('Your password-reset verification has expired. Request a new code.');
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw this.authError(error, 'Your password could not be updated. Please try again.');

    await this.clearAttempts('password-reset');
    await supabase.auth.signOut({ scope: 'local' });
  }

  // Sends a one-time verification code to the signed-in user's email. Required
  // before a sensitive change like updating the password.
  async sendPasswordChangeCode() {
    const { error } = await supabase.auth.reauthenticate();
    if (error) throw error;
  }

  // Updates the password, verifying the emailed code (nonce) first.
  async changePassword(newPassword: string, code: string) {
    this.assertValidPassword(newPassword);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      nonce: code.trim(),
    });
    if (error) throw this.authError(error, 'Your password could not be updated.');
  }

  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    
    const user = await this.userRepo.findByAuthId(session.user.id);
    if (!user) return null;

    // A restored session must not bypass a suspension made after sign-in.
    if (user.status !== 'active') {
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    }

    return { user, session };
  }
}

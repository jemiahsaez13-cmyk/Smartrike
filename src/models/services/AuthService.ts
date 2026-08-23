import { supabase } from '@/config/supabase';
import { UserRepository } from '@/models/repositories/UserRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  PASSWORD_REQUIREMENTS,
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

  async signUp(email: string, password: string, userData: any) {
    const normalizedEmail = normalizeEmail(email);
    this.assertValidEmail(normalizedEmail);
    this.assertValidPassword(password);

    // Only public signup roles are accepted. The database trigger repeats this
    // enforcement so a modified client cannot create an administrator.
    const safeUserData = {
      name: String(userData?.name || '').trim(),
      user_type: userData?.user_type === 'driver' ? 'driver' : 'passenger',
      ...(userData?.license_number ? { license_number: String(userData.license_number).trim() } : {}),
      ...(userData?.toda_membership ? { toda_membership: String(userData.toda_membership).trim() } : {}),
      ...(userData?.vehicle_details ? { vehicle_details: userData.vehicle_details } : {}),
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

    if (authError) {
      // Keep the response actionable without confirming whether an address is
      // registered; Supabase intentionally obscures duplicate signups.
      const duplicate = String(authError.message || '').toLowerCase().includes('already');
      if (duplicate) {
        throw new Error('Unable to create this account. Check your details or sign in instead.');
      }
      throw this.authError(authError, 'Account creation failed. Please try again.');
    }

    if (!authData.user) throw new Error('User creation failed. Please try again.');

    if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
      throw new Error('Unable to create this account. Check your details or sign in instead.');
    }

    // With email confirmation enabled Supabase returns no session. The client
    // now opens a required code-entry screen instead of bypassing verification.
    if (!authData.session) {
      return { user: null, session: null, needsEmailConfirmation: true as const };
    }

    // Confirmation disabled: registration is complete immediately.
    const user = await this.fetchProfileWithRetry(authData.user.id);
    if (!user) {
      throw new Error('Account created, but your profile could not be loaded. Please sign in.');
    }

    return { user, session: authData.session, needsEmailConfirmation: false as const };
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
      throw new Error(`Account status: ${user.status}. Please contact support.`);
    }
    
    return { user, session: data.session };
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
    
    return { user, session };
  }
}

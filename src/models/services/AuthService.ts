import { supabase } from '@/config/supabase';
import { UserRepository } from '@/models/repositories/UserRepository';

export class AuthService {
  userRepo = new UserRepository();

  async signUp(email: string, password: string, userData: any) {
    // 1. Create the Auth User. The profile row in `public.users` is created
    //    server-side by the `handle_new_user` trigger (migration 008) from the
    //    metadata below — this works even when there is no session yet (email
    //    confirmation) and avoids the RLS-on-insert problem.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: userData },
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered') ||
          authError.message.toLowerCase().includes('already been registered')) {
        throw new Error('This email is already in use. Please sign in instead.');
      }
      throw authError;
    }

    if (!authData.user) throw new Error('User creation failed. Please try again.');

    // 2a. Email-confirmation flow: no session is returned until the user
    //     confirms via the emailed link. Surface that to the UI.
    if (!authData.session) {
      return { user: null, session: null, needsEmailConfirmation: true as const };
    }

    // 2b. Auto-confirm flow: a session exists, so the profile (created by the
    //     trigger) is now readable. Fetch it. Retry briefly to absorb any
    //     replication lag between the auth insert and the profile being visible.
    let user = null;
    for (let attempt = 0; attempt < 3 && !user; attempt++) {
      user = await this.userRepo.findByAuthId(authData.user.id);
      if (!user) await new Promise((r) => setTimeout(r, 400));
    }
    if (!user) {
      throw new Error('Account created, but your profile could not be loaded. Please sign in.');
    }

    return { user, session: authData.session, needsEmailConfirmation: false as const };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password 
    });
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Incorrect email or password. Please try again.');
      }
      throw error;
    }

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

  async signInWithPhone(phone: string) {
    const { data, error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
    return data;
  }

  async verifyOtp(phone: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms'
    });
    if (error) throw error;
    if (!data.user) throw new Error('Verification failed');
    
    const user = await this.userRepo.findByAuthId(data.user.id);
    if (!user) throw new Error('Profile not found. Please register first.');
    
    return { user, session: data.session };
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  // Sends a one-time verification code to the signed-in user's email. Required
  // before a sensitive change like updating the password.
  async sendPasswordChangeCode() {
    const { error } = await supabase.auth.reauthenticate();
    if (error) throw error;
  }

  // Updates the password, verifying the emailed code (nonce) first.
  async changePassword(newPassword: string, code: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      nonce: code.trim(),
    });
    if (error) throw error;
  }

  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    
    const user = await this.userRepo.findByAuthId(session.user.id);
    if (!user) return null;
    
    return { user, session };
  }
}

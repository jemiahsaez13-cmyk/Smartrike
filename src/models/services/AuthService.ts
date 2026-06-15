import { supabase } from '@/config/supabase';
import { UserRepository } from '@/models/repositories/UserRepository';

export class AuthService {
  userRepo = new UserRepository();

  async signUp(email: string, password: string, userData: any) {
    // 1. Create the Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new Error('This email is already in use. Please sign in instead.');
      }
      throw authError;
    }
    
    if (!authData.user) throw new Error('User creation failed. Please try again.');

    // 2. Create the Public Profile
    try {
      const user = await this.userRepo.create({
        auth_id: authData.user.id,
        email,
        ...userData,
        status: 'active',
        rating: 5.0, // Start with a perfect rating for God Mode
        total_trips: 0,
        created_at: new Date().toISOString()
      });
      return { user, session: authData.session };
    } catch (profileError: any) {
      // In a real app, we might want to delete the auth user here if profile creation fails,
      // but Supabase Admin API is needed for that. For now, we report the error.
      console.error('Profile creation failed:', profileError);
      throw new Error(`Profile setup failed: ${profileError.message}`);
    }
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

  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    
    const user = await this.userRepo.findByAuthId(session.user.id);
    if (!user) return null;
    
    return { user, session };
  }
}

import { supabase } from '@/config/supabase';
import { UserRepository } from '@/models/repositories/UserRepository';

export class AuthService {
  userRepo = new UserRepository();

  async signUp(email: string, password: string, userData: any) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const user = await this.userRepo.create({
      auth_id: authData.user.id,
      email,
      ...userData,
      status: 'active',
      rating: 0,
      total_trips: 0
    });
    return { user, session: authData.session };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Look up by auth_id (UUID from the session) — avoids RLS timing issues with email lookup
    const user = await this.userRepo.findByAuthId(data.user.id);
    if (!user) throw new Error('Profile not found. Please contact support.');
    if (user.status !== 'active') throw new Error('Your account is inactive or suspended.');
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // Look up by auth_id (Supabase auth UUID), not the app's own row id
    return await this.userRepo.findByAuthId(user.id);
  }
}

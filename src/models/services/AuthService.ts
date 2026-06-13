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
    
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new Error('User not found');
    if (user.status !== 'active') throw new Error('Account is inactive');
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
    return await this.userRepo.findById(user.id);
  }
}

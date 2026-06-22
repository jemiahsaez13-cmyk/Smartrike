import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockSupabase } from './mockSupabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// When real Supabase credentials are provided we use the real client. Otherwise
// the app runs fully offline on an in-memory mock backed by seed data so the
// whole prototype (auth, bookings, driver/admin flows) works without a server.
export const supabase: any = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : mockSupabase;

// A throwaway client that never persists or refreshes a session. Used for
// operations that must NOT disturb the currently signed-in user — e.g. an admin
// inviting/creating another account (sign-up would otherwise hijack the admin's
// own session). Falls back to the mock client when no real backend is set.
export const createIsolatedClient = (): any =>
  isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : mockSupabase;

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthService } from '@/models/services/AuthService';
import { UserRepository } from '@/models/repositories/UserRepository';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import { User, Driver } from '@/models/types';

const authService = new AuthService();
const userRepo = new UserRepository();

interface AuthState {
  user: User | null;
  session: any | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  loading: false,
  error: null
};

export const signUp = createAsyncThunk(
  'auth/signUp',
  async (payload: { email: string; password: string; userData: any }, { rejectWithValue }) => {
    try {
      return await authService.signUp(payload.email, payload.password, payload.userData);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const signIn = createAsyncThunk(
  'auth/signIn',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const result = await authService.signIn(payload.email, payload.password);
      void ActivityLogService.logActivity({
        user_id: result.user.id,
        action_type: 'user_action',
        entity_type: 'user',
        entity_id: result.user.id,
        description: `${result.user.name} signed in.`,
        severity: 'info',
      });
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const signOut = createAsyncThunk('auth/signOut', async () => {
  // Best-effort remote sign-out. Demo sessions and expired/missing Supabase
  // sessions throw here, but logout must always succeed locally — the
  // fulfilled reducer clears the auth state regardless of the remote result.
  try {
    await authService.signOut();
  } catch (error) {
    console.warn('Remote sign-out failed; clearing local session anyway:', error);
  }
});

export const checkSession = createAsyncThunk('auth/checkSession', async (_, { rejectWithValue }) => {
  try {
    return await authService.getCurrentUser();
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

// Persists profile edits (name, phone, photo, vehicle, bank account, etc.).
// Demo sessions have no DB row, so they update locally only.
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (updates: Partial<Driver>, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const current = state.auth.user as User | null;
      if (!current) throw new Error('You are not signed in.');
      const isDemo = Boolean(state.auth.session?.demo) || current.id?.startsWith('demo-');
      if (isDemo) {
        return { ...current, ...updates } as User;
      }
      const updated = await userRepo.update(current.id, updates as Partial<User>);
      void ActivityLogService.logActivity({
        user_id: current.id,
        action_type: 'user_action',
        entity_type: 'user',
        entity_id: current.id,
        description: `${updated.name} updated their profile.`,
        severity: 'info',
      });
      return updated;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signUp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.loading = false;
        // Email-confirmation flow returns no user/session yet — stay logged out
        // and let the screen prompt the user to confirm their email.
        if (action.payload?.user && action.payload?.session) {
          state.user = action.payload.user;
          state.session = action.payload.session;
          state.isAuthenticated = true;
        }
      })
      .addCase(signUp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(signIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.session = action.payload.session;
        state.isAuthenticated = true;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload as User;
      })
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.session = null;
        state.isAuthenticated = false;
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload.user;
          state.session = action.payload.session;
          state.isAuthenticated = true;
        } else {
          state.isAuthenticated = false;
        }
      });
  }
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;

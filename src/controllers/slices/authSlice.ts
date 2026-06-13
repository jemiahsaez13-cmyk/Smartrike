import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthService } from '@/models/services/AuthService';
import { User } from '@/models/types';

const authService = new AuthService();

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

export const setDemoUser = (userType: 'passenger' | 'driver' | 'admin') => ({
  type: 'auth/setDemoUser',
  payload: {
    id: `demo-${userType}`,
    auth_id: 'demo-auth',
    user_type: userType,
    email: `demo@${userType}.com`,
    phone: '09123456789',
    name: `Demo ${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
    profile_photo_url: null,
    created_at: new Date(),
    status: 'active' as const,
    rating: 4.5,
    total_trips: 10
  }
});

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
      return await authService.signIn(payload.email, payload.password);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const signOut = createAsyncThunk('auth/signOut', async (_, { rejectWithValue }) => {
  try {
    await authService.signOut();
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

export const checkSession = createAsyncThunk('auth/checkSession', async (_, { rejectWithValue }) => {
  try {
    return await authService.getCurrentUser();
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

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
    setDemoUserReducer: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.session = { demo: true };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signUp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.session = action.payload.session;
        state.isAuthenticated = true;
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
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.session = null;
        state.isAuthenticated = false;
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
          state.isAuthenticated = true;
        }
      });
  }
});

export const { clearError, setUser, setDemoUserReducer } = authSlice.actions;
export default authSlice.reducer;

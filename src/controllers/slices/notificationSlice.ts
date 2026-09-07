import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/config/supabase';
import { NotificationService } from '@/models/services/NotificationService';

const notificationService = new NotificationService();

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  booking_id?: string | null;
  violation_id?: string | null;
  read: boolean;
  created_at: string;
}

interface NotificationState {
  userId: string | null;
  fetchRequestId: string | null;
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  userId: null,
  fetchRequestId: null,
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

export const fetchNotifications = createAsyncThunk(
  'notification/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

// Marks one notification read locally (optimistic) and persists it. The local
// state is updated immediately by the markNotificationRead reducer dispatched
// from the screen, so a failed write just logs without reverting the UI.
export const markReadAndPersist = createAsyncThunk(
  'notification/markReadAndPersist',
  async (id: string) => {
    await notificationService.markAsRead(id);
    return id;
  }
);

export const markAllReadAndPersist = createAsyncThunk(
  'notification/markAllReadAndPersist',
  async (userId: string) => {
    await notificationService.markAllAsRead(userId);
    return userId;
  }
);

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<AppNotification>) {
      // Realtime can deliver a row we already have (e.g. inserted locally then
      // echoed back) — dedupe by id so live updates never double-count.
      if (action.payload.user_id !== state.userId) return;
      const index = state.notifications.findIndex(n => n.id === action.payload.id);
      if (index >= 0) state.notifications[index] = action.payload;
      else state.notifications.unshift(action.payload);
      state.notifications.sort((a, b) => b.created_at.localeCompare(a.created_at));
      state.unreadCount = state.notifications.filter(n => !n.read).length;
    },
    markNotificationRead(state, action: PayloadAction<string>) {
      const notif = state.notifications.find(n => n.id === action.payload);
      if (notif && !notif.read) {
        notif.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllRead(state) {
      state.notifications.forEach(n => { n.read = true; });
      state.unreadCount = 0;
    },
    clearNotifications(state) {
      state.notifications = [];
      state.unreadCount = 0;
      state.userId = null;
      state.fetchRequestId = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state, action) => {
        if (state.userId !== action.meta.arg) {
          state.notifications = [];
          state.unreadCount = 0;
        }
        state.userId = action.meta.arg;
        state.fetchRequestId = action.meta.requestId;
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        if (state.fetchRequestId !== action.meta.requestId || state.userId !== action.meta.arg) return;
        state.loading = false;
        state.notifications = action.payload;
        state.unreadCount = action.payload.filter((n: AppNotification) => !n.read).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        if (state.fetchRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  addNotification,
  markNotificationRead,
  markAllRead,
  clearNotifications,
} = notificationSlice.actions;

export default notificationSlice.reducer;

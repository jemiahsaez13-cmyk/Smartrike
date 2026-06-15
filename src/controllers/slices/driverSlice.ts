import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserRepository } from '@/models/repositories/UserRepository';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Driver, Booking } from '@/models/types';
import { startTrip } from './bookingSlice';

const userRepo = new UserRepository();
const bookingRepo = new BookingRepository();

interface DriverState {
  driverInfo: Driver | null;
  currentStatus: 'online' | 'offline' | 'on-trip';
  currentTrip: Booking | null;
  incomingRequests: Booking[];
  completedTrips: Booking[];
  totalEarnings: number;
  dailyEarnings: number;
  loading: boolean;
  error: string | null;
}

const initialState: DriverState = {
  driverInfo: null,
  currentStatus: 'offline',
  currentTrip: null,
  incomingRequests: [],
  completedTrips: [],
  totalEarnings: 0,
  dailyEarnings: 0,
  loading: false,
  error: null
};

export const updateDriverStatus = createAsyncThunk(
  'driver/updateStatus',
  async (payload: { driverId: string; status: Driver['current_status'] }, { rejectWithValue }) => {
    try {
      await userRepo.updateDriverStatus(payload.driverId, payload.status);
      return payload.status;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const acceptBooking = createAsyncThunk(
  'driver/acceptBooking',
  async (payload: { bookingId: string; driverId: string }, { rejectWithValue }) => {
    try {
      const booking = await bookingRepo.assignDriver(payload.bookingId, payload.driverId);
      await userRepo.updateDriverStatus(payload.driverId, 'on-trip');
      return booking;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCompletedTrips = createAsyncThunk('driver/fetchCompletedTrips', async (driverId: string, { rejectWithValue }) => {
  try {
    return await bookingRepo.findByDriver(driverId);
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

const driverSlice = createSlice({
  name: 'driver',
  initialState,
  reducers: {
    setDriverInfo: (state, action: PayloadAction<Driver>) => {
      state.driverInfo = action.payload;
      state.currentStatus = action.payload.current_status;
      state.totalEarnings = action.payload.total_earnings;
    },
    addIncomingRequest: (state, action: PayloadAction<Booking>) => {
      // Check if already in list to avoid duplicates
      if (!state.incomingRequests.find(r => r.id === action.payload.id)) {
        state.incomingRequests.unshift(action.payload);
      }
    },
    removeIncomingRequest: (state, action: PayloadAction<string>) => {
      state.incomingRequests = state.incomingRequests.filter(r => r.id !== action.payload);
    },
    updateDailyEarnings: (state, action: PayloadAction<number>) => {
      state.dailyEarnings += action.payload;
    },
    clearCurrentTrip: (state) => {
      state.currentTrip = null;
      state.currentStatus = 'online';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateDriverStatus.fulfilled, (state, action) => {
        state.currentStatus = action.payload;
        if (action.payload === 'online') {
          state.currentTrip = null;
        }
      })
      .addCase(acceptBooking.pending, (state) => {
        state.loading = true;
      })
      .addCase(acceptBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.currentStatus = 'on-trip';
        state.currentTrip = action.payload;
        state.incomingRequests = state.incomingRequests.filter(r => r.id !== action.payload.id);
      })
      .addCase(acceptBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(startTrip.fulfilled, (state, action) => {
        if (state.currentTrip && action.payload?.id === state.currentTrip.id) {
          state.currentTrip = action.payload;
        }
      })
      .addCase(fetchCompletedTrips.fulfilled, (state, action) => {
        state.completedTrips = action.payload.filter(b => b.status === 'completed');
        const today = new Date().toDateString();
        state.dailyEarnings = action.payload
          .filter(b => b.completed_at && new Date(b.completed_at).toDateString() === today)
          .reduce((sum, b) => sum + b.total_fare, 0);
      });
  }
});

export const { setDriverInfo, addIncomingRequest, removeIncomingRequest, updateDailyEarnings, clearCurrentTrip } = driverSlice.actions;
export default driverSlice.reducer;

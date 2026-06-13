import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserRepository } from '@/models/repositories/UserRepository';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Driver, Booking } from '@/models/types';

const userRepo = new UserRepository();
const bookingRepo = new BookingRepository();

interface DriverState {
  driverInfo: Driver | null;
  currentStatus: 'online' | 'offline' | 'on-trip';
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
      state.incomingRequests.push(action.payload);
    },
    removeIncomingRequest: (state, action: PayloadAction<string>) => {
      state.incomingRequests = state.incomingRequests.filter(r => r.id !== action.payload);
    },
    updateDailyEarnings: (state, action: PayloadAction<number>) => {
      state.dailyEarnings += action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateDriverStatus.fulfilled, (state, action) => {
        state.currentStatus = action.payload;
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

export const { setDriverInfo, addIncomingRequest, removeIncomingRequest, updateDailyEarnings } = driverSlice.actions;
export default driverSlice.reducer;

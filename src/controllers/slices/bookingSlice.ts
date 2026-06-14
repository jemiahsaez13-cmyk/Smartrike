import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { BookingService } from '@/models/services/BookingService';
import { Booking, Location, Rating } from '@/models/types';

const bookingService = new BookingService();

interface BookingState {
  currentBooking: Booking | null;
  bookingHistory: Booking[];
  activeBookings: Booking[];
  loading: boolean;
  error: string | null;
  searchingForDriver: boolean;
}

const initialState: BookingState = {
  currentBooking: null,
  bookingHistory: [],
  activeBookings: [],
  loading: false,
  error: null,
  searchingForDriver: false
};

export const createBooking = createAsyncThunk(
  'booking/create',
  async (payload: { passengerId: string; pickup: Location; dropoff: Location; scheduledTime?: Date }, { rejectWithValue }) => {
    try {
      return await bookingService.createBooking(payload.passengerId, payload.pickup, payload.dropoff, payload.scheduledTime);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const acceptBooking = createAsyncThunk(
  'booking/accept',
  async (payload: { bookingId: string; driverId: string }, { rejectWithValue }) => {
    try {
      return await bookingService.acceptBooking(payload.bookingId, payload.driverId);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const startTrip = createAsyncThunk('booking/startTrip', async (bookingId: string, { rejectWithValue }) => {
  try {
    return await bookingService.startTrip(bookingId);
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

export const completeTrip = createAsyncThunk('booking/completeTrip', async (bookingId: string, { rejectWithValue }) => {
  try {
    return await bookingService.completeTrip(bookingId);
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

export const submitRating = createAsyncThunk(
  'booking/rate',
  async (payload: { bookingId: string; rating: Rating }, { rejectWithValue }) => {
    try {
      return await bookingService.rateTrip(payload.bookingId, payload.rating);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const cancelBooking = createAsyncThunk('booking/cancel', async (bookingId: string, { rejectWithValue }) => {
  try {
    return await bookingService.cancelBooking(bookingId);
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    clearCurrentBooking: (state) => {
      state.currentBooking = null;
      state.searchingForDriver = false;
    },
    updateBookingStatus: (state, action: PayloadAction<Booking>) => {
      state.currentBooking = action.payload;
      if (action.payload.status === 'accepted') state.searchingForDriver = false;
    },
    setSearchingForDriver: (state, action: PayloadAction<boolean>) => {
      state.searchingForDriver = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(createBooking.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.searchingForDriver = true;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.currentBooking = action.payload;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.searchingForDriver = false;
      })
      .addCase(acceptBooking.fulfilled, (state, action) => {
        state.currentBooking = action.payload;
        state.searchingForDriver = false;
      })
      .addCase(startTrip.fulfilled, (state, action) => {
        state.currentBooking = action.payload;
      })
      .addCase(completeTrip.fulfilled, (state, action) => {
        state.bookingHistory.unshift(action.payload);
        state.currentBooking = null;
      })
      .addCase(cancelBooking.fulfilled, (state) => {
        state.currentBooking = null;
        state.searchingForDriver = false;
      });
  }
});

export const { clearCurrentBooking, updateBookingStatus, setSearchingForDriver } = bookingSlice.actions;
export default bookingSlice.reducer;

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { BookingService } from '@/models/services/BookingService';
import { ActivityLogService } from '@/models/services/ActivityLogService';
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
  async (
    payload: {
      passengerId: string;
      pickup: Location;
      dropoff: Location;
      scheduledTime?: Date;
      notes?: string;
      paymentMethod?: 'cash' | 'gcash' | 'paymaya';
    },
    { rejectWithValue }
  ) => {
    try {
      const booking = await bookingService.createBooking(payload.passengerId, payload.pickup, payload.dropoff, {
        scheduledTime: payload.scheduledTime,
        notes: payload.notes,
        paymentMethod: payload.paymentMethod,
      });
      void ActivityLogService.logActivity({
        user_id: payload.passengerId,
        action_type: 'booking_created',
        entity_type: 'booking',
        entity_id: booking.id,
        description: `New ride request from ${payload.pickup.address} to ${payload.dropoff.address}.`,
        severity: 'info',
      });
      return booking;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const acceptBooking = createAsyncThunk(
  'booking/accept',
  async (payload: { bookingId: string; driverId: string }, { rejectWithValue }) => {
    try {
      const booking = await bookingService.acceptBooking(payload.bookingId, payload.driverId);
      void ActivityLogService.logActivity({
        user_id: payload.driverId,
        action_type: 'driver_status_changed',
        entity_type: 'booking',
        entity_id: payload.bookingId,
        description: 'Driver accepted a ride request.',
        severity: 'success',
      });
      return booking;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const startTrip = createAsyncThunk('booking/startTrip', async (bookingId: string, { rejectWithValue }) => {
  try {
    const booking = await bookingService.startTrip(bookingId);
    void ActivityLogService.logActivity({
      user_id: (booking as any)?.driver_id,
      action_type: 'driver_status_changed',
      entity_type: 'booking',
      entity_id: bookingId,
      description: 'Trip started — driver is on the way.',
      severity: 'info',
    });
    return booking;
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

export const completeTrip = createAsyncThunk('booking/completeTrip', async (bookingId: string, { rejectWithValue }) => {
  try {
    const booking = await bookingService.completeTrip(bookingId);
    void ActivityLogService.logActivity({
      user_id: (booking as any)?.driver_id,
      action_type: 'booking_completed',
      entity_type: 'booking',
      entity_id: bookingId,
      description: `Trip completed${(booking as any)?.total_fare ? ` • ₱${(booking as any).total_fare}` : ''}.`,
      severity: 'success',
    });
    return booking;
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

export const submitDriverRating = createAsyncThunk(
  'booking/rateDriverSide',
  async (payload: { bookingId: string; rating: Rating }, { rejectWithValue }) => {
    try {
      return await bookingService.ratePassenger(payload.bookingId, payload.rating);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const cancelBooking = createAsyncThunk('booking/cancel', async (bookingId: string, { rejectWithValue }) => {
  try {
    const result = await bookingService.cancelBooking(bookingId);
    void ActivityLogService.logActivity({
      action_type: 'booking_cancelled',
      entity_type: 'booking',
      entity_id: bookingId,
      description: 'A booking was cancelled.',
      severity: 'warning',
    });
    return result;
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

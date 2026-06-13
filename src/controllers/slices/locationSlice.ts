import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { LocationService } from '@/models/services/LocationService';
import { Location } from '@/models/types';

const locationService = new LocationService();

interface LocationState {
  currentLocation: Location | null;
  driverLocation: Location | null;
  watchId: any | null;
  loading: boolean;
  error: string | null;
  permissionGranted: boolean;
}

const initialState: LocationState = {
  currentLocation: null,
  driverLocation: null,
  watchId: null,
  loading: false,
  error: null,
  permissionGranted: false
};

export const getCurrentLocation = createAsyncThunk('location/getCurrent', async (_, { rejectWithValue }) => {
  try {
    return await locationService.getCurrentPosition();
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

export const updateDriverLocation = createAsyncThunk(
  'location/updateDriver',
  async (payload: { driverId: string; location: Location }, { rejectWithValue }) => {
    try {
      await locationService.updateDriverLocation(payload.driverId, payload.location);
      return payload.location;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchDriverLocation = createAsyncThunk('location/fetchDriver', async (driverId: string, { rejectWithValue }) => {
  try {
    return await locationService.getDriverLocation(driverId);
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setCurrentLocation: (state, action: PayloadAction<Location>) => {
      state.currentLocation = action.payload;
    },
    setDriverLocation: (state, action: PayloadAction<Location>) => {
      state.driverLocation = action.payload;
    },
    setWatchId: (state, action: PayloadAction<any>) => {
      state.watchId = action.payload;
    },
    clearWatchId: (state) => {
      state.watchId = null;
    },
    setPermissionGranted: (state, action: PayloadAction<boolean>) => {
      state.permissionGranted = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getCurrentLocation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getCurrentLocation.fulfilled, (state, action) => {
        state.loading = false;
        state.currentLocation = action.payload;
      })
      .addCase(getCurrentLocation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateDriverLocation.fulfilled, (state, action) => {
        state.currentLocation = action.payload;
      })
      .addCase(fetchDriverLocation.fulfilled, (state, action) => {
        state.driverLocation = action.payload;
      });
  }
});

export const { setCurrentLocation, setDriverLocation, setWatchId, clearWatchId, setPermissionGranted } = locationSlice.actions;
export default locationSlice.reducer;

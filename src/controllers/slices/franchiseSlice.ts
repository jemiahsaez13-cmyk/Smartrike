import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { FranchiseService } from '@/models/services/FranchiseService';
import { FranchiseApplication, FranchiseStatus } from '@/models/entities/Franchise';

const service = new FranchiseService();

interface FranchiseState {
  myApplication: FranchiseApplication | null;
  applications: FranchiseApplication[];
  loading: boolean;
  error: string | null;
}

const initialState: FranchiseState = {
  myApplication: null,
  applications: [],
  loading: false,
  error: null,
};

export const fetchMyApplication = createAsyncThunk(
  'franchise/fetchMine',
  async (driverId: string, { rejectWithValue }) => {
    try {
      return await service.getByDriver(driverId);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAllApplications = createAsyncThunk(
  'franchise/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await service.getAll();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const submitApplication = createAsyncThunk(
  'franchise/submit',
  async (payload: Partial<FranchiseApplication>, { rejectWithValue }) => {
    try {
      return await service.submit(payload);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const advanceApplication = createAsyncThunk(
  'franchise/advance',
  async (
    payload: { id: string; status: FranchiseStatus; patch?: Partial<FranchiseApplication> },
    { rejectWithValue }
  ) => {
    try {
      return await service.updateStatus(payload.id, payload.status, payload.patch);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const upsert = (list: FranchiseApplication[], item: FranchiseApplication) => {
  const idx = list.findIndex((a) => a.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
};

const franchiseSlice = createSlice({
  name: 'franchise',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyApplication.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMyApplication.fulfilled, (state, action) => {
        state.loading = false;
        state.myApplication = action.payload;
      })
      .addCase(fetchMyApplication.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAllApplications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAllApplications.fulfilled, (state, action) => {
        state.loading = false;
        state.applications = action.payload;
      })
      .addCase(submitApplication.fulfilled, (state, action) => {
        state.myApplication = action.payload;
        upsert(state.applications, action.payload);
      })
      .addCase(advanceApplication.fulfilled, (state, action) => {
        upsert(state.applications, action.payload);
        if (state.myApplication?.id === action.payload.id) {
          state.myApplication = action.payload;
        }
      });
  },
});

export default franchiseSlice.reducer;

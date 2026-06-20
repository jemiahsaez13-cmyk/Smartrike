import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { FranchiseService } from '@/models/services/FranchiseService';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import {
  FranchiseApplication,
  FranchiseStatus,
  FRANCHISE_STATUS_LABEL,
} from '@/models/entities/Franchise';

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
      const app = await service.submit(payload);
      void ActivityLogService.logActivity({
        user_id: app.driver_id,
        action_type: 'user_action',
        entity_type: 'driver',
        entity_id: app.id,
        description: `${app.driver_name} submitted an MTOP ${app.type} application (${app.plate_number}).`,
        severity: 'info',
      });
      return app;
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
      const updated = await service.updateStatus(payload.id, payload.status, payload.patch);
      const severity =
        updated.status === 'rejected' ? 'warning' : updated.status === 'issued' ? 'success' : 'info';
      void ActivityLogService.logActivity({
        action_type: 'system_alert',
        entity_type: 'system',
        entity_id: updated.id,
        description: `Franchise ${updated.plate_number} (${updated.driver_name}) → ${FRANCHISE_STATUS_LABEL[updated.status]}.`,
        severity,
      });
      return updated;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Patches fields (e.g. per-document review verdicts) without changing status.
export const patchApplication = createAsyncThunk(
  'franchise/patch',
  async (
    payload: { id: string; patch: Partial<FranchiseApplication> },
    { rejectWithValue }
  ) => {
    try {
      return await service.patch(payload.id, payload.patch);
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
      })
      .addCase(patchApplication.fulfilled, (state, action) => {
        upsert(state.applications, action.payload);
        if (state.myApplication?.id === action.payload.id) {
          state.myApplication = action.payload;
        }
      });
  },
});

export default franchiseSlice.reducer;

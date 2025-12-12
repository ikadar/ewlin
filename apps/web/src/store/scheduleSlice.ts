import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
  ScheduleSnapshot,
  Assignment,
  ProposedAssignment,
  ValidationResult,
  CreateStationDto,
  UpdateStationDto,
  CreateProviderDto,
  UpdateProviderDto,
  CreateJobDto,
  UpdateJobDto,
} from '../types';
import { api } from '../services/api';

interface ScheduleState {
  snapshot: ScheduleSnapshot | null;
  loading: boolean;
  error: string | null;
  lastValidation: ValidationResult | null;
}

const initialState: ScheduleState = {
  snapshot: null,
  loading: false,
  error: null,
  lastValidation: null,
};

// Async thunks
export const fetchSnapshot = createAsyncThunk(
  'schedule/fetchSnapshot',
  async (timeRange: string) => {
    return await api.getSnapshot(timeRange);
  }
);

export const createAssignment = createAsyncThunk(
  'schedule/createAssignment',
  async (assignment: ProposedAssignment) => {
    return await api.createAssignment(assignment);
  }
);

export const updateAssignment = createAsyncThunk(
  'schedule/updateAssignment',
  async ({ id, updates }: { id: string; updates: Partial<Assignment> }) => {
    return await api.updateAssignment(id, updates);
  }
);

export const deleteAssignment = createAsyncThunk(
  'schedule/deleteAssignment',
  async (id: string) => {
    await api.deleteAssignment(id);
    return id;
  }
);

// Station CRUD
export const createStation = createAsyncThunk(
  'schedule/createStation',
  async (data: CreateStationDto) => {
    return await api.createStation(data);
  }
);

export const updateStation = createAsyncThunk(
  'schedule/updateStation',
  async ({ id, data }: { id: string; data: UpdateStationDto }) => {
    return await api.updateStation(id, data);
  }
);

export const deleteStation = createAsyncThunk(
  'schedule/deleteStation',
  async (id: string) => {
    await api.deleteStation(id);
    return id;
  }
);

// Provider CRUD
export const createProvider = createAsyncThunk(
  'schedule/createProvider',
  async (data: CreateProviderDto) => {
    return await api.createProvider(data);
  }
);

export const updateProvider = createAsyncThunk(
  'schedule/updateProvider',
  async ({ id, data }: { id: string; data: UpdateProviderDto }) => {
    return await api.updateProvider(id, data);
  }
);

export const deleteProvider = createAsyncThunk(
  'schedule/deleteProvider',
  async (id: string) => {
    await api.deleteProvider(id);
    return id;
  }
);

// Job CRUD
export const createJob = createAsyncThunk(
  'schedule/createJob',
  async (data: CreateJobDto) => {
    return await api.createJob(data);
  }
);

export const updateJob = createAsyncThunk(
  'schedule/updateJob',
  async ({ id, data }: { id: string; data: UpdateJobDto }) => {
    return await api.updateJob(id, data);
  }
);

export const deleteJob = createAsyncThunk(
  'schedule/deleteJob',
  async (id: string) => {
    await api.deleteJob(id);
    return id;
  }
);

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {
    setValidationResult: (state, action: PayloadAction<ValidationResult>) => {
      state.lastValidation = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch snapshot
      .addCase(fetchSnapshot.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSnapshot.fulfilled, (state, action) => {
        state.loading = false;
        state.snapshot = action.payload;
      })
      .addCase(fetchSnapshot.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch snapshot';
      })
      // Create assignment
      .addCase(createAssignment.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.assignments.push(action.payload);
          state.snapshot.snapshotVersion++;
        }
      })
      // Update assignment
      .addCase(updateAssignment.fulfilled, (state, action) => {
        if (state.snapshot) {
          const index = state.snapshot.assignments.findIndex(
            (a) => a.id === action.payload.id
          );
          if (index !== -1) {
            state.snapshot.assignments[index] = action.payload;
            state.snapshot.snapshotVersion++;
          }
        }
      })
      // Delete assignment
      .addCase(deleteAssignment.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.assignments = state.snapshot.assignments.filter(
            (a) => a.id !== action.payload
          );
          state.snapshot.snapshotVersion++;
        }
      })
      // Station CRUD
      .addCase(createStation.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.stations.push(action.payload);
          state.snapshot.snapshotVersion++;
        }
      })
      .addCase(updateStation.fulfilled, (state, action) => {
        if (state.snapshot) {
          const index = state.snapshot.stations.findIndex(
            (s) => s.id === action.payload.id
          );
          if (index !== -1) {
            state.snapshot.stations[index] = action.payload;
            state.snapshot.snapshotVersion++;
          }
        }
      })
      .addCase(deleteStation.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.stations = state.snapshot.stations.filter(
            (s) => s.id !== action.payload
          );
          state.snapshot.snapshotVersion++;
        }
      })
      // Provider CRUD
      .addCase(createProvider.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.providers.push(action.payload);
          state.snapshot.snapshotVersion++;
        }
      })
      .addCase(updateProvider.fulfilled, (state, action) => {
        if (state.snapshot) {
          const index = state.snapshot.providers.findIndex(
            (p) => p.id === action.payload.id
          );
          if (index !== -1) {
            state.snapshot.providers[index] = action.payload;
            state.snapshot.snapshotVersion++;
          }
        }
      })
      .addCase(deleteProvider.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.providers = state.snapshot.providers.filter(
            (p) => p.id !== action.payload
          );
          state.snapshot.snapshotVersion++;
        }
      })
      // Job CRUD
      .addCase(createJob.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.jobs.push(action.payload);
          state.snapshot.snapshotVersion++;
        }
      })
      .addCase(updateJob.fulfilled, (state, action) => {
        if (state.snapshot) {
          const index = state.snapshot.jobs.findIndex(
            (j) => j.id === action.payload.id
          );
          if (index !== -1) {
            state.snapshot.jobs[index] = action.payload;
            state.snapshot.snapshotVersion++;
          }
        }
      })
      .addCase(deleteJob.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.jobs = state.snapshot.jobs.filter(
            (j) => j.id !== action.payload
          );
          state.snapshot.snapshotVersion++;
        }
      });
  },
});

export const { setValidationResult, clearError } = scheduleSlice.actions;
export const scheduleReducer = scheduleSlice.reducer;

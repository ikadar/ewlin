import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
  ScheduleSnapshot,
  Assignment,
  Operator,
  Equipment,
  Job,
  Task,
  ProposedAssignment,
  ValidationResult,
  CreateOperatorDto,
  UpdateOperatorDto,
  CreateEquipmentDto,
  UpdateEquipmentDto,
  CreateJobDto,
  UpdateJobDto,
  CreateTaskDto,
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

// Operator CRUD
export const createOperator = createAsyncThunk(
  'schedule/createOperator',
  async (data: CreateOperatorDto) => {
    return await api.createOperator(data);
  }
);

export const updateOperator = createAsyncThunk(
  'schedule/updateOperator',
  async ({ id, data }: { id: string; data: UpdateOperatorDto }) => {
    return await api.updateOperator(id, data);
  }
);

export const deleteOperator = createAsyncThunk(
  'schedule/deleteOperator',
  async (id: string) => {
    await api.deleteOperator(id);
    return id;
  }
);

// Equipment CRUD
export const createEquipment = createAsyncThunk(
  'schedule/createEquipment',
  async (data: CreateEquipmentDto) => {
    return await api.createEquipment(data);
  }
);

export const updateEquipment = createAsyncThunk(
  'schedule/updateEquipment',
  async ({ id, data }: { id: string; data: UpdateEquipmentDto }) => {
    return await api.updateEquipment(id, data);
  }
);

export const deleteEquipment = createAsyncThunk(
  'schedule/deleteEquipment',
  async (id: string) => {
    await api.deleteEquipment(id);
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

export const addTaskToJob = createAsyncThunk(
  'schedule/addTaskToJob',
  async ({ jobId, task }: { jobId: string; task: CreateTaskDto }) => {
    return await api.addTaskToJob(jobId, task);
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
      // Operator CRUD
      .addCase(createOperator.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.operators.push(action.payload);
          state.snapshot.snapshotVersion++;
        }
      })
      .addCase(updateOperator.fulfilled, (state, action) => {
        if (state.snapshot) {
          const index = state.snapshot.operators.findIndex(
            (o) => o.id === action.payload.id
          );
          if (index !== -1) {
            state.snapshot.operators[index] = action.payload;
            state.snapshot.snapshotVersion++;
          }
        }
      })
      .addCase(deleteOperator.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.operators = state.snapshot.operators.filter(
            (o) => o.id !== action.payload
          );
          state.snapshot.snapshotVersion++;
        }
      })
      // Equipment CRUD
      .addCase(createEquipment.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.equipment.push(action.payload);
          state.snapshot.snapshotVersion++;
        }
      })
      .addCase(updateEquipment.fulfilled, (state, action) => {
        if (state.snapshot) {
          const index = state.snapshot.equipment.findIndex(
            (e) => e.id === action.payload.id
          );
          if (index !== -1) {
            state.snapshot.equipment[index] = action.payload;
            state.snapshot.snapshotVersion++;
          }
        }
      })
      .addCase(deleteEquipment.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.equipment = state.snapshot.equipment.filter(
            (e) => e.id !== action.payload
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
      })
      // Add task
      .addCase(addTaskToJob.fulfilled, (state, action) => {
        if (state.snapshot) {
          state.snapshot.tasks.push(action.payload);
          state.snapshot.snapshotVersion++;
        }
      });
  },
});

export const { setValidationResult, clearError } = scheduleSlice.actions;
export const scheduleReducer = scheduleSlice.reducer;

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SelectedTask } from '../types';

// Grid can show stations or providers as columns
export type GridViewType = 'stations' | 'providers';

interface UiState {
  gridView: GridViewType;
  selectedTask: SelectedTask | null;
  activePanel: 'stations' | 'providers' | 'jobs' | null;
  isDragging: boolean;
  draggedTaskId: string | null;
  timeRange: {
    start: string;
    end: string;
  };
  // Panel collapse state
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  // Selected job for left panel context
  selectedJobId: string | null;
  // Job filter text
  jobFilter: string;
  // Task scroll target (taskId to scroll to in grid)
  scrollToTaskId: string | null;
  // Task pending recall (taskId to unassign)
  pendingRecallTaskId: string | null;
  // Local task order overrides (jobId -> taskId[])
  taskOrderOverrides: Record<string, string[]>;
}

const initialState: UiState = {
  gridView: 'stations',
  selectedTask: null,
  activePanel: 'jobs',
  isDragging: false,
  draggedTaskId: null,
  timeRange: {
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  selectedJobId: null,
  jobFilter: '',
  scrollToTaskId: null,
  pendingRecallTaskId: null,
  taskOrderOverrides: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setGridView: (state, action: PayloadAction<GridViewType>) => {
      state.gridView = action.payload;
    },
    setSelectedTask: (state, action: PayloadAction<SelectedTask | null>) => {
      state.selectedTask = action.payload;
    },
    setActivePanel: (state, action: PayloadAction<'stations' | 'providers' | 'jobs' | null>) => {
      state.activePanel = action.payload;
    },
    setIsDragging: (state, action: PayloadAction<boolean>) => {
      state.isDragging = action.payload;
    },
    setDraggedTaskId: (state, action: PayloadAction<string | null>) => {
      state.draggedTaskId = action.payload;
    },
    setTimeRange: (state, action: PayloadAction<{ start: string; end: string }>) => {
      state.timeRange = action.payload;
    },
    toggleLeftPanel: (state) => {
      state.leftPanelCollapsed = !state.leftPanelCollapsed;
    },
    toggleRightPanel: (state) => {
      state.rightPanelCollapsed = !state.rightPanelCollapsed;
    },
    setLeftPanelCollapsed: (state, action: PayloadAction<boolean>) => {
      state.leftPanelCollapsed = action.payload;
    },
    setRightPanelCollapsed: (state, action: PayloadAction<boolean>) => {
      state.rightPanelCollapsed = action.payload;
    },
    setSelectedJobId: (state, action: PayloadAction<string | null>) => {
      state.selectedJobId = action.payload;
    },
    setJobFilter: (state, action: PayloadAction<string>) => {
      state.jobFilter = action.payload;
    },
    // Task list actions
    scrollToTask: (state, action: PayloadAction<string>) => {
      state.scrollToTaskId = action.payload;
    },
    clearScrollToTask: (state) => {
      state.scrollToTaskId = null;
    },
    recallTask: (state, action: PayloadAction<string>) => {
      state.pendingRecallTaskId = action.payload;
    },
    clearPendingRecall: (state) => {
      state.pendingRecallTaskId = null;
    },
    reorderTasks: (
      state,
      action: PayloadAction<{ jobId: string; taskIds: string[] }>
    ) => {
      state.taskOrderOverrides[action.payload.jobId] = action.payload.taskIds;
    },
    clearTaskOrderOverride: (state, action: PayloadAction<string>) => {
      delete state.taskOrderOverrides[action.payload];
    },
  },
});

export const {
  setGridView,
  setSelectedTask,
  setActivePanel,
  setIsDragging,
  setDraggedTaskId,
  setTimeRange,
  toggleLeftPanel,
  toggleRightPanel,
  setLeftPanelCollapsed,
  setRightPanelCollapsed,
  setSelectedJobId,
  setJobFilter,
  scrollToTask,
  clearScrollToTask,
  recallTask,
  clearPendingRecall,
  reorderTasks,
  clearTaskOrderOverride,
} = uiSlice.actions;
export const uiReducer = uiSlice.reducer;

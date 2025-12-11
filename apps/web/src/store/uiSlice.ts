import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { GridViewType, SelectedTask } from '../types';

interface UiState {
  gridView: GridViewType;
  selectedTask: SelectedTask | null;
  activePanel: 'operators' | 'equipment' | 'jobs' | null;
  isDragging: boolean;
  draggedTaskId: string | null;
  timeRange: {
    start: string;
    end: string;
  };
  sidebarCollapsed: boolean;
}

const initialState: UiState = {
  gridView: 'equipment',
  selectedTask: null,
  activePanel: 'jobs',
  isDragging: false,
  draggedTaskId: null,
  timeRange: {
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  sidebarCollapsed: false,
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
    setActivePanel: (state, action: PayloadAction<'operators' | 'equipment' | 'jobs' | null>) => {
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
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
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
  toggleSidebar,
} = uiSlice.actions;
export const uiReducer = uiSlice.reducer;

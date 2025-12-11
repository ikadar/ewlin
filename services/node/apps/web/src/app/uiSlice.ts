import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  /** Currently selected job ID in the left panel */
  selectedJobId: string | null;
  /** Panel visibility state */
  panels: {
    left: boolean;
    right: boolean;
  };
  /** Current view mode */
  viewMode: 'day' | 'week';
}

const initialState: UiState = {
  selectedJobId: null,
  panels: {
    left: true,
    right: true,
  },
  viewMode: 'day',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    selectJob(state, action: PayloadAction<string | null>) {
      state.selectedJobId = action.payload;
    },
    toggleLeftPanel(state) {
      state.panels.left = !state.panels.left;
    },
    toggleRightPanel(state) {
      state.panels.right = !state.panels.right;
    },
    setViewMode(state, action: PayloadAction<'day' | 'week'>) {
      state.viewMode = action.payload;
    },
  },
});

export const { selectJob, toggleLeftPanel, toggleRightPanel, setViewMode } = uiSlice.actions;

export const uiReducer = uiSlice.reducer;

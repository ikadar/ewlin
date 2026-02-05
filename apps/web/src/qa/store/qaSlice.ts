/**
 * QA Tracker UI State Slice
 *
 * Manages UI state for the QA tracker:
 * - Selected folder, file, test
 * - Panel visibility
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface QAState {
  selectedFolder: string | null;
  selectedFile: string | null;
  selectedTestId: string | null;
}

const initialState: QAState = {
  selectedFolder: null,
  selectedFile: null,
  selectedTestId: null,
};

const qaSlice = createSlice({
  name: 'qa',
  initialState,
  reducers: {
    setSelectedFolder: (state, action: PayloadAction<string | null>) => {
      state.selectedFolder = action.payload;
      // Reset file and test when folder changes
      state.selectedFile = null;
      state.selectedTestId = null;
    },
    setSelectedFile: (state, action: PayloadAction<string | null>) => {
      state.selectedFile = action.payload;
      // Reset test when file changes
      state.selectedTestId = null;
    },
    setSelectedTestId: (state, action: PayloadAction<string | null>) => {
      state.selectedTestId = action.payload;
    },
    resetQAState: () => initialState,
  },
});

export const {
  setSelectedFolder,
  setSelectedFile,
  setSelectedTestId,
  resetQAState,
} = qaSlice.actions;

export const qaReducer = qaSlice.reducer;

// Selectors
export const selectSelectedFolder = (state: { qa: QAState }) =>
  state.qa.selectedFolder;
export const selectSelectedFile = (state: { qa: QAState }) =>
  state.qa.selectedFile;
export const selectSelectedTestId = (state: { qa: QAState }) =>
  state.qa.selectedTestId;

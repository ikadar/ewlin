/**
 * QA Tracker UI State Slice
 *
 * Manages UI state for the QA tracker:
 * - Selected folder, file, test
 * - Panel visibility
 * - Persists selection to localStorage
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface QAState {
  selectedFolder: string | null;
  selectedFile: string | null;
  selectedTestId: string | null;
}

const STORAGE_KEY = 'qa-tracker-selection';

function loadPersistedState(): Partial<QAState> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // Ignore localStorage errors (SSR, private browsing, etc.)
  }
  return {};
}

function persistState(state: QAState): void {
  const selection = {
    selectedFolder: state.selectedFolder,
    selectedFile: state.selectedFile,
    selectedTestId: state.selectedTestId,
  };

  // localStorage for immediate UI state
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Ignore localStorage errors
  }

  // Fire-and-forget sync to file for skills
  fetch('/qa-api/selection', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(selection),
  }).catch(() => {
    // Ignore sync errors - localStorage is primary
  });
}

const persisted = loadPersistedState();

const initialState: QAState = {
  selectedFolder: persisted.selectedFolder ?? null,
  selectedFile: persisted.selectedFile ?? null,
  selectedTestId: persisted.selectedTestId ?? null,
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
      persistState(state);
    },
    setSelectedFile: (state, action: PayloadAction<string | null>) => {
      state.selectedFile = action.payload;
      // Reset test when file changes
      state.selectedTestId = null;
      persistState(state);
    },
    setSelectedTestId: (state, action: PayloadAction<string | null>) => {
      state.selectedTestId = action.payload;
      persistState(state);
    },
    resetQAState: (state) => {
      state.selectedFolder = null;
      state.selectedFile = null;
      state.selectedTestId = null;
      persistState(state);
    },
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

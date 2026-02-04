/**
 * Error Slice
 *
 * Redux slice for global error state management.
 * Used to display toast notifications for API errors.
 *
 * @see docs/releases/v0.5.7-global-error-handling.md
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { NormalizedError } from '../api/errorNormalization';

// ============================================================================
// Types
// ============================================================================

export interface GlobalError extends NormalizedError {
  /** Unique identifier for the error */
  id: string;
  /** Timestamp when error occurred */
  timestamp: number;
}

interface ErrorState {
  /** Current error to display (if any) */
  currentError: GlobalError | null;
  /** Whether service is unavailable (503) */
  isServiceUnavailable: boolean;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ErrorState = {
  currentError: null,
  isServiceUnavailable: false,
};

// ============================================================================
// Slice
// ============================================================================

export const errorSlice = createSlice({
  name: 'error',
  initialState,
  reducers: {
    /**
     * Set the current error to display
     */
    setError: (state, action: PayloadAction<NormalizedError>) => {
      state.currentError = {
        ...action.payload,
        id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
      };

      // Check for 503 Service Unavailable
      if (action.payload.status === 503) {
        state.isServiceUnavailable = true;
      }
    },

    /**
     * Clear the current error
     */
    clearError: (state) => {
      state.currentError = null;
    },

    /**
     * Set service unavailable state
     */
    setServiceUnavailable: (state, action: PayloadAction<boolean>) => {
      state.isServiceUnavailable = action.payload;
    },

    /**
     * Reset all error state
     */
    resetErrorState: (state) => {
      state.currentError = null;
      state.isServiceUnavailable = false;
    },
  },
});

// ============================================================================
// Actions
// ============================================================================

export const { setError, clearError, setServiceUnavailable, resetErrorState } = errorSlice.actions;

// ============================================================================
// Reducer
// ============================================================================

export const errorReducer = errorSlice.reducer;

// ============================================================================
// Selectors
// ============================================================================

export const selectCurrentError = (state: { error: ErrorState }) => state.error.currentError;
export const selectIsServiceUnavailable = (state: { error: ErrorState }) =>
  state.error.isServiceUnavailable;

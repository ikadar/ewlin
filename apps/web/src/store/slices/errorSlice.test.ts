/**
 * Tests for errorSlice
 *
 * @see docs/releases/v0.5.7-global-error-handling.md
 */

import { describe, it, expect } from 'vitest';
import {
  errorReducer,
  setError,
  clearError,
  setServiceUnavailable,
  resetErrorState,
  selectCurrentError,
  selectIsServiceUnavailable,
} from './errorSlice';

describe('errorSlice', () => {
  const initialState = {
    currentError: null,
    isServiceUnavailable: false,
  };

  describe('reducers', () => {
    describe('setError', () => {
      it('sets the current error', () => {
        const error = {
          status: 500,
          message: 'Internal server error',
          isNetworkError: false,
          isValidationError: false,
        };

        const state = errorReducer(initialState, setError(error));

        expect(state.currentError).not.toBeNull();
        expect(state.currentError?.status).toBe(500);
        expect(state.currentError?.message).toBe('Internal server error');
        expect(state.currentError?.id).toMatch(/^error-/);
        expect(state.currentError?.timestamp).toBeGreaterThan(0);
      });

      it('sets isServiceUnavailable when status is 503', () => {
        const error = {
          status: 503,
          message: 'Service unavailable',
          isNetworkError: false,
          isValidationError: false,
        };

        const state = errorReducer(initialState, setError(error));

        expect(state.isServiceUnavailable).toBe(true);
      });

      it('does not set isServiceUnavailable for other errors', () => {
        const error = {
          status: 500,
          message: 'Server error',
          isNetworkError: false,
          isValidationError: false,
        };

        const state = errorReducer(initialState, setError(error));

        expect(state.isServiceUnavailable).toBe(false);
      });
    });

    describe('clearError', () => {
      it('clears the current error', () => {
        const stateWithError = {
          currentError: {
            id: 'error-123',
            timestamp: Date.now(),
            status: 500,
            message: 'Error',
            isNetworkError: false,
            isValidationError: false,
          },
          isServiceUnavailable: false,
        };

        const state = errorReducer(stateWithError, clearError());

        expect(state.currentError).toBeNull();
      });

      it('does not affect isServiceUnavailable', () => {
        const stateWithServiceUnavailable = {
          currentError: {
            id: 'error-123',
            timestamp: Date.now(),
            status: 503,
            message: 'Service unavailable',
            isNetworkError: false,
            isValidationError: false,
          },
          isServiceUnavailable: true,
        };

        const state = errorReducer(stateWithServiceUnavailable, clearError());

        expect(state.currentError).toBeNull();
        expect(state.isServiceUnavailable).toBe(true);
      });
    });

    describe('setServiceUnavailable', () => {
      it('sets isServiceUnavailable to true', () => {
        const state = errorReducer(initialState, setServiceUnavailable(true));

        expect(state.isServiceUnavailable).toBe(true);
      });

      it('sets isServiceUnavailable to false', () => {
        const stateWithUnavailable = {
          ...initialState,
          isServiceUnavailable: true,
        };

        const state = errorReducer(stateWithUnavailable, setServiceUnavailable(false));

        expect(state.isServiceUnavailable).toBe(false);
      });
    });

    describe('resetErrorState', () => {
      it('resets all error state', () => {
        const stateWithErrors = {
          currentError: {
            id: 'error-123',
            timestamp: Date.now(),
            status: 503,
            message: 'Service unavailable',
            isNetworkError: false,
            isValidationError: false,
          },
          isServiceUnavailable: true,
        };

        const state = errorReducer(stateWithErrors, resetErrorState());

        expect(state.currentError).toBeNull();
        expect(state.isServiceUnavailable).toBe(false);
      });
    });
  });

  describe('selectors', () => {
    describe('selectCurrentError', () => {
      it('returns the current error', () => {
        const error = {
          id: 'error-123',
          timestamp: Date.now(),
          status: 500,
          message: 'Error',
          isNetworkError: false,
          isValidationError: false,
        };
        const state = { error: { currentError: error, isServiceUnavailable: false } };

        expect(selectCurrentError(state)).toBe(error);
      });

      it('returns null when no error', () => {
        const state = { error: { currentError: null, isServiceUnavailable: false } };

        expect(selectCurrentError(state)).toBeNull();
      });
    });

    describe('selectIsServiceUnavailable', () => {
      it('returns true when service is unavailable', () => {
        const state = { error: { currentError: null, isServiceUnavailable: true } };

        expect(selectIsServiceUnavailable(state)).toBe(true);
      });

      it('returns false when service is available', () => {
        const state = { error: { currentError: null, isServiceUnavailable: false } };

        expect(selectIsServiceUnavailable(state)).toBe(false);
      });
    });
  });
});

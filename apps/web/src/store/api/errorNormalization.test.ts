/**
 * Tests for errorNormalization.ts - Error handling utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isNetworkError,
  isValidationError,
  isNotFoundError,
  isServerError,
  normalizeError,
  getErrorMessage,
  normalizeErrorForUI,
  createNotFoundError,
  createValidationError,
  createServerError,
  createSuccessResponse,
} from './errorNormalization';

/** Type for error data structure in our API errors */
interface ErrorData {
  error: string;
  message?: string;
  conflicts?: unknown[];
  suggestedStart?: string;
}

describe('errorNormalization', () => {
  describe('error detection', () => {
    describe('isNetworkError', () => {
      it('returns true for FETCH_ERROR status', () => {
        expect(isNetworkError({ status: 'FETCH_ERROR' })).toBe(true);
      });

      it('returns false for HTTP status codes', () => {
        expect(isNetworkError({ status: 404 })).toBe(false);
        expect(isNetworkError({ status: 500 })).toBe(false);
      });

      it('returns false for null/undefined', () => {
        expect(isNetworkError(null)).toBe(false);
        expect(isNetworkError(undefined)).toBe(false);
      });
    });

    describe('isValidationError', () => {
      it('returns true for 409 status', () => {
        expect(isValidationError({ status: 409 })).toBe(true);
      });

      it('returns false for other status codes', () => {
        expect(isValidationError({ status: 400 })).toBe(false);
        expect(isValidationError({ status: 500 })).toBe(false);
      });
    });

    describe('isNotFoundError', () => {
      it('returns true for 404 status', () => {
        expect(isNotFoundError({ status: 404 })).toBe(true);
      });

      it('returns false for other status codes', () => {
        expect(isNotFoundError({ status: 400 })).toBe(false);
        expect(isNotFoundError({ status: 500 })).toBe(false);
      });
    });

    describe('isServerError', () => {
      it('returns true for 5xx status codes', () => {
        expect(isServerError({ status: 500 })).toBe(true);
        expect(isServerError({ status: 502 })).toBe(true);
        expect(isServerError({ status: 503 })).toBe(true);
      });

      it('returns false for 4xx status codes', () => {
        expect(isServerError({ status: 400 })).toBe(false);
        expect(isServerError({ status: 404 })).toBe(false);
      });
    });
  });

  describe('normalizeError', () => {
    it('returns error as-is if already in correct format', () => {
      const error = { status: 404, data: { message: 'Not found' } };
      const result = normalizeError(error);
      expect(result).toEqual(error);
    });

    it('converts Error to CUSTOM_ERROR format', () => {
      const error = new Error('Something went wrong');
      const result = normalizeError(error);
      expect(result).toEqual({
        status: 'CUSTOM_ERROR',
        error: 'Something went wrong',
      });
    });

    it('converts string to CUSTOM_ERROR format', () => {
      const result = normalizeError('An error occurred');
      expect(result).toEqual({
        status: 'CUSTOM_ERROR',
        error: 'An error occurred',
      });
    });

    it('handles unknown error types', () => {
      const result = normalizeError({ unexpected: 'format' });
      expect(result.status).toBe('CUSTOM_ERROR');
    });
  });

  describe('getErrorMessage', () => {
    it('extracts message from RTK Query error format', () => {
      const error = { data: { message: 'Task not found' } };
      expect(getErrorMessage(error)).toBe('Task not found');
    });

    it('extracts error from RTK Query custom error', () => {
      const error = { error: 'Connection failed' };
      expect(getErrorMessage(error)).toBe('Connection failed');
    });

    it('extracts message from Error object', () => {
      const error = new Error('Something broke');
      expect(getErrorMessage(error)).toBe('Something broke');
    });

    it('returns string error directly', () => {
      expect(getErrorMessage('Direct error message')).toBe('Direct error message');
    });

    it('returns default message for unknown types', () => {
      expect(getErrorMessage(null)).toBe('An unknown error occurred');
      expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
    });
  });

  describe('normalizeErrorForUI', () => {
    it('creates normalized error with all fields', () => {
      const error = {
        status: 409,
        data: {
          error: 'ValidationFailed',
          message: 'Scheduling conflict',
          conflicts: [{ type: 'StationConflict', message: 'Station occupied' }],
          suggestedStart: '2026-02-03T11:00:00Z',
        },
      };

      const result = normalizeErrorForUI(error);

      expect(result.status).toBe(409);
      expect(result.message).toBe('Scheduling conflict');
      expect(result.code).toBe('ValidationFailed');
      expect(result.isValidationError).toBe(true);
      expect(result.isNetworkError).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.suggestedStart).toBe('2026-02-03T11:00:00Z');
    });

    it('identifies network errors', () => {
      const error = { status: 'FETCH_ERROR' };
      const result = normalizeErrorForUI(error);
      expect(result.isNetworkError).toBe(true);
    });
  });

  describe('error creators', () => {
    describe('createNotFoundError', () => {
      it('creates 404 error with message', () => {
        const error = createNotFoundError('Resource not found');
        expect(error.status).toBe(404);
        expect((error.data as ErrorData).error).toBe('NotFound');
        expect((error.data as ErrorData).message).toBe('Resource not found');
      });
    });

    describe('createValidationError', () => {
      it('creates 409 error with conflicts', () => {
        const conflicts = [
          { type: 'StationConflict', message: 'Occupied' },
        ];
        const error = createValidationError('Validation failed', conflicts, '2026-02-03T10:00:00Z');

        expect(error.status).toBe(409);
        expect((error.data as ErrorData).error).toBe('ValidationFailed');
        expect((error.data as ErrorData).conflicts).toEqual(conflicts);
        expect((error.data as ErrorData).suggestedStart).toBe('2026-02-03T10:00:00Z');
      });
    });

    describe('createServerError', () => {
      it('creates 500 error', () => {
        const error = createServerError('Internal server error');
        expect(error.status).toBe(500);
        expect((error.data as ErrorData).error).toBe('ServerError');
      });
    });

    describe('createSuccessResponse', () => {
      it('wraps data in response object', () => {
        const result = createSuccessResponse({ id: '123', name: 'Test' });
        expect(result).toEqual({ data: { id: '123', name: 'Test' } });
      });
    });
  });
});

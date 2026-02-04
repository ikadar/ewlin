/**
 * Error Normalization Utilities
 *
 * Transforms various error formats (network, API, mock) to a consistent
 * structure for UI consumption.
 *
 * @see docs/releases/v0.5.0-api-client-configuration.md
 */

import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

// ============================================================================
// Types
// ============================================================================

/**
 * Standard API error response format from backend
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  conflicts?: Array<{
    type: string;
    message: string;
    taskId?: string;
    relatedTaskId?: string;
    targetId?: string;
  }>;
  suggestedStart?: string;
}

/**
 * Normalized error format for UI consumption
 */
export interface NormalizedError {
  status: number | string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  isNetworkError: boolean;
  isValidationError: boolean;
  conflicts?: ApiErrorResponse['conflicts'];
  suggestedStart?: string;
}

// ============================================================================
// Error Detection
// ============================================================================

/**
 * Check if an error is a network error (no response from server)
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // RTK Query network error format
  if ('status' in error && error.status === 'FETCH_ERROR') {
    return true;
  }

  // Native fetch error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * Check if an error is a validation error (409 Conflict)
 */
export function isValidationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  if ('status' in error && error.status === 409) {
    return true;
  }

  return false;
}

/**
 * Check if an error is a not found error (404)
 */
export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  if ('status' in error && error.status === 404) {
    return true;
  }

  return false;
}

/**
 * Check if an error is a server error (5xx)
 */
export function isServerError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  if ('status' in error && typeof error.status === 'number') {
    return error.status >= 500 && error.status < 600;
  }

  return false;
}

/**
 * Check if an error is a service unavailable error (503)
 */
export function isServiceUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  if ('status' in error && error.status === 503) {
    return true;
  }

  return false;
}

// ============================================================================
// Error Normalization
// ============================================================================

/**
 * Normalize any error to FetchBaseQueryError format
 */
export function normalizeError(error: unknown): FetchBaseQueryError {
  // Already in correct format
  if (error && typeof error === 'object' && 'status' in error) {
    return error as FetchBaseQueryError;
  }

  // Native Error
  if (error instanceof Error) {
    return {
      status: 'CUSTOM_ERROR',
      error: error.message,
    };
  }

  // String error
  if (typeof error === 'string') {
    return {
      status: 'CUSTOM_ERROR',
      error,
    };
  }

  // Unknown error
  return {
    status: 'CUSTOM_ERROR',
    error: 'An unknown error occurred',
  };
}

/**
 * Extract a user-friendly error message from any error format
 */
export function getErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unknown error occurred';
  }

  // RTK Query error format
  if (typeof error === 'object' && 'data' in error) {
    const data = (error as { data: unknown }).data;
    if (data && typeof data === 'object' && 'message' in data) {
      return String((data as { message: unknown }).message);
    }
  }

  // RTK Query custom error
  if (typeof error === 'object' && 'error' in error) {
    return String((error as { error: unknown }).error);
  }

  // Standard Error
  if (error instanceof Error) {
    return error.message;
  }

  // String
  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}

/**
 * Normalize any error to a consistent format for UI
 */
export function normalizeErrorForUI(error: unknown): NormalizedError {
  const isNetwork = isNetworkError(error);
  const isValidation = isValidationError(error);

  // Extract status
  let status: number | string = 'UNKNOWN';
  if (error && typeof error === 'object' && 'status' in error) {
    status = (error as { status: number | string }).status;
  }

  // Extract message
  const message = getErrorMessage(error);

  // Extract API error details
  let code: string | undefined;
  let details: Record<string, unknown> | undefined;
  let conflicts: ApiErrorResponse['conflicts'] | undefined;
  let suggestedStart: string | undefined;

  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data: unknown }).data as ApiErrorResponse | undefined;
    if (data && typeof data === 'object') {
      code = data.error;
      details = data.details;
      conflicts = data.conflicts;
      suggestedStart = data.suggestedStart;
    }
  }

  return {
    status,
    message,
    code,
    details,
    isNetworkError: isNetwork,
    isValidationError: isValidation,
    conflicts,
    suggestedStart,
  };
}

// ============================================================================
// Error Creators (for mock responses)
// ============================================================================

/**
 * Create a 404 Not Found error
 */
export function createNotFoundError(message: string): FetchBaseQueryError {
  return {
    status: 404,
    data: { error: 'NotFound', message },
  };
}

/**
 * Create a 409 Conflict error (validation failure)
 */
export function createValidationError(
  message: string,
  conflicts?: ApiErrorResponse['conflicts'],
  suggestedStart?: string
): FetchBaseQueryError {
  return {
    status: 409,
    data: {
      error: 'ValidationFailed',
      message,
      conflicts,
      suggestedStart,
    },
  };
}

/**
 * Create a 500 Server Error
 */
export function createServerError(message: string): FetchBaseQueryError {
  return {
    status: 500,
    data: { error: 'ServerError', message },
  };
}

/**
 * Create a success response wrapper (for consistency)
 */
export function createSuccessResponse<T>(data: T): { data: T } {
  return { data };
}

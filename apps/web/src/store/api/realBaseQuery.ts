/**
 * Real Base Query Configuration
 *
 * fetchBaseQuery configured with:
 * - Base URL from environment (VITE_API_URL)
 * - Standard headers (Content-Type, Accept)
 * - Error response normalization
 * - Request/response logging in development
 *
 * @see docs/releases/v0.5.0-api-client-configuration.md
 */

import { fetchBaseQuery } from '@reduxjs/toolkit/query';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { normalizeError } from './errorNormalization';
import type { AuthState } from '../slices/authSlice';
import { muteMercure } from '../../hooks/mercureMute';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get the API base URL from environment
 */
function getApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL;

  if (!url) {
    console.warn('[API] VITE_API_URL not configured, using relative path');
    return '/api/v1';
  }

  // Ensure URL doesn't have trailing slash
  return url.replace(/\/$/, '');
}

/**
 * Standard headers for API requests
 */
function prepareHeaders(headers: Headers, { getState }: { getState: () => unknown }): Headers {
  // Content type for JSON
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');

  // Attach JWT token if available
  const token = (getState() as { auth: AuthState }).auth?.token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

// ============================================================================
// Base Query
// ============================================================================

/**
 * Internal fetch base query with standard configuration.
 * Exported for use by baseQueryWithReauth (refresh call bypasses realBaseQuery wrapper).
 */
export const baseFetchQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  prepareHeaders,
  // Credentials for CORS (if needed)
  credentials: 'same-origin',
});

/**
 * Real base query with error handling and logging.
 *
 * Wraps fetchBaseQuery to add:
 * - Development logging
 * - Error normalization
 * - Response timing
 */
export const realBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const startTime = Date.now();
  const url = typeof args === 'string' ? args : args.url;
  const method = typeof args === 'string' ? 'GET' : (args.method ?? 'GET');

  // Mute Mercure for mutations — the mutating client already has latest data
  if (method !== 'GET') {
    muteMercure();
  }

  try {
    // Execute the request
    const result = await baseFetchQuery(args, api, extraOptions);
    const duration = Date.now() - startTime;

    // Log in development
    if (import.meta.env.DEV) {
      if (result.error) {
        console.error(`[API] ${method} ${url} - ${result.error.status} (${duration}ms)`, result.error);
      } else {
        console.log(`[API] ${method} ${url} - OK (${duration}ms)`);
      }
    }

    // 401 handling is done by baseQueryWithReauth wrapper (silent token refresh).
    // This base query only normalizes errors and logs.

    // Normalize errors
    if (result.error) {
      return { error: normalizeError(result.error) };
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log error in development
    if (import.meta.env.DEV) {
      console.error(`[API] ${method} ${url} - FAILED (${duration}ms)`, error);
    }

    // Return normalized error
    return { error: normalizeError(error) };
  }
};

// ============================================================================
// Exports for testing
// ============================================================================

export const __testing__ = {
  getApiBaseUrl,
  prepareHeaders,
};

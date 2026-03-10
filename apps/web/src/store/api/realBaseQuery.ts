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
import { logout } from '../slices/authSlice';

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
 * Internal fetch base query with standard configuration
 */
const baseFetchQuery = fetchBaseQuery({
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

    // On 401: dispatch logout → clears sessionStorage → RequireAuth redirects
    if (result.error && typeof result.error === 'object' && 'status' in result.error && result.error.status === 401) {
      api.dispatch(logout());
    }

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

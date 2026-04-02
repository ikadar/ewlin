/**
 * Base Query with Re-authentication
 *
 * Wraps realBaseQuery to intercept 401 responses and silently refresh
 * the JWT token using the refresh token. Uses a promise-based lock
 * to prevent concurrent refresh attempts (thundering herd).
 */

import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { realBaseQuery, baseFetchQuery } from './realBaseQuery';
import type { AuthState } from '../slices/authSlice';
import { setTokens, logout } from '../slices/authSlice';

// ============================================================================
// Types
// ============================================================================

interface RefreshResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    permissions: string[];
    groups: { id: string; name: string }[];
    isActive: boolean;
    lastLoginAt: string | null;
  };
}

// ============================================================================
// Refresh Lock
// ============================================================================

// Module-level promise lock: prevents multiple concurrent refresh calls.
// When a refresh is in progress, subsequent 401 handlers wait for it to resolve
// instead of firing their own refresh requests.
let refreshPromise: Promise<boolean> | null = null;

// ============================================================================
// Base Query with Reauth
// ============================================================================

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await realBaseQuery(args, api, extraOptions);

  if (result.error && typeof result.error === 'object' && 'status' in result.error && result.error.status === 401) {
    // If another request is already refreshing, wait for it
    if (refreshPromise) {
      const refreshed = await refreshPromise;
      if (refreshed) {
        // Retry with the new token
        result = await realBaseQuery(args, api, extraOptions);
      } else {
        api.dispatch(logout());
      }
      return result;
    }

    // Start the refresh
    refreshPromise = (async () => {
      const refreshToken = (api.getState() as { auth: AuthState }).auth.refreshToken;
      if (!refreshToken) {
        return false;
      }

      // Use baseFetchQuery directly to avoid recursion through realBaseQuery
      const refreshResult = await baseFetchQuery(
        { url: '/auth/refresh', method: 'POST', body: { refreshToken } },
        api,
        extraOptions,
      );

      if (refreshResult.data) {
        const data = refreshResult.data as RefreshResponse;
        api.dispatch(setTokens({ token: data.token, refreshToken: data.refreshToken }));
        return true;
      }

      return false;
    })();

    try {
      const refreshed = await refreshPromise;
      if (refreshed) {
        // Retry the original request with the new token
        result = await realBaseQuery(args, api, extraOptions);
      } else {
        api.dispatch(logout());
      }
    } finally {
      refreshPromise = null;
    }
  }

  return result;
};

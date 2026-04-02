/**
 * Base API Configuration with Fixture Support
 *
 * Implements the "base query with fixture support" pattern (NFR-1):
 * - Detects `?fixture=xxx` URL parameter or `VITE_USE_MOCK=true` env var
 * - Routes to mock adapter in fixture/mock mode
 * - Routes to real API in production mode
 *
 * @see docs/releases/v0.5.0-api-client-configuration.md
 * @see docs/roadmap/milestone-5-plan.md (NFR-1)
 */

import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { mockBaseQuery } from './mockBaseQuery';
import { realBaseQuery } from './realBaseQuery';
import { baseQueryWithReauth } from './baseQueryWithReauth';

// ============================================================================
// Fixture/Mock Detection
// ============================================================================

/**
 * Check if the app should use mock/fixture mode.
 *
 * Mock mode is enabled when:
 * 1. URL contains `?fixture=xxx` parameter, OR
 * 2. Environment variable `VITE_USE_MOCK` is 'true'
 *
 * @returns true if mock mode should be used
 */
const FIXTURE_SESSION_KEY = 'flux_fixture';

// Persist fixture name to sessionStorage so it survives React Router navigations
// that strip the ?fixture= query param.
// This module-level code runs only on actual page loads (not on SPA navigations),
// so clearing on non-fixture loads is safe.
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  const fixture = params.get('fixture');
  if (fixture) {
    sessionStorage.setItem(FIXTURE_SESSION_KEY, fixture);
  } else {
    sessionStorage.removeItem(FIXTURE_SESSION_KEY);
  }
}

export function shouldUseMockMode(): boolean {
  // Server-side rendering guard
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_USE_MOCK === 'true';
  }

  // Check URL for fixture parameter
  const params = new URLSearchParams(window.location.search);
  if (params.get('fixture')) return true;

  // Check sessionStorage (persists across React Router navigations)
  if (sessionStorage.getItem(FIXTURE_SESSION_KEY)) return true;

  // Check environment variable
  return import.meta.env.VITE_USE_MOCK === 'true';
}

/**
 * Get the current fixture name from URL or sessionStorage, if any.
 *
 * @returns Fixture name or null if not in fixture mode
 */
export function getFixtureName(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('fixture') ?? sessionStorage.getItem(FIXTURE_SESSION_KEY);
}

// ============================================================================
// Base Query with Fixture Support
// ============================================================================

/**
 * Hybrid base query that routes to mock or real API.
 *
 * This is the main base query used by RTK Query API slices.
 * It automatically detects whether to use mock data or real API
 * based on URL parameters and environment variables.
 *
 * @example
 * // In API slice definition:
 * export const myApi = createApi({
 *   baseQuery: baseQueryWithFixtureSupport,
 *   endpoints: (builder) => ({ ... })
 * });
 */
export const baseQueryWithFixtureSupport: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // Determine mode at request time (allows dynamic switching via URL)
  const useMock = shouldUseMockMode();

  if (useMock) {
    // Development/testing mode: use mock adapter
    if (import.meta.env.DEV) {
      const fixture = getFixtureName();
      console.log(
        `[API] Mock mode${fixture ? ` (fixture: ${fixture})` : ''}: ${typeof args === 'string' ? args : args.url}`
      );
    }
    return mockBaseQuery(args, api, extraOptions);
  }

  // Production mode: use real API with automatic token refresh
  if (import.meta.env.DEV) {
    console.log(`[API] Real API: ${typeof args === 'string' ? args : args.url}`);
  }
  return baseQueryWithReauth(args, api, extraOptions);
};

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { mockBaseQuery } from './mockBaseQuery';
export { realBaseQuery } from './realBaseQuery';

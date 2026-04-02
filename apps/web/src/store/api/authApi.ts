/**
 * RTK Query API Slice — Authentication
 *
 * Provides login and user info endpoints.
 * Always uses realBaseQuery (never mock) since auth requires a real backend.
 *
 * @see docs/architecture/authentication-plan.md
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';
import type { AuthUser } from '../slices/authSlice';

// ============================================================================
// Response Types (match backend DTOs)
// ============================================================================

interface LoginResponse {
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

interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  permissions: string[];
  groups: { id: string; name: string }[];
  isActive: boolean;
  lastLoginAt: string | null;
}

// ============================================================================
// API Slice
// ============================================================================

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    login: builder.mutation<{ token: string; refreshToken: string; user: AuthUser }, { email: string; password: string }>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      transformResponse: (response: LoginResponse) => ({
        token: response.token,
        refreshToken: response.refreshToken,
        user: response.user,
      }),
    }),

    getMe: builder.query<AuthUser, void>({
      query: () => '/auth/me',
      transformResponse: (response: UserResponse): AuthUser => response,
    }),
  }),
});

export const { useLoginMutation, useGetMeQuery } = authApi;

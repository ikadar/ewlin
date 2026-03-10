/**
 * RTK Query API Slice — Authentication
 *
 * Provides login and user info endpoints.
 * Always uses realBaseQuery (never mock) since auth requires a real backend.
 *
 * @see docs/architecture/authentication-plan.md
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { realBaseQuery } from './realBaseQuery';
import type { AuthUser } from '../slices/authSlice';

// ============================================================================
// Response Types (match backend DTOs)
// ============================================================================

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    permissions: string[];
    groups: string[];
  };
}

interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  permissions: string[];
  groups: string[];
}

// ============================================================================
// API Slice
// ============================================================================

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: realBaseQuery,
  endpoints: (builder) => ({
    login: builder.mutation<{ token: string; user: AuthUser }, { email: string; password: string }>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      transformResponse: (response: LoginResponse) => ({
        token: response.token,
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

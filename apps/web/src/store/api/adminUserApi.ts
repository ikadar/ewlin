/**
 * RTK Query API Slice — Admin User Management
 *
 * Provides admin user CRUD operations.
 * Uses realBaseQuery (never mock) since admin requires a real backend.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { realBaseQuery } from './realBaseQuery';

// ============================================================================
// Types
// ============================================================================

export interface AdminUserGroup {
  id: string;
  name: string;
}

export interface AdminUserResponse {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  permissions: string[];
  groups: AdminUserGroup[];
}

export interface AdminUserInput {
  email: string;
  displayName: string;
  password?: string;
  groupIds: string[];
  isActive: boolean;
}

// ============================================================================
// API Slice
// ============================================================================

export const adminUserApi = createApi({
  reducerPath: 'adminUserApi',
  baseQuery: realBaseQuery,
  tagTypes: ['AdminUsers'],
  endpoints: (builder) => ({
    getUsers: builder.query<AdminUserResponse[], void>({
      query: () => '/admin/users',
      transformResponse: (response: AdminUserResponse[] | { data: AdminUserResponse[] }) =>
        Array.isArray(response) ? response : (response.data ?? []),
      providesTags: ['AdminUsers'],
    }),
    createUser: builder.mutation<AdminUserResponse, { email: string; password: string; displayName: string; groupIds: string[] }>({
      query: (body) => ({
        url: '/admin/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminUsers'],
    }),
    updateUser: builder.mutation<AdminUserResponse, { id: string; body: AdminUserInput }>({
      query: ({ id, body }) => ({
        url: `/admin/users/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['AdminUsers'],
    }),
    deleteUser: builder.mutation<AdminUserResponse, string>({
      query: (id) => ({
        url: `/admin/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminUsers'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = adminUserApi;

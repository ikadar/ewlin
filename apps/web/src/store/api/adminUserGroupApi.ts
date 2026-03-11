/**
 * RTK Query API Slice — Admin User Group Management
 *
 * Provides admin user group CRUD operations.
 * Uses realBaseQuery (never mock) since admin requires a real backend.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { realBaseQuery } from './realBaseQuery';

// ============================================================================
// Types
// ============================================================================

export interface AdminUserGroupResponse {
  id: string;
  name: string;
  permissions: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserGroupInput {
  name: string;
  permissions: string[];
}

// ============================================================================
// API Slice
// ============================================================================

export const adminUserGroupApi = createApi({
  reducerPath: 'adminUserGroupApi',
  baseQuery: realBaseQuery,
  tagTypes: ['AdminUserGroups'],
  endpoints: (builder) => ({
    getUserGroups: builder.query<AdminUserGroupResponse[], void>({
      query: () => '/admin/user-groups',
      transformResponse: (response: AdminUserGroupResponse[] | { data: AdminUserGroupResponse[] }) =>
        Array.isArray(response) ? response : (response.data ?? []),
      providesTags: ['AdminUserGroups'],
    }),
    createUserGroup: builder.mutation<AdminUserGroupResponse, AdminUserGroupInput>({
      query: (body) => ({
        url: '/admin/user-groups',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminUserGroups'],
    }),
    updateUserGroup: builder.mutation<AdminUserGroupResponse, { id: string; body: AdminUserGroupInput }>({
      query: ({ id, body }) => ({
        url: `/admin/user-groups/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['AdminUserGroups'],
    }),
    deleteUserGroup: builder.mutation<void, string>({
      query: (id) => ({
        url: `/admin/user-groups/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminUserGroups'],
    }),
  }),
});

export const {
  useGetUserGroupsQuery,
  useCreateUserGroupMutation,
  useUpdateUserGroupMutation,
  useDeleteUserGroupMutation,
} = adminUserGroupApi;

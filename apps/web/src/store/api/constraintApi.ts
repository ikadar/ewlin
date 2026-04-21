/**
 * RTK Query API Slice — SchedulingConstraint.
 *
 * Wraps the existing /api/v1/scheduling-constraints REST endpoints
 * (ConstraintController.php). Mutations feed the auto-recompute
 * middleware so adding/removing a constraint triggers Phase 1 + 2
 * compute just like operator/station/category edits.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';
import type {
  SchedulingConstraint,
  CreateSchedulingConstraintRequest,
} from '@flux/types';

export const constraintApi = createApi({
  reducerPath: 'constraintApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['SchedulingConstraints'],
  endpoints: (builder) => ({
    getSchedulingConstraints: builder.query<SchedulingConstraint[], void>({
      query: () => '/scheduling-constraints',
      transformResponse: (
        response:
          | SchedulingConstraint[]
          | { items: SchedulingConstraint[] }
          | { data: SchedulingConstraint[] },
      ) =>
        Array.isArray(response)
          ? response
          : 'items' in response
            ? response.items ?? []
            : (response as { data: SchedulingConstraint[] }).data ?? [],
      providesTags: ['SchedulingConstraints'],
    }),
    createSchedulingConstraint: builder.mutation<
      SchedulingConstraint,
      CreateSchedulingConstraintRequest
    >({
      query: (body) => ({
        url: '/scheduling-constraints',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['SchedulingConstraints'],
    }),
    deleteSchedulingConstraint: builder.mutation<void, string>({
      query: (id) => ({
        url: `/scheduling-constraints/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['SchedulingConstraints'],
    }),
  }),
});

export const {
  useGetSchedulingConstraintsQuery,
  useCreateSchedulingConstraintMutation,
  useDeleteSchedulingConstraintMutation,
} = constraintApi;

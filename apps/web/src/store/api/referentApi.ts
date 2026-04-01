/**
 * RTK Query API Slice - Referent API
 *
 * Provides referent CRUD operations via RTK Query.
 * Referent suggestions for autocomplete remain in scheduleApi (same contract as clients).
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface ReferentResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const referentApi = createApi({
  reducerPath: 'referentApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Referents'],
  endpoints: (builder) => ({
    getReferents: builder.query<ReferentResponse[], void>({
      query: () => '/referents',
      transformResponse: (response: ReferentResponse[] | { data: ReferentResponse[] }) =>
        Array.isArray(response) ? response : (response.data ?? []),
      providesTags: ['Referents'],
    }),
    createReferent: builder.mutation<ReferentResponse, { name: string }>({
      query: (body) => ({
        url: '/referents',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Referents'],
    }),
    updateReferent: builder.mutation<ReferentResponse, { id: string; body: { name: string } }>({
      query: ({ id, body }) => ({
        url: `/referents/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Referents'],
    }),
    deleteReferent: builder.mutation<void, string>({
      query: (id) => ({
        url: `/referents/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Referents'],
    }),
  }),
});

export const {
  useGetReferentsQuery,
  useCreateReferentMutation,
  useUpdateReferentMutation,
  useDeleteReferentMutation,
} = referentApi;

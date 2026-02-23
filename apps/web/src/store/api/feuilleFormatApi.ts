/**
 * RTK Query API Slice - Feuille Format API
 *
 * Provides feuille format (imposition) CRUD operations via RTK Query.
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface FeuilleFormatResponse {
  id: string;
  format: string;    // e.g., "50x70"
  poses: number[];   // e.g., [1, 2, 4, 8, 16, 32, 64, 128]
  createdAt: string;
  updatedAt: string;
}

export interface FeuilleFormatInput {
  format: string;
  poses: number[];
}

export const feuilleFormatApi = createApi({
  reducerPath: 'feuilleFormatApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['FeuilleFormats'],
  endpoints: (builder) => ({
    getFeuilleFormats: builder.query<FeuilleFormatResponse[], void>({
      query: () => '/feuille-formats',
      transformResponse: (response: FeuilleFormatResponse[] | { data: FeuilleFormatResponse[] }) =>
        Array.isArray(response) ? response : (response.data ?? []),
      providesTags: ['FeuilleFormats'],
    }),
    createFeuilleFormat: builder.mutation<FeuilleFormatResponse, FeuilleFormatInput>({
      query: (body) => ({
        url: '/feuille-formats',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['FeuilleFormats'],
    }),
    updateFeuilleFormat: builder.mutation<FeuilleFormatResponse, { id: string; body: FeuilleFormatInput }>({
      query: ({ id, body }) => ({
        url: `/feuille-formats/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['FeuilleFormats'],
    }),
    deleteFeuilleFormat: builder.mutation<void, string>({
      query: (id) => ({
        url: `/feuille-formats/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['FeuilleFormats'],
    }),
  }),
});

export const {
  useGetFeuilleFormatsQuery,
  useCreateFeuilleFormatMutation,
  useUpdateFeuilleFormatMutation,
  useDeleteFeuilleFormatMutation,
} = feuilleFormatApi;

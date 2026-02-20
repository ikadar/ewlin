/**
 * RTK Query API Slice - Format API
 *
 * Provides format CRUD operations via RTK Query.
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface FormatResponse {
  id: string;
  name: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormatInput {
  name: string;
  width: number;
  height: number;
}

export const formatApi = createApi({
  reducerPath: 'formatApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Formats'],
  endpoints: (builder) => ({
    getFormats: builder.query<FormatResponse[], void>({
      query: () => '/formats',
      transformResponse: (response: FormatResponse[] | { data: FormatResponse[] }) =>
        Array.isArray(response) ? response : (response.data ?? []),
      providesTags: ['Formats'],
    }),
    createFormat: builder.mutation<FormatResponse, FormatInput>({
      query: (body) => ({
        url: '/formats',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Formats'],
    }),
    updateFormat: builder.mutation<FormatResponse, { id: string; body: FormatInput }>({
      query: ({ id, body }) => ({
        url: `/formats/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Formats'],
    }),
    deleteFormat: builder.mutation<void, string>({
      query: (id) => ({
        url: `/formats/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Formats'],
    }),
  }),
});

export const {
  useGetFormatsQuery,
  useCreateFormatMutation,
  useUpdateFormatMutation,
  useDeleteFormatMutation,
} = formatApi;

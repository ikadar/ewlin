/**
 * RTK Query API Slice - Impression Preset API
 *
 * Provides impression preset CRUD operations via RTK Query.
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface ImpressionPresetResponse {
  id: string;
  value: string;       // DSL: "Q/Q", "Q+V/"
  description: string; // "Quadri R/V"
  label: string;       // JCF non-focused display (e.g., "quadri recto/verso") — empty = use static fallback
  createdAt: string;
  updatedAt: string;
}

export interface ImpressionPresetInput {
  value: string;
  description: string;
  label: string;
}

export const impressionPresetApi = createApi({
  reducerPath: 'impressionPresetApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['ImpressionPresets'],
  endpoints: (builder) => ({
    getImpressionPresets: builder.query<ImpressionPresetResponse[], void>({
      query: () => '/impression-presets',
      transformResponse: (response: ImpressionPresetResponse[] | { data: ImpressionPresetResponse[] }) =>
        Array.isArray(response) ? response : (response.data ?? []),
      providesTags: ['ImpressionPresets'],
    }),
    createImpressionPreset: builder.mutation<ImpressionPresetResponse, ImpressionPresetInput>({
      query: (body) => ({
        url: '/impression-presets',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ImpressionPresets'],
    }),
    updateImpressionPreset: builder.mutation<ImpressionPresetResponse, { id: string; body: ImpressionPresetInput }>({
      query: ({ id, body }) => ({
        url: `/impression-presets/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['ImpressionPresets'],
    }),
    deleteImpressionPreset: builder.mutation<void, string>({
      query: (id) => ({
        url: `/impression-presets/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ImpressionPresets'],
    }),
  }),
});

export const {
  useGetImpressionPresetsQuery,
  useCreateImpressionPresetMutation,
  useUpdateImpressionPresetMutation,
  useDeleteImpressionPresetMutation,
} = impressionPresetApi;

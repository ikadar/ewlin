/**
 * RTK Query API Slice - Surfacage Preset API
 *
 * Provides surfacage preset CRUD operations via RTK Query.
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface SurfacagePresetResponse {
  id: string;
  value: string;       // DSL: "mat/mat", "UV/"
  description: string; // "Pelli mat R/V"
  label: string;       // JCF non-focused display (e.g., "pelli mat recto/verso") — empty = use static fallback
  createdAt: string;
  updatedAt: string;
}

export interface SurfacagePresetInput {
  value: string;
  description: string;
  label: string;
}

export const surfacagePresetApi = createApi({
  reducerPath: 'surfacagePresetApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['SurfacagePresets'],
  endpoints: (builder) => ({
    getSurfacagePresets: builder.query<SurfacagePresetResponse[], void>({
      query: () => '/surfacage-presets',
      transformResponse: (response: SurfacagePresetResponse[] | { data: SurfacagePresetResponse[] }) =>
        Array.isArray(response) ? response : (response.data ?? []),
      providesTags: ['SurfacagePresets'],
    }),
    createSurfacagePreset: builder.mutation<SurfacagePresetResponse, SurfacagePresetInput>({
      query: (body) => ({
        url: '/surfacage-presets',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['SurfacagePresets'],
    }),
    updateSurfacagePreset: builder.mutation<SurfacagePresetResponse, { id: string; body: SurfacagePresetInput }>({
      query: ({ id, body }) => ({
        url: `/surfacage-presets/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['SurfacagePresets'],
    }),
    deleteSurfacagePreset: builder.mutation<void, string>({
      query: (id) => ({
        url: `/surfacage-presets/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['SurfacagePresets'],
    }),
  }),
});

export const {
  useGetSurfacagePresetsQuery,
  useCreateSurfacagePresetMutation,
  useUpdateSurfacagePresetMutation,
  useDeleteSurfacagePresetMutation,
} = surfacagePresetApi;

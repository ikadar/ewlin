/**
 * RTK Query API Slice - Station Category API
 *
 * Provides station category CRUD operations via RTK Query.
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface SimilarityCriterionInput {
  name: string;
  fieldPath: string;
}

export interface StationCategoryResponse {
  id: string;
  name: string;
  description?: string;
  similarityCriteria: SimilarityCriterionInput[];
  createdAt: string;
  updatedAt: string;
}

export interface StationCategoryInput {
  name: string;
  description?: string;
  similarityCriteria: SimilarityCriterionInput[];
}

export const stationCategoryApi = createApi({
  reducerPath: 'stationCategoryApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['StationCategories'],
  endpoints: (builder) => ({
    getStationCategories: builder.query<StationCategoryResponse[], void>({
      query: () => '/station-categories',
      // Real API returns { data: [...], total: N }; mock returns the array directly
      transformResponse: (response: StationCategoryResponse[] | { data: StationCategoryResponse[] }) =>
        Array.isArray(response) ? response : (response.data ?? []),
      providesTags: ['StationCategories'],
    }),
    createStationCategory: builder.mutation<StationCategoryResponse, StationCategoryInput>({
      query: (body) => ({
        url: '/station-categories',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['StationCategories'],
    }),
    updateStationCategory: builder.mutation<StationCategoryResponse, { id: string; body: StationCategoryInput }>({
      query: ({ id, body }) => ({
        url: `/station-categories/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['StationCategories'],
    }),
    deleteStationCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/station-categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['StationCategories'],
    }),
  }),
});

export const {
  useGetStationCategoriesQuery,
  useCreateStationCategoryMutation,
  useUpdateStationCategoryMutation,
  useDeleteStationCategoryMutation,
} = stationCategoryApi;

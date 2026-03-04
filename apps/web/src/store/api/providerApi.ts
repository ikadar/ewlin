/**
 * RTK Query API Slice - Outsourced Provider API
 *
 * Provides outsourced provider CRUD operations via RTK Query.
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface ProviderResponse {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
  supportedActionTypes: string[];
  latestDepartureTime: string;
  receptionTime: string;
  transitDays: number;
  groupId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderInput {
  name: string;
  status: 'Active' | 'Inactive';
  supportedActionTypes: string[];
  latestDepartureTime: string;
  receptionTime: string;
  transitDays: number;
}

export const providerApi = createApi({
  reducerPath: 'providerApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Providers'],
  endpoints: (builder) => ({
    getProviders: builder.query<ProviderResponse[], void>({
      query: () => '/providers',
      transformResponse: (response: ProviderResponse[] | { items: ProviderResponse[] } | { data: ProviderResponse[] }) =>
        Array.isArray(response)
          ? response
          : 'items' in response
            ? (response.items ?? [])
            : (response as { data: ProviderResponse[] }).data ?? [],
      providesTags: ['Providers'],
    }),
    createProvider: builder.mutation<ProviderResponse, ProviderInput>({
      query: (body) => ({
        url: '/providers',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Providers'],
    }),
    updateProvider: builder.mutation<ProviderResponse, { id: string; body: ProviderInput }>({
      query: ({ id, body }) => ({
        url: `/providers/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Providers'],
    }),
    deleteProvider: builder.mutation<void, string>({
      query: (id) => ({
        url: `/providers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Providers'],
    }),
  }),
});

export const {
  useGetProvidersQuery,
  useCreateProviderMutation,
  useUpdateProviderMutation,
  useDeleteProviderMutation,
} = providerApi;

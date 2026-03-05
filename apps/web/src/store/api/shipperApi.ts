/**
 * RTK Query API Slice - Shipper (Transporteur) API
 *
 * Provides shipper CRUD operations via RTK Query.
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface ShipperResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShipperInput {
  name: string;
}

export const shipperApi = createApi({
  reducerPath: 'shipperApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Shippers'],
  endpoints: (builder) => ({
    getShippers: builder.query<ShipperResponse[], void>({
      query: () => '/shippers',
      transformResponse: (response: ShipperResponse[] | { items: ShipperResponse[] } | { data: ShipperResponse[] }) =>
        Array.isArray(response)
          ? response
          : 'items' in response
            ? (response.items ?? [])
            : (response as { data: ShipperResponse[] }).data ?? [],
      providesTags: ['Shippers'],
    }),
    createShipper: builder.mutation<ShipperResponse, ShipperInput>({
      query: (body) => ({
        url: '/shippers',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Shippers'],
    }),
    updateShipper: builder.mutation<ShipperResponse, { id: string; body: ShipperInput }>({
      query: ({ id, body }) => ({
        url: `/shippers/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Shippers'],
    }),
    deleteShipper: builder.mutation<void, string>({
      query: (id) => ({
        url: `/shippers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Shippers'],
    }),
  }),
});

export const {
  useGetShippersQuery,
  useCreateShipperMutation,
  useUpdateShipperMutation,
  useDeleteShipperMutation,
} = shipperApi;

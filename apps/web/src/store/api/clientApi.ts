/**
 * RTK Query API Slice - Client API
 *
 * Provides client CRUD operations via RTK Query.
 * Client suggestions for autocomplete remain in scheduleApi (same contract).
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface ClientResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const clientApi = createApi({
  reducerPath: 'clientApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Clients'],
  endpoints: (builder) => ({
    getClients: builder.query<ClientResponse[], void>({
      query: () => '/clients',
      providesTags: ['Clients'],
    }),
    createClient: builder.mutation<ClientResponse, { name: string }>({
      query: (body) => ({
        url: '/clients',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Clients'],
    }),
    updateClient: builder.mutation<ClientResponse, { id: string; body: { name: string } }>({
      query: ({ id, body }) => ({
        url: `/clients/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Clients'],
    }),
    deleteClient: builder.mutation<void, string>({
      query: (id) => ({
        url: `/clients/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Clients'],
    }),
  }),
});

export const {
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
} = clientApi;

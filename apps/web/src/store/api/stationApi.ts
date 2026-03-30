/**
 * RTK Query API Slice - Station API
 *
 * Provides station CRUD operations via RTK Query.
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';
import { scheduleApi } from './scheduleApi';

export interface StationResponse {
  id: string;
  name: string;
  status: 'Available' | 'InUse' | 'Maintenance' | 'OutOfService';
  categoryId: string;
  groupId: string;
  capacity: number;
  displayOrder: number;
  operatingSchedule: Record<string, { isOperating: boolean; slots: { start: string; end: string }[] }> | null;
  scheduleExceptions: Array<{ date: string; type: string; schedule: unknown; reason: string | null }> | null;
  createdAt: string;
  updatedAt: string;
}

export interface StationInput {
  name: string;
  status: string;
  categoryId: string;
  groupId: string;
  capacity: number;
  displayOrder: number;
  operatingSchedule: Record<string, unknown> | null;
  scheduleExceptions: unknown[] | null;
}

export const stationApi = createApi({
  reducerPath: 'stationApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Stations'],
  endpoints: (builder) => ({
    getStations: builder.query<StationResponse[], void>({
      query: () => '/stations',
      // Real PHP API returns { items: [...], total, page, limit, pages }
      // Mock returns the array directly via { data: [...] } unwrapped by RTK Query
      transformResponse: (response: StationResponse[] | { items: StationResponse[] } | { data: StationResponse[] }) =>
        Array.isArray(response)
          ? response
          : 'items' in response
            ? (response.items ?? [])
            : (response as { data: StationResponse[] }).data ?? [],
      providesTags: ['Stations'],
    }),
    createStation: builder.mutation<StationResponse, StationInput>({
      query: (body) => ({
        url: '/stations',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Stations'],
    }),
    updateStation: builder.mutation<StationResponse, { id: string; body: StationInput }>({
      query: ({ id, body }) => ({
        url: `/stations/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Stations'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        } catch {
          // mutation failed — no invalidation needed
        }
      },
    }),
    deleteStation: builder.mutation<void, string>({
      query: (id) => ({
        url: `/stations/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Stations'],
    }),
  }),
});

export const {
  useGetStationsQuery,
  useCreateStationMutation,
  useUpdateStationMutation,
  useDeleteStationMutation,
} = stationApi;

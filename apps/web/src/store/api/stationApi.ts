/**
 * RTK Query API Slice - Station API
 *
 * Provides station CRUD operations via RTK Query.
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface StationResponse {
  id: string;
  name: string;
  code: string | null;
  status: 'Available' | 'InUse' | 'Maintenance' | 'OutOfService';
  categoryId: string;
  capacity: number;
  displayOrder: number;
  operatingSchedule: Record<string, { isOperating: boolean; slots: { start: string; end: string }[] }> | null;
  scheduleExceptions: Array<{ startAt: string; endAt: string; reason: string | null }> | null;
  attentionSetup: number | null;
  attentionRun: number | null;
  maskedTimeEnabled: boolean;
  tickMinutes: number | null;
  peremptionThresholdMinutes: number | null;
  maxChunkMinutes: number | null;
  minSetupOperators: number | null;
  maxSetupOperators: number | null;
  minRunOperators: number | null;
  maxRunOperators: number | null;
  maxRunAttention: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StationInput {
  name: string;
  code?: string | null;
  status: string;
  categoryId: string;
  capacity: number;
  displayOrder: number;
  operatingSchedule: Record<string, unknown> | null;
  scheduleExceptions: unknown[] | null;
  attentionSetup?: number | null;
  attentionRun?: number | null;
  maskedTimeEnabled?: boolean;
  tickMinutes?: number | null;
  peremptionThresholdMinutes?: number | null;
  maxChunkMinutes?: number | null;
  minSetupOperators?: number | null;
  maxSetupOperators?: number | null;
  minRunOperators?: number | null;
  maxRunOperators?: number | null;
  maxRunAttention?: number | null;
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
    }),
    deleteStation: builder.mutation<void, string>({
      query: (id) => ({
        url: `/stations/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Stations'],
    }),
    addStationException: builder.mutation<
      { startAt: string; endAt: string; reason: string | null },
      { stationId: string; startAt: string; endAt: string; reason?: string }
    >({
      query: ({ stationId, ...body }) => ({
        url: `/stations/${encodeURIComponent(stationId)}/exceptions`,
        method: 'POST',
        body,
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
  useAddStationExceptionMutation,
} = stationApi;

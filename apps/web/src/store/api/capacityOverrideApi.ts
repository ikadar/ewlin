/**
 * RTK Query slice — Per-scenario capacity overrides (Phase 8).
 *
 * V1 stores intent only — the engine pipeline doesn't yet honour these
 * rows. CRUD is in place so the chef can capture planned capacity
 * changes ahead of the engine integration.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface CapacityOverride {
  id: string;
  scenarioId: string;
  stationId: string;
  stationName: string;
  startsAt: string;
  endsAt: string;
  operatorCountDelta: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapacityOverrideListResponse {
  overrides: CapacityOverride[];
  count: number;
}

export interface CreateCapacityOverrideArgs {
  scenarioId: string;
  stationId: string;
  startsAt: string;
  endsAt: string;
  operatorCountDelta: number;
  note?: string | null;
}

export interface UpdateCapacityOverrideArgs {
  scenarioId: string;
  id: string;
  startsAt?: string;
  endsAt?: string;
  operatorCountDelta?: number;
  note?: string | null;
}

export const capacityOverrideApi = createApi({
  reducerPath: 'capacityOverrideApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['CapacityOverride'],
  endpoints: (builder) => ({
    getCapacityOverrides: builder.query<CapacityOverrideListResponse, string>({
      query: (scenarioId) => `/scenarios/${scenarioId}/capacity-overrides`,
      providesTags: (result, _err, scenarioId) =>
        result
          ? [
              ...result.overrides.map((o) => ({ type: 'CapacityOverride' as const, id: o.id })),
              { type: 'CapacityOverride' as const, id: `LIST-${scenarioId}` },
            ]
          : [{ type: 'CapacityOverride' as const, id: `LIST-${scenarioId}` }],
    }),
    createCapacityOverride: builder.mutation<CapacityOverride, CreateCapacityOverrideArgs>({
      query: ({ scenarioId, ...body }) => ({
        url: `/scenarios/${scenarioId}/capacity-overrides`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { scenarioId }) => [
        { type: 'CapacityOverride', id: `LIST-${scenarioId}` },
      ],
    }),
    updateCapacityOverride: builder.mutation<CapacityOverride, UpdateCapacityOverrideArgs>({
      query: ({ scenarioId, id, ...body }) => ({
        url: `/scenarios/${scenarioId}/capacity-overrides/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { id, scenarioId }) => [
        { type: 'CapacityOverride', id },
        { type: 'CapacityOverride', id: `LIST-${scenarioId}` },
      ],
    }),
    deleteCapacityOverride: builder.mutation<void, { scenarioId: string; id: string }>({
      query: ({ scenarioId, id }) => ({
        url: `/scenarios/${scenarioId}/capacity-overrides/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { id, scenarioId }) => [
        { type: 'CapacityOverride', id },
        { type: 'CapacityOverride', id: `LIST-${scenarioId}` },
      ],
    }),
  }),
});

export const {
  useGetCapacityOverridesQuery,
  useCreateCapacityOverrideMutation,
  useUpdateCapacityOverrideMutation,
  useDeleteCapacityOverrideMutation,
} = capacityOverrideApi;

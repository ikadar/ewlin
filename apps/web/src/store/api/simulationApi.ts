/**
 * RTK Query slice — Simulation forks (Phase 6).
 *
 * V1 simulations are read-only Preprod snapshots with a TTL. The chef
 * uses them as ADV / what-if reference points; the reaper command
 * deletes them once the TTL elapses.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface SimulationSummary {
  id: string;
  name: string | null;
  parentScenarioId: string | null;
  ttlExpiresAt: string | null;
  lastTouchedAt: string | null;
  engineVersion: string | null;
  algoParamsHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationListResponse {
  simulations: SimulationSummary[];
  count: number;
}

export interface SimulationDetail extends SimulationSummary {
  payload: Record<string, unknown> | null;
}

export interface ForkSimulationArgs {
  name: string;
  ttlHours?: number;
}

export const simulationApi = createApi({
  reducerPath: 'simulationApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Simulation'],
  endpoints: (builder) => ({
    getSimulations: builder.query<SimulationListResponse, void>({
      query: () => '/scenarios/simulations',
      providesTags: (result) =>
        result
          ? [
              ...result.simulations.map((s) => ({ type: 'Simulation' as const, id: s.id })),
              { type: 'Simulation' as const, id: 'LIST' },
            ]
          : [{ type: 'Simulation' as const, id: 'LIST' }],
    }),
    getSimulation: builder.query<SimulationDetail, string>({
      query: (id) => `/scenarios/simulations/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Simulation', id }],
    }),
    forkSimulation: builder.mutation<SimulationSummary, ForkSimulationArgs>({
      query: (args) => ({
        url: '/scenarios/simulations',
        method: 'POST',
        body: args,
      }),
      invalidatesTags: [{ type: 'Simulation', id: 'LIST' }],
    }),
    deleteSimulation: builder.mutation<void, string>({
      query: (id) => ({ url: `/scenarios/simulations/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Simulation', id },
        { type: 'Simulation', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetSimulationsQuery,
  useGetSimulationQuery,
  useForkSimulationMutation,
  useDeleteSimulationMutation,
} = simulationApi;

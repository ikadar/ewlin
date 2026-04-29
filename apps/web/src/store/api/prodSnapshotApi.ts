/**
 * RTK Query slice — read-only snapshot of the engaged Prod plan.
 *
 * GET /api/v1/scenarios/prod/snapshot
 *   Returns the frozen plan blob merged with the live completion
 *   overlay. Same shape as the regular /api/v1/schedule/snapshot
 *   payload (built by SnapshotBuilder + serialised at promotion time).
 *
 * Returns null when no promotion has happened yet (server returns 204
 * No Content). Consumers should show an empty state in that case.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import type { ScheduleSnapshot } from '@flux/types';
import { baseQueryWithFixtureSupport } from './baseApi';

export const prodSnapshotApi = createApi({
  reducerPath: 'prodSnapshotApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['ProdSnapshot'],
  endpoints: (builder) => ({
    getProdSnapshot: builder.query<ScheduleSnapshot | null, void>({
      query: () => '/scenarios/prod/snapshot',
      providesTags: ['ProdSnapshot'],
    }),
  }),
});

export const { useGetProdSnapshotQuery } = prodSnapshotApi;

import { createApi } from '@reduxjs/toolkit/query/react';

import { realBaseQuery } from './realBaseQuery';
import type { ScheduleSnapshot } from '../../types/snapshot';

/**
 * T4 — Prod snapshot is no longer served by a dedicated controller +
 * payload deserialiser. The data lives natively in the DB tables and
 * the regular `/schedule/snapshot` endpoint returns the right Prod
 * view because `realBaseQuery` adds `X-Flux-Scenario: prod` whenever
 * the FE is in Prod mode (URL `?env=prod` or `/scenarios/{prod_uuid}`).
 *
 * This file is kept as a thin compatibility wrapper around that
 * endpoint so existing consumers (`useGetProdSnapshotQuery`) can stay
 * unchanged. `archiveApi` / `promotionApi` invalidation calls also
 * keep working because the tag still exists.
 */
export const prodSnapshotApi = createApi({
  reducerPath: 'prodSnapshotApi',
  baseQuery: realBaseQuery,
  tagTypes: ['ProdSnapshot'],
  endpoints: (builder) => ({
    getProdSnapshot: builder.query<ScheduleSnapshot | null, void>({
      query: () => ({
        url: '/schedule/snapshot',
        // realBaseQuery already injects the X-Flux-Scenario header
        // based on the URL — no override needed here.
      }),
      providesTags: ['ProdSnapshot'],
    }),
  }),
});

export const { useGetProdSnapshotQuery } = prodSnapshotApi;

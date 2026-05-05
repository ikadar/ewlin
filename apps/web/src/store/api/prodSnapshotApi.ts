import { createApi } from '@reduxjs/toolkit/query/react';

import { realBaseQuery } from './realBaseQuery';
import { updateSnapshotConflicts } from '@/utils/conflictRecalculation';
import type { SnapshotWithConfig } from './scheduleApi';

/**
 * T4 — Prod snapshot is no longer served by a dedicated controller +
 * payload deserialiser. The data lives natively in the DB tables and
 * the regular `/schedule/snapshot` endpoint returns the right Prod
 * view because `realBaseQuery` adds `X-Flux-Scenario: prod` whenever
 * the FE is in Prod mode (URL `?env=prod` or `/scenarios/{prod_uuid}`).
 *
 * This file is kept as a thin compatibility wrapper around that
 * endpoint so existing consumers (`useGetProdSnapshotQuery` in
 * App.tsx, OperatorSchedulePage, FocusPage, plus the
 * `archiveApi`/`promotionApi` cache-invalidation calls) keep working
 * unchanged. The wrapper:
 *   - Returns the full `SnapshotWithConfig` shape (matches scheduleApi).
 *   - Runs the same `updateSnapshotConflicts` transform so Prod and
 *     Préprod surface conflicts identically.
 *   - Keeps a separate `reducerPath` + `ProdSnapshot` tag so the
 *     two caches stay independent (Prod refreshes don't bust the
 *     Préprod query cache).
 */
export const prodSnapshotApi = createApi({
  reducerPath: 'prodSnapshotApi',
  baseQuery: realBaseQuery,
  tagTypes: ['ProdSnapshot'],
  endpoints: (builder) => ({
    getProdSnapshot: builder.query<SnapshotWithConfig | null, void>({
      query: () => '/schedule/snapshot',
      providesTags: ['ProdSnapshot'],
      transformResponse: (response: SnapshotWithConfig) =>
        updateSnapshotConflicts(response) as SnapshotWithConfig,
    }),
  }),
});

export const { useGetProdSnapshotQuery } = prodSnapshotApi;

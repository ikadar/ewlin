/**
 * RTK Query slice — Prod-side completion (dual-write).
 *
 * POST /api/v1/scenarios/prod/completion/{taskId}
 *   Updates BOTH the prod_completion_overlay AND the live preprod
 *   Schedule. Used when an operator marks a tile as (un)done from the
 *   prod read view.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface ProdCompletionToggleResult {
  taskId: string;
  isCompleted: boolean;
  completedAt: string | null;
}

export const prodCompletionApi = createApi({
  reducerPath: 'prodCompletionApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['ProdSnapshot'],
  endpoints: (builder) => ({
    toggleProdCompletion: builder.mutation<ProdCompletionToggleResult, string>({
      query: (taskId) => ({
        url: `/api/v1/scenarios/prod/completion/${encodeURIComponent(taskId)}`,
        method: 'POST',
      }),
      invalidatesTags: ['ProdSnapshot'],
    }),
  }),
});

export const { useToggleProdCompletionMutation } = prodCompletionApi;

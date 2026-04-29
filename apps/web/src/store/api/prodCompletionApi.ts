/**
 * RTK Query slice — Prod-side completion (dual-write).
 *
 * POST /api/v1/scenarios/prod/completion/{taskId}
 *   Updates BOTH the prod_completion_overlay AND the live preprod
 *   Schedule. Used when an operator marks a tile as (un)done from the
 *   prod read view.
 *
 * UI semantics: each mutation does an optimistic update on the
 * scheduleApi snapshot cache so the tile re-renders instantly. On
 * server confirmation, the snapshot tag is invalidated so the next
 * fetch picks up the dual-written preprod state. On error, the
 * optimistic patch is rolled back.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';
import { scheduleApi } from './scheduleApi';

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
        url: `/scenarios/prod/completion/${encodeURIComponent(taskId)}`,
        method: 'POST',
      }),
      invalidatesTags: ['ProdSnapshot'],
      async onQueryStarted(taskId, { dispatch, queryFulfilled }) {
        // Optimistic update on scheduleApi snapshot — flips the tile's
        // isCompleted instantly so the operator sees feedback under
        // 50 ms instead of waiting for the server round-trip + the next
        // snapshot refetch (which used to take 10+ seconds when the
        // page was busy).
        const patch = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            const assignment = draft.assignments.find((a) => a.taskId === taskId);
            if (assignment) {
              assignment.isCompleted = !assignment.isCompleted;
              assignment.completedAt = assignment.isCompleted
                ? new Date().toISOString()
                : null;
              assignment.updatedAt = new Date().toISOString();
            }
          }),
        );

        try {
          await queryFulfilled;
          // Cross-API invalidation so the Flux dashboard refetches.
          const { fluxApi } = await import('./fluxApi');
          dispatch(fluxApi.util.invalidateTags(['FluxJobs']));
          // Make sure the next /snapshot fetch reflects the dual-write
          // (preprod Schedule was mutated server-side).
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const { useToggleProdCompletionMutation } = prodCompletionApi;

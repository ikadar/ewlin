/**
 * RTK Query slice — V2 progress capture (operator saisie d'avancement).
 *
 * POST /api/v1/scenarios/prod/saisie/{taskId}
 *   Body: { estimatedEndTime: ISO }
 *
 *   Updates the assignment's scheduledEnd to the operator's estimate.
 *   The engine then triggers a replan with the run-only productivity
 *   ratio (cf. project_calage_run_ratio memory). Returns the new
 *   snapshot indirectly via cache invalidation.
 *
 * UI semantics: optimistic update on the scheduleApi snapshot so the
 * tile geometry shifts instantly (operator sees their saisie reflected
 * immediately). On server confirmation, the snapshot tag is invalidated
 * to fetch the post-replan state. On error, the optimistic patch rolls
 * back.
 *
 * @see docs/operator-sandbox/progress-capture-design.md
 * @see docs/operator-sandbox/progress-capture-impl-plan.md (Phase 2.1)
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';
import { scheduleApi } from './scheduleApi';

export interface ReportSaisieRequest {
  taskId: string;
  /** Operator's estimated end time (ISO 8601). May be in the past (rétroactive). */
  estimatedEndTime: string;
}

export interface ReportSaisieResult {
  taskId: string;
  /** New scheduled end (matches the saisie), post-replan. */
  scheduledEnd: string;
  /** Server-recorded saisie timestamp. */
  lastSaisieAt: string;
}

export const saisieApi = createApi({
  reducerPath: 'saisieApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Snapshot'],
  endpoints: (builder) => ({
    reportSaisie: builder.mutation<ReportSaisieResult, ReportSaisieRequest>({
      query: ({ taskId, estimatedEndTime }) => ({
        url: `/scenarios/prod/saisie/${encodeURIComponent(taskId)}`,
        method: 'POST',
        body: { estimatedEndTime },
      }),
      async onQueryStarted({ taskId, estimatedEndTime }, { dispatch, queryFulfilled }) {
        // Optimistic — flip scheduledEnd on the snapshot cache so the tile
        // re-renders instantly. The actual replan runs server-side ; we
        // invalidate after success so the next snapshot fetch picks up
        // the post-replan state (which may differ from our optimistic
        // patch if the engine had to slide things around).
        const patch = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            const a = draft.assignments.find((x) => x.taskId === taskId);
            if (a) {
              a.scheduledEnd = estimatedEndTime;
              a.updatedAt = new Date().toISOString();
            }
          }),
        );

        try {
          await queryFulfilled;
          // Force a re-fetch so we get the post-replan snapshot from the engine.
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const { useReportSaisieMutation } = saisieApi;

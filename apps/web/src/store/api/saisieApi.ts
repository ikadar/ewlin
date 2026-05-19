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
import { productionReportApi } from './productionReportApi';
import { prodSnapshotApi } from './prodSnapshotApi';
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

export interface MarkNotCompletedRequest {
  taskId: string;
}

export interface MarkNotCompletedResult {
  taskId: string;
  scheduledEnd: string;
  reverted: true;
}

export interface ClearRecordedProgressResult {
  /** Number of tasks whose anchor was nulled (zero when nothing to do). */
  cleared: number;
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
        headers: { 'X-Flux-Scenario': 'prod' },
      }),
      async onQueryStarted({ taskId, estimatedEndTime }, { dispatch, queryFulfilled }) {
        const now = new Date().toISOString();
        const patchPreprod = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            const a = draft.assignments.find((x) => x.taskId === taskId);
            if (a) {
              a.scheduledEnd = estimatedEndTime;
              a.updatedAt = now;
            }
          }),
        );
        const patchProd = dispatch(
          prodSnapshotApi.util.updateQueryData('getProdSnapshot', undefined, (draft) => {
            if (!draft) return;
            const a = draft.assignments.find((x) => x.taskId === taskId);
            if (a) {
              a.scheduledEnd = estimatedEndTime;
              a.updatedAt = now;
            }
          }),
        );

        try {
          await queryFulfilled;
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
          dispatch(prodSnapshotApi.util.invalidateTags(['ProdSnapshot']));
          dispatch(productionReportApi.util.invalidateTags(['ProductionReport']));
        } catch {
          patchPreprod.undo();
          patchProd.undo();
        }
      },
    }),
    /**
     * Reset the optimistic progress anchor on every task. Wired to the
     * CTRL+ALT+Z dialog's "Réinitialiser aussi les saisies d'avancement"
     * checkbox (off by default — the gesture is destructive).
     */
    markNotCompleted: builder.mutation<MarkNotCompletedResult, MarkNotCompletedRequest>({
      query: ({ taskId }) => ({
        url: `/scenarios/prod/uncomplete/${encodeURIComponent(taskId)}`,
        method: 'POST',
        headers: { 'X-Flux-Scenario': 'prod' },
      }),
      async onQueryStarted({ taskId }, { dispatch, queryFulfilled }) {
        const patchProd = dispatch(
          prodSnapshotApi.util.updateQueryData('getProdSnapshot', undefined, (draft) => {
            if (!draft) return;
            const a = draft.assignments.find((x) => x.taskId === taskId);
            if (a) {
              a.isCompleted = false;
              a.completedAt = null;
              a.updatedAt = new Date().toISOString();
            }
          }),
        );
        try {
          await queryFulfilled;
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
          dispatch(prodSnapshotApi.util.invalidateTags(['ProdSnapshot']));
        } catch {
          patchProd.undo();
        }
      },
    }),
    clearRecordedProgress: builder.mutation<ClearRecordedProgressResult, void>({
      query: () => ({
        url: '/scenarios/prod/clear-recorded-progress',
        method: 'POST',
        headers: { 'X-Flux-Scenario': 'prod' },
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        } catch {
          // No optimistic patch — the snapshot fetch will reflect the
          // backend rollback if the request failed.
        }
      },
    }),
  }),
});

export const { useReportSaisieMutation, useMarkNotCompletedMutation, useClearRecordedProgressMutation } = saisieApi;

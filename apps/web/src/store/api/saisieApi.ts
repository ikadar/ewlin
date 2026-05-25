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
        // Unified saisie endpoint (Phase 4 of avancement remise-à-plat,
        // 2026-05-24). Discriminated body : kind=endTime / kind=pct.
        url: `/scenarios/prod/task-progress/${encodeURIComponent(taskId)}`,
        method: 'POST',
        body: { kind: 'endTime', endTime: estimatedEndTime },
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
    /**
     * Set Task.recordedProgressPct directly to an explicit percentage.
     * Used by the Acomptes tab to write progress through the unified
     * wall-layer channel.
     *
     * IMPORTANT — does NOT override X-Flux-Scenario to 'prod' (unlike
     * the sibling mutations above). Reason : the Acomptes tab is opened
     * from the JCF Modifier modal which is Préprod-only (the « no edit
     * in Prod » rule). The Task UUID known to the FE is therefore the
     * Préprod-scoped one. Sending an explicit prod header would (a) be
     * blocked by ProdReadOnlyGuardSubscriber and (b) cause the
     * ScenarioFilter to look for a Prod-scoped Task with that UUID and
     * return 404.
     *
     * Letting the FE's current scenario (Préprod) flow through means
     * the controller finds the Préprod-scoped Task, calls
     * Task::recordProgress which delegates to the SHARED TaskWall row
     * (keyed by logical_task_id, single row per logical task, common
     * to all scenarios — see TaskWall entity). Net effect : the wall
     * value is written once and visible in both Préprod and Prod. */
    recordProgressDirect: builder.mutation<{ taskId: string; recordedProgressPct: number; recordedAt: string }, { taskId: string; progressPct: number }>({
      query: ({ taskId, progressPct }) => ({
        // Unified saisie endpoint (Phase 4 of avancement remise-à-plat,
        // 2026-05-24). Discriminated body : kind=endTime / kind=pct.
        //
        // IMPORTANT — do NOT override X-Flux-Scenario to 'prod' here.
        // The Acomptes tab is opened from the Préprod-only JCF Modifier
        // modal and the Task UUID is Préprod-scoped. Forcing prod would
        // (a) be 403'd by ProdReadOnlyGuardSubscriber and (b) cause
        // ScenarioFilter to 404 the Préprod UUID. Letting the FE's
        // current scenario flow through lets the controller find the
        // task in any scenario ; the write hits the shared TaskWall
        // either way (single row per logical_task_id).
        url: `/scenarios/prod/task-progress/${encodeURIComponent(taskId)}`,
        method: 'POST',
        body: { kind: 'pct', pct: progressPct },
      }),
      async onQueryStarted({ taskId, progressPct }, { dispatch, queryFulfilled }) {
        // Optimistic patch so the rond visually flips immediately when
        // Mode avancement clicks fire (the rond is a shortcut over
        // recordProgressDirect at pct=100/0 since Phase 2). Rolled back
        // on server error.
        const optimisticAt = new Date().toISOString();
        const patchPreprod = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            const t = draft.tasks.find((x) => x.id === taskId);
            if (t && t.type === 'Internal') {
              t.recordedProgressPct = progressPct;
              t.recordedAt = optimisticAt;
            }
          }),
        );
        const patchProd = dispatch(
          prodSnapshotApi.util.updateQueryData('getProdSnapshot', undefined, (draft) => {
            if (!draft) return;
            const t = draft.tasks.find((x) => x.id === taskId);
            if (t && t.type === 'Internal') {
              t.recordedProgressPct = progressPct;
              t.recordedAt = optimisticAt;
            }
          }),
        );
        try {
          await queryFulfilled;
          // No invalidateTags : the server response carries the same
          // three fields the optimistic patch already wrote
          // (taskId / recordedProgressPct / recordedAt) and Mode
          // avancement clicks fire in rapid bursts. Forcing a full
          // Snapshot+ProdSnapshot refetch per click was the dominant
          // cause of UI latency between successive ronds.
        } catch {
          patchPreprod.undo();
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
          dispatch(prodSnapshotApi.util.invalidateTags(['ProdSnapshot']));
        } catch {
          // No optimistic patch — the snapshot fetch will reflect the
          // backend rollback if the request failed.
        }
      },
    }),
  }),
});

export const {
  useReportSaisieMutation,
  useMarkNotCompletedMutation,
  useClearRecordedProgressMutation,
  useRecordProgressDirectMutation,
} = saisieApi;

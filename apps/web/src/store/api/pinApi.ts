/**
 * RTK Query slice — V2 progress capture, parameterized pin endpoints.
 *
 * Two related operations grouped in a single slice :
 *
 * 1. POST /api/v1/schedule/feasibility-preview
 *    Body: { taskId, targetDateTime }
 *    Pure probe — no state mutation. Used by SetStartTimeDialog to render
 *    the live "✓ disponible / ⚠ glissé" hint as the operator picks a date.
 *
 * 2. POST /api/v1/scenarios/prod/pin/{taskId}
 *    Body: { targetDateTime }
 *    Creates or moves a pin to the target instant. The engine resolves
 *    via slide-to-nearest if the slot is unavailable (consistent with
 *    feedback_pin_semantics memory). Returns the resolved datetime + an
 *    optional `slidWith` indicating why the slot was glided.
 *
 * @see docs/operator-sandbox/progress-capture-impl-plan.md (Phase 2.2 + 2.3)
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';
import { scheduleApi } from './scheduleApi';

export type InfeasibilityReason = 'closure' | 'capacity' | 'dependency';

export interface FeasibilityPreviewRequest {
  taskId: string;
  /** Target pin datetime, ISO 8601. */
  targetDateTime: string;
}

export interface FeasibilityPreviewResult {
  /** True when the target slot is available verbatim. */
  feasible: boolean;
  /**
   * The datetime the engine would commit. Equal to `targetDateTime` when
   * `feasible` is true ; the next open slot otherwise.
   */
  resolvedDateTime: string;
  /** Why the slot is unavailable (when `feasible` is false). */
  reason?: InfeasibilityReason;
}

export interface PinAtTimeRequest {
  taskId: string;
  targetDateTime: string;
}

export interface PinAtTimeResult {
  taskId: string;
  /** Resolved start time after slide-to-nearest. */
  scheduledStart: string;
  isPinned: true;
  /** Indicates the slide reason when the target was unfeasible. */
  slidWith?: InfeasibilityReason;
}

export const pinApi = createApi({
  reducerPath: 'pinApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Snapshot'],
  endpoints: (builder) => ({
    feasibilityPreview: builder.mutation<FeasibilityPreviewResult, FeasibilityPreviewRequest>({
      query: ({ taskId, targetDateTime }) => ({
        url: '/schedule/feasibility-preview',
        method: 'POST',
        body: { taskId, targetDateTime },
      }),
    }),
    pinAtTime: builder.mutation<PinAtTimeResult, PinAtTimeRequest>({
      query: ({ taskId, targetDateTime }) => ({
        url: `/scenarios/prod/pin/${encodeURIComponent(taskId)}`,
        method: 'POST',
        body: { targetDateTime },
        headers: { 'X-Flux-Scenario': 'prod' },
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // Slide-to-nearest may diverge from the operator's target ;
          // refetch to display the engine's actual resolution.
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        } catch {
          // No optimistic patch to undo — keep the UI honest by refetching.
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        }
      },
    }),
  }),
});

export const {
  useFeasibilityPreviewMutation,
  usePinAtTimeMutation,
} = pinApi;

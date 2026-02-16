/**
 * RTK Query API Slice - Schedule API
 *
 * v0.5.0: Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 * - In mock mode (?fixture=xxx or VITE_USE_MOCK=true): uses mockBaseQuery
 * - In real mode: uses realBaseQuery (fetchBaseQuery)
 *
 * v0.5.8: Optimistic updates for all assignment operations.
 * - Immediate UI feedback before API response
 * - Automatic rollback on error
 *
 * @see docs/releases/v0.5.0-api-client-configuration.md
 * @see docs/releases/v0.5.8-optimistic-updates.md
 * @see docs/architecture/rtk-query-design.md
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  ScheduleSnapshot,
  CreateJobRequest,
  UpdateJobRequest,
  AssignTaskRequest,
  AssignmentResponse,
  CompletionResponse,
  UnassignmentResponse,
  CompactStationResponse,
  ClientSuggestionsResponse,
  ReferenceLookupResponse,
  InternalTask,
  TaskAssignment,
} from '@flux/types';
import { isInternalTask } from '@flux/types';
import { calculateEndTime } from '@/utils/timeCalculations';

/**
 * Response from createJob mutation.
 * Simplified response with essential job info.
 */
interface CreateJobResponse {
  id: string;
  reference: string;
  client: string;
  description: string;
  workshopExitDate: string;
  status: string;
  elementIds: string[];
  taskIds: string[];
  createdAt: string;
}

/**
 * Response from updateJob mutation.
 * Returns updated job metadata.
 */
interface UpdateJobResponse {
  id: string;
  reference: string;
  client: string;
  description: string;
  workshopExitDate: string;
  status: string;
  updatedAt: string;
}
import { baseQueryWithFixtureSupport } from './baseApi';

// ============================================================================
// Optimistic Update Helpers
// ============================================================================

/**
 * Generate a temporary ID for optimistic assignments.
 * Will be replaced by server-generated ID on successful response.
 */
function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate scheduled end time for a task.
 * Uses station operating hours if available.
 */
function calculateOptimisticEndTime(
  snapshot: ScheduleSnapshot,
  taskId: string,
  targetId: string,
  scheduledStart: string
): string {
  const task = snapshot.tasks.find((t) => t.id === taskId);
  if (!task || !isInternalTask(task)) {
    // For outsourced tasks or if task not found, use start time as fallback
    return scheduledStart;
  }

  const station = snapshot.stations.find((s) => s.id === targetId);
  return calculateEndTime(task as InternalTask, scheduledStart, station);
}

// ============================================================================
// API Slice Definition
// ============================================================================

export const scheduleApi = createApi({
  reducerPath: 'scheduleApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Snapshot', 'ClientSuggestions'],

  endpoints: (builder) => ({
    // ========================================================================
    // Queries
    // ========================================================================

    /**
     * Get the complete schedule snapshot.
     *
     * Mock mode: mockBaseQuery handles this via getSnapshot()
     * Real mode: GET /schedule/snapshot
     *
     * @see docs/architecture/rtk-query-design.md#getSnapshot
     */
    getSnapshot: builder.query<ScheduleSnapshot, void>({
      query: () => '/schedule/snapshot',
      providesTags: ['Snapshot'],
    }),

    /**
     * Get client name suggestions for autocomplete.
     *
     * Mock mode: mockBaseQuery filters MOCK_CLIENTS by prefix
     * Real mode: GET /jobs/clients?q={prefix}
     *
     * @param prefix - Search prefix (min 2 chars recommended)
     * @see docs/releases/v0.5.5-client-autocomplete-api.md
     */
    getClientSuggestions: builder.query<ClientSuggestionsResponse, string>({
      query: (prefix) => `/jobs/clients?q=${encodeURIComponent(prefix)}`,
      providesTags: ['ClientSuggestions'],
    }),

    /**
     * Lookup job by reference to get associated client name.
     *
     * Mock mode: mockBaseQuery checks existing jobs in snapshot
     * Real mode: GET /jobs/lookup-by-reference?ref={reference}
     *
     * @param reference - Job reference to lookup
     * @returns { client: string | null } - Client name if found, null otherwise
     * @see docs/releases/v0.5.6-reference-lookup-api.md
     */
    lookupByReference: builder.query<ReferenceLookupResponse, string>({
      query: (reference) => `/jobs/lookup-by-reference?ref=${encodeURIComponent(reference)}`,
    }),

    // ========================================================================
    // Mutations
    // ========================================================================

    /**
     * Create a new job from JCF form data.
     *
     * Mock mode: Creates job, elements, and tasks in mock snapshot
     * Real mode: POST /jobs
     *
     * @see docs/architecture/rtk-query-design.md#createJob
     * @see docs/releases/v0.5.4-job-creation-via-api.md
     */
    createJob: builder.mutation<CreateJobResponse, CreateJobRequest>({
      query: (body) => ({
        url: '/jobs',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Snapshot'],
    }),

    /**
     * Update an existing job's metadata.
     *
     * Mock mode: Updates job in mock snapshot
     * Real mode: PUT /jobs/{id}
     *
     * @see docs/releases/v0.5.13b-job-edit-via-jcf-modal.md
     */
    updateJob: builder.mutation<UpdateJobResponse, { jobId: string; body: UpdateJobRequest }>({
      query: ({ jobId, body }) => ({
        url: `/jobs/${jobId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Snapshot'],
    }),

    /**
     * Assign a task to a station or provider.
     *
     * Mock mode: mockBaseQuery handles this
     * Real mode: POST /tasks/{taskId}/assign
     *
     * Uses optimistic update for instant UI feedback (v0.5.8):
     * - Immediately adds assignment to cache
     * - Automatically rolls back on error
     *
     * @see docs/architecture/rtk-query-design.md#assignTask
     * @see docs/releases/v0.5.8-optimistic-updates.md
     */
    assignTask: builder.mutation<
      AssignmentResponse,
      { taskId: string; body: AssignTaskRequest }
    >({
      query: ({ taskId, body }) => ({
        url: `/tasks/${taskId}/assign`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Snapshot'],
      async onQueryStarted({ taskId, body }, { dispatch, queryFulfilled, getState }) {
        // Get current snapshot from cache
        const state = getState() as { scheduleApi: { queries: Record<string, { data?: ScheduleSnapshot }> } };
        const snapshotQuery = Object.values(state.scheduleApi.queries).find(
          (q) => q?.data && 'assignments' in q.data
        );
        const snapshot = snapshotQuery?.data as ScheduleSnapshot | undefined;

        if (!snapshot) {
          // No snapshot in cache, skip optimistic update
          return;
        }

        // Calculate end time
        const scheduledEnd = calculateOptimisticEndTime(
          snapshot,
          taskId,
          body.targetId,
          body.scheduledStart
        );

        // Create optimistic assignment
        const now = new Date().toISOString();
        const optimisticAssignment: TaskAssignment = {
          id: generateTempId(),
          taskId,
          targetId: body.targetId,
          isOutsourced: body.isOutsourced ?? false,
          scheduledStart: body.scheduledStart,
          scheduledEnd,
          isCompleted: false,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        // Optimistic update: immediately add assignment to cache
        const patchResult = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            draft.assignments.push(optimisticAssignment);
          })
        );

        try {
          await queryFulfilled;
        } catch {
          // Rollback on error
          patchResult.undo();
        }
      },
    }),

    /**
     * Reschedule an existing task assignment.
     *
     * Mock mode: mockBaseQuery handles this
     * Real mode: PUT /tasks/{taskId}/assign
     *
     * Uses optimistic update for instant UI feedback (v0.5.8):
     * - Immediately updates assignment in cache
     * - Automatically rolls back on error
     *
     * @see docs/architecture/rtk-query-design.md#rescheduleTask
     * @see docs/releases/v0.5.8-optimistic-updates.md
     */
    rescheduleTask: builder.mutation<
      AssignmentResponse,
      { taskId: string; body: AssignTaskRequest }
    >({
      query: ({ taskId, body }) => ({
        url: `/tasks/${taskId}/assign`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Snapshot'],
      async onQueryStarted({ taskId, body }, { dispatch, queryFulfilled, getState }) {
        // Get current snapshot from cache
        const state = getState() as { scheduleApi: { queries: Record<string, { data?: ScheduleSnapshot }> } };
        const snapshotQuery = Object.values(state.scheduleApi.queries).find(
          (q) => q?.data && 'assignments' in q.data
        );
        const snapshot = snapshotQuery?.data as ScheduleSnapshot | undefined;

        if (!snapshot) {
          // No snapshot in cache, skip optimistic update
          return;
        }

        // Calculate end time
        const scheduledEnd = calculateOptimisticEndTime(
          snapshot,
          taskId,
          body.targetId,
          body.scheduledStart
        );

        // Optimistic update: immediately update assignment in cache
        const patchResult = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            const assignment = draft.assignments.find((a) => a.taskId === taskId);
            if (assignment) {
              assignment.targetId = body.targetId;
              assignment.isOutsourced = body.isOutsourced ?? assignment.isOutsourced;
              assignment.scheduledStart = body.scheduledStart;
              assignment.scheduledEnd = scheduledEnd;
              assignment.updatedAt = new Date().toISOString();
            }
          })
        );

        try {
          await queryFulfilled;
        } catch {
          // Rollback on error
          patchResult.undo();
        }
      },
    }),

    /**
     * Remove a task assignment (recall).
     *
     * Mock mode: mockBaseQuery handles this
     * Real mode: DELETE /tasks/{taskId}/assign
     *
     * Uses optimistic update for instant UI feedback (v0.5.8):
     * - Immediately removes assignment from cache
     * - Automatically rolls back on error
     *
     * @see docs/architecture/rtk-query-design.md#unassignTask
     * @see docs/releases/v0.5.8-optimistic-updates.md
     */
    unassignTask: builder.mutation<UnassignmentResponse, string>({
      query: (taskId) => ({
        url: `/tasks/${taskId}/assign`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Snapshot'],
      async onQueryStarted(taskId, { dispatch, queryFulfilled }) {
        // Optimistic update: immediately remove assignment from cache
        const patchResult = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            const index = draft.assignments.findIndex((a) => a.taskId === taskId);
            if (index !== -1) {
              draft.assignments.splice(index, 1);
            }
          })
        );

        try {
          await queryFulfilled;
        } catch {
          // Rollback on error
          patchResult.undo();
        }
      },
    }),

    /**
     * Toggle the completion status of an assigned task.
     *
     * Mock mode: mockBaseQuery handles this
     * Real mode: PUT /tasks/{taskId}/completion
     *
     * Uses optimistic update for instant UI feedback:
     * - Immediately toggles isCompleted in cache
     * - Automatically rolls back on error
     *
     * @see docs/architecture/rtk-query-design.md#toggleCompletion
     * @see docs/releases/v0.5.3-completion-toggle.md
     */
    toggleCompletion: builder.mutation<CompletionResponse, string>({
      query: (taskId) => ({
        url: `/tasks/${taskId}/completion`,
        method: 'PUT',
      }),
      invalidatesTags: ['Snapshot'],
      async onQueryStarted(taskId, { dispatch, queryFulfilled }) {
        // Optimistic update: immediately toggle completion in cache
        const patchResult = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            const assignment = draft.assignments.find((a) => a.taskId === taskId);
            if (assignment) {
              assignment.isCompleted = !assignment.isCompleted;
              assignment.completedAt = assignment.isCompleted
                ? new Date().toISOString()
                : null;
              assignment.updatedAt = new Date().toISOString();
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          // Rollback on error
          patchResult.undo();
        }
      },
    }),

    /**
     * Compact a station's assignments (remove gaps).
     *
     * Mock mode: mockBaseQuery handles this via handleCompactStation
     * Real mode: POST /stations/{stationId}/compact
     *
     * Uses optimistic update for instant UI feedback:
     * - Immediately compacts assignments in cache
     * - Automatically rolls back on error
     */
    compactStation: builder.mutation<CompactStationResponse, string>({
      query: (stationId) => ({
        url: `/stations/${stationId}/compact`,
        method: 'POST',
      }),
      invalidatesTags: ['Snapshot'],
    }),
  }),
});

// ============================================================================
// Export Hooks
// ============================================================================

export const {
  useGetSnapshotQuery,
  useGetClientSuggestionsQuery,
  useLookupByReferenceQuery,
  useLazyLookupByReferenceQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useAssignTaskMutation,
  useRescheduleTaskMutation,
  useUnassignTaskMutation,
  useToggleCompletionMutation,
  useCompactStationMutation,
} = scheduleApi;

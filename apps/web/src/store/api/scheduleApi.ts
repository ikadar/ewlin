/**
 * RTK Query API Slice - Schedule API
 *
 * v0.5.0: Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 * - In mock mode (?fixture=xxx or VITE_USE_MOCK=true): uses mockBaseQuery
 * - In real mode: uses realBaseQuery (fetchBaseQuery)
 *
 * @see docs/releases/v0.5.0-api-client-configuration.md
 * @see docs/architecture/rtk-query-design.md
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  ScheduleSnapshot,
  CreateJobRequest,
  AssignTaskRequest,
  AssignmentResponse,
  CompletionResponse,
  UnassignmentResponse,
} from '@flux/types';

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
import { baseQueryWithFixtureSupport } from './baseApi';

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
     * Assign a task to a station or provider.
     *
     * Mock mode: mockBaseQuery handles this
     * Real mode: POST /tasks/{taskId}/assign
     *
     * @see docs/architecture/rtk-query-design.md#assignTask
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
    }),

    /**
     * Reschedule an existing task assignment.
     *
     * Mock mode: mockBaseQuery handles this
     * Real mode: PUT /tasks/{taskId}/assign
     *
     * @see docs/architecture/rtk-query-design.md#rescheduleTask
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
    }),

    /**
     * Remove a task assignment (recall).
     *
     * Mock mode: mockBaseQuery handles this
     * Real mode: DELETE /tasks/{taskId}/assign
     *
     * @see docs/architecture/rtk-query-design.md#unassignTask
     */
    unassignTask: builder.mutation<UnassignmentResponse, string>({
      query: (taskId) => ({
        url: `/tasks/${taskId}/assign`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Snapshot'],
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
  }),
});

// ============================================================================
// Export Hooks
// ============================================================================

export const {
  useGetSnapshotQuery,
  useCreateJobMutation,
  useAssignTaskMutation,
  useRescheduleTaskMutation,
  useUnassignTaskMutation,
  useToggleCompletionMutation,
} = scheduleApi;

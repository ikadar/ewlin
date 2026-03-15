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
  SplitTaskRequest,
  SplitTaskResponse,
  FuseTaskResponse,
  InternalTask,
  TaskAssignment,
  PaperStatus,
  BatStatus,
  PlateStatus,
  FormeStatus,
} from '@flux/types';
import { isInternalTask } from '@flux/types';
import { calculateEndTime } from '@/utils/timeCalculations';
import { generateId } from '@/utils/generateId';
import { applySplitToSnapshot, applyFuseToSnapshot } from '@/utils/splitFuse';

/**
 * Response from getSavedSchedules query.
 */
export interface SavedScheduleItem {
  id: string;
  name: string;
  assignmentCount: number;
  sourceVersion: number;
  createdAt: string;
}

/**
 * Warning generated during schedule load (inconsistency detection).
 */
export interface LoadWarning {
  type: 'task_filtered_deleted' | 'task_filtered_cancelled' | 'target_filtered_deleted' | 'end_time_recalculated';
  details: Record<string, string | boolean | null>;
}

/**
 * Response from loadSchedule mutation.
 */
export interface LoadScheduleResponse {
  version: number;
  assignmentCount: number;
  warnings: LoadWarning[];
}

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
/**
 * Request for updating element prerequisite status.
 */
interface UpdateElementStatusRequest {
  elementId: string;
  field: 'paperStatus' | 'batStatus' | 'plateStatus' | 'formeStatus';
  value: PaperStatus | BatStatus | PlateStatus | FormeStatus;
}

/**
 * Response from updateElementStatus mutation.
 * Mirrors PHP ElementController::updatePrerequisites response.
 */
interface UpdateElementStatusResponse {
  elementId: string;
  paperStatus: PaperStatus;
  batStatus: BatStatus;
  plateStatus: PlateStatus;
  formeStatus: FormeStatus;
  isBlocked: boolean;
}

import { baseQueryWithFixtureSupport } from './baseApi';

/**
 * Extended snapshot type that includes server-side config values.
 * lookbackDays is served by the PHP API but not yet in @flux/types.
 */
interface SnapshotWithConfig extends ScheduleSnapshot {
  lookbackDays?: number;
}

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
  tagTypes: ['Snapshot', 'ClientSuggestions', 'SavedSchedules'],

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
    getSnapshot: builder.query<SnapshotWithConfig, void>({
      query: () => '/schedule/snapshot',
      providesTags: ['Snapshot'],
    }),

    /**
     * Get client name suggestions for autocomplete.
     *
     * Mock mode: mockBaseQuery filters MOCK_CLIENTS by prefix
     * Real mode: GET /clients?q={prefix}
     *
     * @param prefix - Search prefix (min 2 chars recommended)
     * @see docs/releases/v0.5.5-client-autocomplete-api.md
     */
    getClientSuggestions: builder.query<ClientSuggestionsResponse, string>({
      query: (prefix) => `/clients?q=${encodeURIComponent(prefix)}`,
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
     * Clear all tile assignments for a job.
     *
     * Mock mode: Removes all assignments for the job's tasks
     * Real mode: DELETE /jobs/{id}/assignments
     *
     * Uses optimistic update for instant UI feedback.
     */
    clearJobAssignments: builder.mutation<{ unassignedCount: number }, string>({
      query: (jobId) => ({
        url: `/jobs/${jobId}/assignments`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Snapshot'],
      async onQueryStarted(jobId, { dispatch, queryFulfilled, getState }) {
        const state = getState() as { scheduleApi: { queries: Record<string, { data?: ScheduleSnapshot }> } };
        const snapshotQuery = Object.values(state.scheduleApi.queries).find(
          (q) => q?.data && 'assignments' in q.data
        );
        const snapshot = snapshotQuery?.data as ScheduleSnapshot | undefined;

        if (!snapshot) return;

        // Collect all task IDs for this job
        const job = snapshot.jobs.find((j) => j.id === jobId);
        if (!job) return;

        const jobTaskIds = new Set(job.taskIds);

        const patchResult = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            const now = new Date().toISOString();
            draft.assignments = draft.assignments.filter((a) => {
              if (!jobTaskIds.has(a.taskId)) return true;
              if (a.isCompleted) return true;
              if (a.scheduledStart <= now && (!a.scheduledEnd || a.scheduledEnd > now)) return true;
              return false;
            });
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    /**
     * Delete a job and all related data (elements, tasks, assignments).
     *
     * Mock mode: Removes job, elements, tasks, assignments from snapshot
     * Real mode: DELETE /jobs/{id} (cascade via Doctrine ORM)
     */
    deleteJob: builder.mutation<void, string>({
      query: (jobId) => ({
        url: `/jobs/${jobId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Snapshot'],
    }),

    /**
     * Update element prerequisite status (paper, bat, plate, forme).
     *
     * Mock mode: Updates element in mock snapshot
     * Real mode: PUT /elements/{id}/prerequisites
     *
     * Uses optimistic update for instant UI feedback.
     */
    updateElementStatus: builder.mutation<UpdateElementStatusResponse, UpdateElementStatusRequest>({
      query: ({ elementId, field, value }) => ({
        url: `/elements/${elementId}/prerequisites`,
        method: 'PUT',
        body: { [field]: value },
      }),
      invalidatesTags: ['Snapshot'],
      async onQueryStarted({ elementId, field, value }, { dispatch, queryFulfilled }) {
        // Optimistic update: immediately update element status in cache
        const patchResult = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            const element = draft.elements.find((e) => e.id === elementId);
            if (element) {
              (element as unknown as Record<string, unknown>)[field] = value;
              element.updatedAt = new Date().toISOString();
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

    /**
     * Split an internal task into two parts.
     *
     * Mock mode: mockBaseQuery handles this via handleSplitTask
     * Real mode: POST /tasks/{taskId}/split
     *
     * Uses optimistic update for instant UI feedback.
     */
    splitTask: builder.mutation<
      SplitTaskResponse,
      { taskId: string; body: SplitTaskRequest }
    >({
      query: ({ taskId, body }) => ({
        url: `/tasks/${taskId}/split`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Snapshot'],
      async onQueryStarted({ taskId, body }, { dispatch, queryFulfilled }) {
        const partAId = generateId();
        const partBId = generateId();
        const now = new Date().toISOString();

        const patchResult = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            applySplitToSnapshot(draft, {
              taskId,
              ratio: body.ratio,
              partAId,
              partBId,
              now,
            });
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    /**
     * Fuse (merge) all parts of a split task back into one.
     *
     * Mock mode: mockBaseQuery handles this via handleFuseTask
     * Real mode: POST /tasks/{taskId}/fuse
     *
     * Uses optimistic update for instant UI feedback.
     */
    fuseTask: builder.mutation<FuseTaskResponse, string>({
      query: (taskId) => ({
        url: `/tasks/${taskId}/fuse`,
        method: 'POST',
      }),
      invalidatesTags: ['Snapshot'],
      async onQueryStarted(taskId, { dispatch, queryFulfilled }) {
        const restoredId = generateId();
        const now = new Date().toISOString();

        const patchResult = dispatch(
          scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
            applyFuseToSnapshot(draft, { taskId, restoredId, now });
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    /**
     * Auto-place all unscheduled tasks for a job using server-side ASAP algorithm.
     *
     * Mock mode: mockBaseQuery handles this via handleAutoPlace
     * Real mode: POST /jobs/{jobId}/auto-place
     *
     * No optimistic update — waits for server response then refetches snapshot.
     */
    autoPlaceJob: builder.mutation<{ placedCount: number; computeMs?: number }, string>({
      query: (jobId) => ({
        url: `/jobs/${jobId}/auto-place`,
        method: 'POST',
      }),
      invalidatesTags: ['Snapshot'],
    }),

    /**
     * Auto-place all unscheduled tasks for a job using server-side ALAP algorithm.
     *
     * Mock mode: mockBaseQuery handles this via handleAutoPlaceAlap
     * Real mode: POST /jobs/{jobId}/auto-place-alap
     *
     * No optimistic update — waits for server response then refetches snapshot.
     */
    autoPlaceJobAlap: builder.mutation<{ placedCount: number; computeMs?: number }, string>({
      query: (jobId) => ({
        url: `/jobs/${jobId}/auto-place-alap`,
        method: 'POST',
      }),
      invalidatesTags: ['Snapshot'],
    }),

    // ========================================================================
    // Saved Schedules
    // ========================================================================

    getSavedSchedules: builder.query<SavedScheduleItem[], void>({
      query: () => '/saved-schedules',
      providesTags: ['SavedSchedules'],
    }),

    saveSchedule: builder.mutation<SavedScheduleItem, { name: string }>({
      query: (body) => ({
        url: '/saved-schedules',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['SavedSchedules'],
    }),

    loadSchedule: builder.mutation<LoadScheduleResponse, string>({
      query: (id) => ({
        url: `/saved-schedules/${id}/load`,
        method: 'POST',
      }),
      invalidatesTags: ['Snapshot', 'SavedSchedules'],
    }),

    deleteSavedSchedule: builder.mutation<void, string>({
      query: (id) => ({
        url: `/saved-schedules/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['SavedSchedules'],
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
  useDeleteJobMutation,
  useClearJobAssignmentsMutation,
  useUpdateElementStatusMutation,
  useAssignTaskMutation,
  useRescheduleTaskMutation,
  useUnassignTaskMutation,
  useToggleCompletionMutation,
  useCompactStationMutation,
  useSplitTaskMutation,
  useFuseTaskMutation,
  useAutoPlaceJobMutation,
  useAutoPlaceJobAlapMutation,
  useGetSavedSchedulesQuery,
  useSaveScheduleMutation,
  useLoadScheduleMutation,
  useDeleteSavedScheduleMutation,
} = scheduleApi;

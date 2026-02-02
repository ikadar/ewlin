/**
 * RTK Query API Slice - Schedule API
 *
 * Mock adapter pattern: queryFn wraps existing mock/snapshot.ts functions.
 * In M5, this will be replaced with fetchBaseQuery for real API calls.
 *
 * @see docs/architecture/rtk-query-design.md
 * @see docs/releases/v0.4.37-redux-rtk-query-setup.md
 */

import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  ScheduleSnapshot,
  CreateJobRequest,
  AssignTaskRequest,
  AssignmentResponse,
  CompletionResponse,
  UnassignmentResponse,
} from '@flux/types';
import { getSnapshot, updateSnapshot } from '../../mock/snapshot';
import { generateId, calculateEndTime, applyPushDown } from '../../utils';
import type { InternalTask, Station, TaskAssignment } from '@flux/types';

// ============================================================================
// API Slice Definition
// ============================================================================

export const scheduleApi = createApi({
  reducerPath: 'scheduleApi',
  baseQuery: fakeBaseQuery(), // M4: mock adapter, M5: fetchBaseQuery
  tagTypes: ['Snapshot', 'ClientSuggestions'],

  endpoints: (builder) => ({
    // ========================================================================
    // Queries
    // ========================================================================

    /**
     * Get the complete schedule snapshot.
     * @see docs/architecture/rtk-query-design.md#getSnapshot
     */
    getSnapshot: builder.query<ScheduleSnapshot, void>({
      queryFn: () => {
        try {
          const snapshot = getSnapshot();
          return { data: snapshot };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: String(error),
            },
          };
        }
      },
      providesTags: ['Snapshot'],
    }),

    // ========================================================================
    // Mutations
    // ========================================================================

    /**
     * Create a new job from JCF form data.
     * @see docs/architecture/rtk-query-design.md#createJob
     */
    createJob: builder.mutation<void, CreateJobRequest>({
      queryFn: (_request) => {
        // M4: Mock implementation - job creation is handled by api/jobs.ts
        // In real implementation, this would call the API
        // For now, just return success (actual creation uses existing api/jobs.ts)
        return { data: undefined };
      },
      invalidatesTags: ['Snapshot'],
    }),

    /**
     * Assign a task to a station or provider.
     * @see docs/architecture/rtk-query-design.md#assignTask
     */
    assignTask: builder.mutation<
      AssignmentResponse,
      { taskId: string; body: AssignTaskRequest }
    >({
      queryFn: ({ taskId, body }) => {
        try {
          const currentSnapshot = getSnapshot();
          const task = currentSnapshot.tasks.find(
            (t) => t.id === taskId
          ) as InternalTask | undefined;

          if (!task) {
            return {
              error: {
                status: 404,
                data: { error: 'NotFound', message: 'Task not found' },
              },
            };
          }

          const station = currentSnapshot.stations.find(
            (s) => s.id === body.targetId
          ) as Station | undefined;
          const scheduledEnd = calculateEndTime(
            task,
            body.scheduledStart,
            station
          );

          // Apply push-down logic for overlapping assignments
          const { updatedAssignments } = applyPushDown(
            currentSnapshot.assignments,
            body.targetId,
            body.scheduledStart,
            scheduledEnd,
            taskId
          );

          // Create new assignment
          const newAssignment: TaskAssignment = {
            id: generateId(),
            taskId,
            targetId: body.targetId,
            isOutsourced: false,
            scheduledStart: body.scheduledStart,
            scheduledEnd,
            isCompleted: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Update snapshot
          updateSnapshot((snapshot) => ({
            ...snapshot,
            assignments: [...updatedAssignments, newAssignment],
          }));

          const response: AssignmentResponse = {
            taskId,
            targetId: body.targetId,
            isOutsourced: false,
            scheduledStart: body.scheduledStart,
            scheduledEnd,
            isCompleted: false,
            completedAt: null,
          };

          return { data: response };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: String(error),
            },
          };
        }
      },
      invalidatesTags: ['Snapshot'],
    }),

    /**
     * Reschedule an existing task assignment.
     * @see docs/architecture/rtk-query-design.md#rescheduleTask
     */
    rescheduleTask: builder.mutation<
      AssignmentResponse,
      { taskId: string; body: AssignTaskRequest }
    >({
      queryFn: ({ taskId, body }) => {
        try {
          const currentSnapshot = getSnapshot();
          const existingAssignment = currentSnapshot.assignments.find(
            (a) => a.taskId === taskId
          );

          if (!existingAssignment) {
            return {
              error: {
                status: 404,
                data: { error: 'NotFound', message: 'Assignment not found' },
              },
            };
          }

          const task = currentSnapshot.tasks.find(
            (t) => t.id === taskId
          ) as InternalTask | undefined;
          const station = currentSnapshot.stations.find(
            (s) => s.id === body.targetId
          ) as Station | undefined;
          const scheduledEnd = task
            ? calculateEndTime(task, body.scheduledStart, station)
            : body.scheduledStart;

          // Remove existing assignment and apply push-down
          const assignmentsWithoutCurrent = currentSnapshot.assignments.filter(
            (a) => a.id !== existingAssignment.id
          );
          const { updatedAssignments } = applyPushDown(
            assignmentsWithoutCurrent,
            body.targetId,
            body.scheduledStart,
            scheduledEnd,
            taskId
          );

          // Update existing assignment
          const updatedAssignment: TaskAssignment = {
            ...existingAssignment,
            targetId: body.targetId,
            scheduledStart: body.scheduledStart,
            scheduledEnd,
            updatedAt: new Date().toISOString(),
          };

          // Update snapshot
          updateSnapshot((snapshot) => ({
            ...snapshot,
            assignments: [...updatedAssignments, updatedAssignment],
          }));

          const response: AssignmentResponse = {
            taskId,
            targetId: body.targetId,
            isOutsourced: existingAssignment.isOutsourced,
            scheduledStart: body.scheduledStart,
            scheduledEnd,
            isCompleted: existingAssignment.isCompleted,
            completedAt: existingAssignment.completedAt,
          };

          return { data: response };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: String(error),
            },
          };
        }
      },
      invalidatesTags: ['Snapshot'],
    }),

    /**
     * Remove a task assignment (recall).
     * @see docs/architecture/rtk-query-design.md#unassignTask
     */
    unassignTask: builder.mutation<UnassignmentResponse, string>({
      queryFn: (taskId) => {
        try {
          const currentSnapshot = getSnapshot();
          const assignment = currentSnapshot.assignments.find(
            (a) => a.taskId === taskId
          );

          if (!assignment) {
            return {
              error: {
                status: 404,
                data: { error: 'NotFound', message: 'Assignment not found' },
              },
            };
          }

          // Remove assignment
          updateSnapshot((snapshot) => ({
            ...snapshot,
            assignments: snapshot.assignments.filter(
              (a) => a.taskId !== taskId
            ),
          }));

          const response: UnassignmentResponse = {
            taskId,
            status: 'ready',
            message: 'Task unassigned successfully',
          };

          return { data: response };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: String(error),
            },
          };
        }
      },
      invalidatesTags: ['Snapshot'],
    }),

    /**
     * Toggle the completion status of an assigned task.
     * @see docs/architecture/rtk-query-design.md#toggleCompletion
     */
    toggleCompletion: builder.mutation<CompletionResponse, string>({
      queryFn: (taskId) => {
        try {
          const currentSnapshot = getSnapshot();
          const assignmentIndex = currentSnapshot.assignments.findIndex(
            (a) => a.taskId === taskId
          );

          if (assignmentIndex === -1) {
            return {
              error: {
                status: 404,
                data: { error: 'NotFound', message: 'Assignment not found' },
              },
            };
          }

          const assignment = currentSnapshot.assignments[assignmentIndex];
          const newIsCompleted = !assignment.isCompleted;
          const completedAt = newIsCompleted ? new Date().toISOString() : null;

          // Update assignment
          updateSnapshot((snapshot) => {
            const newAssignments = [...snapshot.assignments];
            newAssignments[assignmentIndex] = {
              ...assignment,
              isCompleted: newIsCompleted,
              completedAt,
              updatedAt: new Date().toISOString(),
            };
            return { ...snapshot, assignments: newAssignments };
          });

          const response: CompletionResponse = {
            taskId,
            isCompleted: newIsCompleted,
            completedAt,
          };

          return { data: response };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: String(error),
            },
          };
        }
      },
      invalidatesTags: ['Snapshot'],
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

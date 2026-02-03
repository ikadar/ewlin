/**
 * Mock Base Query Adapter
 *
 * Routes RTK Query requests to existing mock functions.
 * This adapter allows the same RTK Query API slice to work
 * with both mock data (development/testing) and real API (production).
 *
 * @see docs/releases/v0.5.0-api-client-configuration.md
 */

import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type {
  ScheduleSnapshot,
  AssignTaskRequest,
  AssignmentResponse,
  CompletionResponse,
  UnassignmentResponse,
  InternalTask,
  Station,
  TaskAssignment,
} from '@flux/types';
import { getSnapshot, updateSnapshot } from '../../mock/snapshot';
import { generateId, calculateEndTime, applyPushDown } from '../../utils';
import { normalizeError, createNotFoundError, createSuccessResponse } from './errorNormalization';

// ============================================================================
// Types
// ============================================================================

interface MockRouteHandler {
  (args: FetchArgs): Promise<{ data: unknown } | { error: FetchBaseQueryError }>;
}

interface MockRoute {
  method: string;
  pattern: RegExp;
  handler: MockRouteHandler;
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /schedule/snapshot - Get complete schedule snapshot
 */
const handleGetSnapshot = async (): Promise<{ data: ScheduleSnapshot }> => {
  const snapshot = getSnapshot();
  return { data: snapshot };
};

/**
 * POST /tasks/:taskId/assign - Assign task to station/provider
 */
const handleAssignTask = async (
  args: FetchArgs
): Promise<{ data: AssignmentResponse } | { error: FetchBaseQueryError }> => {
  const taskId = extractPathParam(args.url, /\/tasks\/([^/]+)\/assign/);
  if (!taskId) {
    return { error: createNotFoundError('Invalid task ID') };
  }

  const body = args.body as AssignTaskRequest;
  const currentSnapshot = getSnapshot();

  const task = currentSnapshot.tasks.find((t) => t.id === taskId) as InternalTask | undefined;
  if (!task) {
    return { error: createNotFoundError('Task not found') };
  }

  const station = currentSnapshot.stations.find((s) => s.id === body.targetId) as Station | undefined;
  const scheduledEnd = calculateEndTime(task, body.scheduledStart, station);

  // Apply push-down logic
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
    isOutsourced: body.isOutsourced ?? false,
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
    isOutsourced: body.isOutsourced ?? false,
    scheduledStart: body.scheduledStart,
    scheduledEnd,
    isCompleted: false,
    completedAt: null,
  };

  return { data: response };
};

/**
 * PUT /tasks/:taskId/assign - Reschedule task
 */
const handleRescheduleTask = async (
  args: FetchArgs
): Promise<{ data: AssignmentResponse } | { error: FetchBaseQueryError }> => {
  const taskId = extractPathParam(args.url, /\/tasks\/([^/]+)\/assign/);
  if (!taskId) {
    return { error: createNotFoundError('Invalid task ID') };
  }

  const body = args.body as AssignTaskRequest;
  const currentSnapshot = getSnapshot();

  const existingAssignment = currentSnapshot.assignments.find((a) => a.taskId === taskId);
  if (!existingAssignment) {
    return { error: createNotFoundError('Assignment not found') };
  }

  const task = currentSnapshot.tasks.find((t) => t.id === taskId) as InternalTask | undefined;
  const station = currentSnapshot.stations.find((s) => s.id === body.targetId) as Station | undefined;
  const scheduledEnd = task ? calculateEndTime(task, body.scheduledStart, station) : body.scheduledStart;

  // Remove existing and apply push-down
  const assignmentsWithoutCurrent = currentSnapshot.assignments.filter((a) => a.id !== existingAssignment.id);
  const { updatedAssignments } = applyPushDown(
    assignmentsWithoutCurrent,
    body.targetId,
    body.scheduledStart,
    scheduledEnd,
    taskId
  );

  // Update assignment
  const updatedAssignment: TaskAssignment = {
    ...existingAssignment,
    targetId: body.targetId,
    scheduledStart: body.scheduledStart,
    scheduledEnd,
    updatedAt: new Date().toISOString(),
  };

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
};

/**
 * DELETE /tasks/:taskId/assign - Unassign task
 */
const handleUnassignTask = async (
  args: FetchArgs
): Promise<{ data: UnassignmentResponse } | { error: FetchBaseQueryError }> => {
  const taskId = extractPathParam(args.url, /\/tasks\/([^/]+)\/assign/);
  if (!taskId) {
    return { error: createNotFoundError('Invalid task ID') };
  }

  const currentSnapshot = getSnapshot();
  const assignment = currentSnapshot.assignments.find((a) => a.taskId === taskId);

  if (!assignment) {
    return { error: createNotFoundError('Assignment not found') };
  }

  updateSnapshot((snapshot) => ({
    ...snapshot,
    assignments: snapshot.assignments.filter((a) => a.taskId !== taskId),
  }));

  const response: UnassignmentResponse = {
    taskId,
    status: 'ready',
    message: 'Task unassigned successfully',
  };

  return { data: response };
};

/**
 * PUT /tasks/:taskId/completion - Toggle completion
 */
const handleToggleCompletion = async (
  args: FetchArgs
): Promise<{ data: CompletionResponse } | { error: FetchBaseQueryError }> => {
  const taskId = extractPathParam(args.url, /\/tasks\/([^/]+)\/completion/);
  if (!taskId) {
    return { error: createNotFoundError('Invalid task ID') };
  }

  const currentSnapshot = getSnapshot();
  const assignmentIndex = currentSnapshot.assignments.findIndex((a) => a.taskId === taskId);

  if (assignmentIndex === -1) {
    return { error: createNotFoundError('Assignment not found') };
  }

  const assignment = currentSnapshot.assignments[assignmentIndex];
  const newIsCompleted = !assignment.isCompleted;
  const completedAt = newIsCompleted ? new Date().toISOString() : null;

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
};

// ============================================================================
// Route Configuration
// ============================================================================

/**
 * POST /jobs - Create job (mock implementation)
 * Note: In mock mode, job creation is currently a no-op.
 * The actual mock job creation is handled by the JCF form's direct mock calls.
 */
const handleCreateJob = async (): Promise<{ data: void }> => {
  // Mock implementation - return success
  // Actual job creation in mock mode uses existing mock/api.ts
  return { data: undefined };
};

const routes: MockRoute[] = [
  // Schedule
  { method: 'GET', pattern: /^\/schedule\/snapshot$/, handler: handleGetSnapshot },

  // Jobs
  { method: 'POST', pattern: /^\/jobs$/, handler: handleCreateJob },

  // Task assignments
  { method: 'POST', pattern: /^\/tasks\/[^/]+\/assign$/, handler: handleAssignTask },
  { method: 'PUT', pattern: /^\/tasks\/[^/]+\/assign$/, handler: handleRescheduleTask },
  { method: 'DELETE', pattern: /^\/tasks\/[^/]+\/assign$/, handler: handleUnassignTask },

  // Task completion
  { method: 'PUT', pattern: /^\/tasks\/[^/]+\/completion$/, handler: handleToggleCompletion },
];

// ============================================================================
// Utilities
// ============================================================================

/**
 * Extract a path parameter from URL using regex
 */
function extractPathParam(url: string, pattern: RegExp): string | null {
  const match = url.match(pattern);
  return match ? match[1] : null;
}

/**
 * Normalize request args to FetchArgs format
 */
function normalizeArgs(args: string | FetchArgs): FetchArgs {
  if (typeof args === 'string') {
    return { url: args, method: 'GET' };
  }
  return { ...args, method: args.method ?? 'GET' };
}

// ============================================================================
// Mock Base Query
// ============================================================================

/**
 * Mock base query that routes requests to mock handlers.
 *
 * This function matches the RTK Query BaseQueryFn signature and can be
 * used as a drop-in replacement for fetchBaseQuery in development/testing.
 */
export const mockBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args) => {
  const normalizedArgs = normalizeArgs(args);
  const { url, method } = normalizedArgs;

  // Find matching route
  const route = routes.find((r) => r.method === method && r.pattern.test(url));

  if (!route) {
    return {
      error: {
        status: 404,
        data: { error: 'NotFound', message: `No mock handler for ${method} ${url}` },
      },
    };
  }

  try {
    // Execute handler
    const result = await route.handler(normalizedArgs);
    return result;
  } catch (error) {
    return { error: normalizeError(error) };
  }
};

// ============================================================================
// Exports for testing
// ============================================================================

export const __testing__ = {
  routes,
  extractPathParam,
  normalizeArgs,
};

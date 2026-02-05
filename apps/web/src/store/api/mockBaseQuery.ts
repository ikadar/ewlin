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
  CreateJobRequest,
  Job,
  Element,
  Task,
  ReferenceLookupResponse,
  ScheduleConflict,
  ProposedAssignment,
} from '@flux/types';
import { validateAssignment } from '@flux/schedule-validator';
import { getSnapshot, updateSnapshot } from '../../mock/snapshot';
import { generateId, calculateEndTime, applyPushDown } from '../../utils';
import { normalizeError, createNotFoundError } from './errorNormalization';

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

  // Check for precedence conflicts when bypassPrecedence is true
  let newConflicts: ScheduleConflict[] = [];
  if (body.bypassPrecedence) {
    const proposedAssignment: ProposedAssignment = {
      taskId,
      targetId: body.targetId,
      isOutsourced: body.isOutsourced ?? false,
      scheduledStart: body.scheduledStart,
      bypassPrecedence: false, // Check without bypass to detect actual conflicts
    };
    const validationResult = validateAssignment(proposedAssignment, currentSnapshot);

    // Record any precedence conflicts
    newConflicts = validationResult.conflicts.filter(
      (c) => c.type === 'PrecedenceConflict'
    );

    if (newConflicts.length > 0) {
      console.log('[Mock] Recording precedence conflicts for bypass placement:', newConflicts);
    }
  }

  // Update snapshot
  updateSnapshot((snapshot) => ({
    ...snapshot,
    assignments: [...updatedAssignments, newAssignment],
    conflicts: [...snapshot.conflicts, ...newConflicts],
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

  // Check for precedence conflicts when bypassPrecedence is true
  let newConflicts: ScheduleConflict[] = [];
  if (body.bypassPrecedence) {
    // Create a temporary snapshot without this task's assignment for validation
    const tempSnapshot = {
      ...currentSnapshot,
      assignments: assignmentsWithoutCurrent,
    };
    const proposedAssignment: ProposedAssignment = {
      taskId,
      targetId: body.targetId,
      isOutsourced: body.isOutsourced ?? false,
      scheduledStart: body.scheduledStart,
      bypassPrecedence: false, // Check without bypass to detect actual conflicts
    };
    const validationResult = validateAssignment(proposedAssignment, tempSnapshot);

    // Record any precedence conflicts
    newConflicts = validationResult.conflicts.filter(
      (c) => c.type === 'PrecedenceConflict'
    );

    if (newConflicts.length > 0) {
      console.log('[Mock] Recording precedence conflicts for bypass reschedule:', newConflicts);
    }
  }

  // Remove old conflicts for this task before adding new ones
  const conflictsWithoutTask = currentSnapshot.conflicts.filter(
    (c) => c.taskId !== taskId
  );

  updateSnapshot((snapshot) => ({
    ...snapshot,
    assignments: [...updatedAssignments, updatedAssignment],
    conflicts: [...conflictsWithoutTask, ...newConflicts],
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
    // Also remove any conflicts for this task
    conflicts: snapshot.conflicts.filter((c) => c.taskId !== taskId),
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
// Job Creation Handler
// ============================================================================

/**
 * Response type for create job operation
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
 * Parsed task from sequence DSL
 */
interface ParsedTask {
  actionType: string;
  durationMinutes: number;
}

/**
 * Action type to station ID mapping
 */
const ACTION_TO_STATION: Record<string, string> = {
  // Offset printing
  offset: 'sta-komori-g40',
  'presse offset': 'sta-komori-g40',
  impression: 'sta-komori-g40',
  // Digital printing
  numérique: 'sta-xerox',
  'presse numérique': 'sta-xerox',
  digital: 'sta-xerox',
  // Cutting
  massicot: 'sta-polar-137',
  coupe: 'sta-polar-137',
  découpe: 'sta-polar-137',
  // Folding
  plieuse: 'sta-stahl',
  pliage: 'sta-stahl',
  // Binding/Finishing
  reliure: 'sta-muller',
  assemblage: 'sta-muller',
  conditionnement: 'sta-horizon',
  finition: 'sta-horizon',
};

/**
 * Job color palette (cycles through for new jobs)
 */
const JOB_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#EF4444', // red
  '#06B6D4', // cyan
  '#84CC16', // lime
];

/**
 * Parse sequence DSL into individual tasks.
 *
 * Format: "[Action] duration | [Action2] duration2"
 * Example: "[Offset] 30 | [Massicot] 15" → [{actionType: "offset", duration: 30}, ...]
 *
 * @param sequence - The sequence DSL string
 * @returns Array of parsed tasks
 */
function parseSequenceDsl(sequence: string): ParsedTask[] {
  if (!sequence || sequence.trim() === '') {
    return [];
  }

  const tasks: ParsedTask[] = [];
  const parts = sequence.split('|').map((p) => p.trim()).filter((p) => p.length > 0);

  for (const part of parts) {
    // Match pattern: [ActionType] duration
    const match = part.match(/\[([^\]]+)\]\s*(\d+)/);
    if (match) {
      const actionType = match[1].toLowerCase().trim();
      const durationMinutes = parseInt(match[2], 10);
      tasks.push({ actionType, durationMinutes });
    }
  }

  return tasks;
}

/**
 * Get station ID for an action type
 */
function getStationForAction(actionType: string): string {
  const normalizedAction = actionType.toLowerCase().trim();

  // Direct match
  if (ACTION_TO_STATION[normalizedAction]) {
    return ACTION_TO_STATION[normalizedAction];
  }

  // Partial match
  for (const [key, stationId] of Object.entries(ACTION_TO_STATION)) {
    if (normalizedAction.includes(key) || key.includes(normalizedAction)) {
      return stationId;
    }
  }

  // Default to first offset press
  return 'sta-komori-g40';
}

/**
 * POST /jobs - Create job (mock implementation)
 *
 * Creates a new job with elements and tasks in the mock snapshot.
 * Parses the sequence DSL to create internal tasks.
 *
 * @see docs/releases/v0.5.4-job-creation-via-api.md
 */
const handleCreateJob = async (
  args: FetchArgs
): Promise<{ data: CreateJobResponse } | { error: FetchBaseQueryError }> => {
  const body = args.body as CreateJobRequest;
  const now = new Date().toISOString();
  const currentSnapshot = getSnapshot();

  // Generate unique job ID
  const existingJobCount = currentSnapshot.jobs.length;
  const jobId = `job-api-${Date.now()}-${existingJobCount}`;

  // Pick a color for the new job (cycle through colors)
  const colorIndex = existingJobCount % JOB_COLORS.length;
  const jobColor = JOB_COLORS[colorIndex];

  // Process elements and create tasks
  const newElements: Element[] = [];
  const newTasks: Task[] = [];
  const elementIds: string[] = [];
  const allTaskIds: string[] = [];

  // Map element names to IDs for prerequisite resolution
  const elementNameToId: Record<string, string> = {};

  // First pass: create elements and their tasks
  const elements = body.elements || [];
  for (let elementIndex = 0; elementIndex < elements.length; elementIndex++) {
    const elementInput = elements[elementIndex];
    const elementId = `elem-${jobId}-${elementIndex}`;
    elementIds.push(elementId);
    elementNameToId[elementInput.name] = elementId;

    // Parse sequence DSL to create tasks
    const parsedTasks = parseSequenceDsl(elementInput.sequence || '');
    const taskIds: string[] = [];

    for (let taskIndex = 0; taskIndex < parsedTasks.length; taskIndex++) {
      const parsedTask = parsedTasks[taskIndex];
      const taskId = `task-${jobId}-${elementIndex}-${taskIndex}`;
      taskIds.push(taskId);
      allTaskIds.push(taskId);

      const stationId = getStationForAction(parsedTask.actionType);

      // Calculate setup and run times (roughly 20% setup, 80% run)
      const setupMinutes = Math.max(15, Math.round(parsedTask.durationMinutes * 0.2));
      const runMinutes = parsedTask.durationMinutes - setupMinutes;

      const task: InternalTask = {
        id: taskId,
        elementId,
        sequenceOrder: taskIndex,
        status: 'Ready',
        type: 'Internal',
        stationId,
        duration: {
          setupMinutes,
          runMinutes,
        },
        createdAt: now,
        updatedAt: now,
      };

      newTasks.push(task);
    }

    // Create element
    const element: Element = {
      id: elementId,
      jobId,
      name: elementInput.name,
      label: elementInput.label,
      prerequisiteElementIds: [], // Will be resolved in second pass
      taskIds,
      paperStatus: 'in_stock',
      batStatus: 'bat_approved',
      plateStatus: 'ready',
    };

    newElements.push(element);
  }

  // Second pass: resolve prerequisite element names to IDs
  for (let i = 0; i < elements.length; i++) {
    const elementInput = elements[i];
    if (elementInput.prerequisiteNames && elementInput.prerequisiteNames.length > 0) {
      newElements[i].prerequisiteElementIds = elementInput.prerequisiteNames
        .map((name) => elementNameToId[name])
        .filter((id) => id !== undefined);
    }
  }

  // Create job
  const job: Job = {
    id: jobId,
    reference: body.reference,
    client: body.client,
    description: body.description,
    status: 'Draft',
    workshopExitDate: body.workshopExitDate,
    fullyScheduled: false,
    color: jobColor,
    comments: [],
    elementIds,
    taskIds: allTaskIds,
    createdAt: now,
    updatedAt: now,
  };

  // Update snapshot
  updateSnapshot((snapshot) => ({
    ...snapshot,
    jobs: [...snapshot.jobs, job],
    elements: [...snapshot.elements, ...newElements],
    tasks: [...snapshot.tasks, ...newTasks],
  }));

  // Return response
  const response: CreateJobResponse = {
    id: jobId,
    reference: body.reference,
    client: body.client,
    description: body.description,
    workshopExitDate: body.workshopExitDate,
    status: 'Draft',
    elementIds,
    taskIds: allTaskIds,
    createdAt: now,
  };

  return { data: response };
};

// ============================================================================
// Route Configuration
// ============================================================================

// ============================================================================
// Client Suggestions Handler
// ============================================================================

/**
 * Mock client names for suggestions
 */
const MOCK_CLIENT_NAMES = [
  'Imprimerie Léon',
  'Éditions Gallimard',
  'Hachette Livre',
  'Publicis France',
  'La Poste',
  'SNCF Communication',
  'Air France Corporate',
  'Carrefour Marketing',
];

/**
 * GET /jobs/clients?q={prefix} - Get client suggestions
 *
 * Filters mock clients by prefix (case-insensitive).
 * Returns all clients if prefix is empty.
 *
 * @see docs/releases/v0.5.5-client-autocomplete-api.md
 */
const handleGetClientSuggestions = async (
  args: FetchArgs
): Promise<{ data: string[] }> => {
  // Extract query parameter from URL
  const url = new URL(args.url, 'http://localhost');
  const prefix = url.searchParams.get('q') || '';
  const normalizedPrefix = prefix.toLowerCase().trim();

  // Filter clients by prefix
  const suggestions = normalizedPrefix
    ? MOCK_CLIENT_NAMES.filter((name) =>
        name.toLowerCase().includes(normalizedPrefix)
      )
    : MOCK_CLIENT_NAMES;

  return { data: suggestions };
};

/**
 * GET /jobs/lookup-by-reference?ref={reference} - Lookup job by reference
 *
 * Searches existing jobs for matching reference (case-insensitive).
 * Returns client name if found, null otherwise.
 *
 * @see docs/releases/v0.5.6-reference-lookup-api.md
 */
const handleLookupByReference = async (
  args: FetchArgs
): Promise<{ data: ReferenceLookupResponse }> => {
  // Extract query parameter from URL
  const url = new URL(args.url, 'http://localhost');
  const reference = url.searchParams.get('ref') || '';
  const normalizedRef = reference.toLowerCase().trim();

  if (!normalizedRef) {
    return { data: { client: null } };
  }

  // Search existing jobs
  const currentSnapshot = getSnapshot();
  const matchingJob = currentSnapshot.jobs.find(
    (job) => job.reference.toLowerCase() === normalizedRef
  );

  return {
    data: {
      client: matchingJob?.client ?? null,
    },
  };
};

const routes: MockRoute[] = [
  // Schedule
  { method: 'GET', pattern: /^\/schedule\/snapshot$/, handler: handleGetSnapshot },

  // Jobs
  { method: 'GET', pattern: /^\/jobs\/clients/, handler: handleGetClientSuggestions },
  { method: 'GET', pattern: /^\/jobs\/lookup-by-reference/, handler: handleLookupByReference },
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

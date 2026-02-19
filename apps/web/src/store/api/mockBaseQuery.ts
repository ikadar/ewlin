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
  CompactStationResponse,
  InternalTask,
  OutsourcedTask,
  OutsourcedProvider,
  Station,
  TaskAssignment,
  CreateJobRequest,
  UpdateJobRequest,
  Job,
  Element,
  ElementSpec,
  Task,
  ReferenceLookupResponse,
} from '@flux/types';
import { DRY_TIME_MS } from '@flux/types';
import { getSnapshot, updateSnapshot } from '../../mock/snapshot';
import { generateId, calculateEndTime, applyPushDown } from '../../utils';
import { calculateOutsourcingDates } from '../../utils/outsourcingCalculation';
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
// Auto-assign outsourced successor tasks
// ============================================================================

/**
 * After assigning an internal task, check if any outsourced tasks in successor
 * elements can now be auto-assigned (all their predecessor elements' last tasks
 * are scheduled).
 *
 * Returns new TaskAssignment[] to add to the snapshot.
 */
function autoAssignOutsourcedSuccessors(
  snapshot: ScheduleSnapshot,
  assignedTaskId: string,
  currentAssignments: TaskAssignment[],
): { newAssignments: TaskAssignment[]; updatedAssignments: TaskAssignment[] } {
  const elements = snapshot.elements ?? [];
  const providers = snapshot.providers ?? [];
  if (elements.length === 0 || providers.length === 0) {
    return { newAssignments: [], updatedAssignments: [] };
  }

  const assignmentByTaskId = new Map(currentAssignments.map((a) => [a.taskId, a]));
  const taskById = new Map(snapshot.tasks.map((t) => [t.id, t]));

  // Find the element containing the assigned task
  const assignedTask = taskById.get(assignedTaskId);
  if (!assignedTask) return { newAssignments: [], updatedAssignments: [] };

  const assignedElement = elements.find((e) => e.id === assignedTask.elementId);
  if (!assignedElement) return { newAssignments: [], updatedAssignments: [] };

  // Find elements that list assignedElement as a prerequisite
  const dependentElements = elements.filter((e) =>
    e.prerequisiteElementIds.includes(assignedElement.id)
  );

  const newAssignments: TaskAssignment[] = [];
  const updatedAssignments: TaskAssignment[] = [];

  for (const depElem of dependentElements) {
    // Find outsourced tasks in this element
    const outsourcedTasks = depElem.taskIds
      .map((id) => taskById.get(id))
      .filter((t): t is OutsourcedTask => t !== undefined && t.type === 'Outsourced');

    if (outsourcedTasks.length === 0) continue;

    // Find the latest scheduled predecessor end time (ALL must be scheduled)
    let latestPredecessorEnd: string | undefined;
    let allScheduled = true;

    for (const prereqId of depElem.prerequisiteElementIds) {
      const prereqElem = elements.find((e) => e.id === prereqId);
      if (!prereqElem) { allScheduled = false; break; }

      // Get last task by sequenceOrder
      const prereqTasks = prereqElem.taskIds
        .map((id) => taskById.get(id))
        .filter((t): t is Task => t !== undefined)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      const lastTask = prereqTasks[prereqTasks.length - 1];
      if (!lastTask) { allScheduled = false; break; }

      const lastAssignment = assignmentByTaskId.get(lastTask.id);
      if (!lastAssignment) { allScheduled = false; break; }

      if (!latestPredecessorEnd || lastAssignment.scheduledEnd > latestPredecessorEnd) {
        latestPredecessorEnd = lastAssignment.scheduledEnd;
      }
    }

    if (!allScheduled || !latestPredecessorEnd) continue;

    // Auto-assign or update each outsourced task
    for (const outTask of outsourcedTasks) {
      const provider = providers.find((p) => p.id === outTask.providerId);
      if (!provider) continue;

      const dates = calculateOutsourcingDates(latestPredecessorEnd, {
        workDays: outTask.duration.openDays,
        latestDepartureTime: outTask.duration.latestDepartureTime,
        receptionTime: outTask.duration.receptionTime,
        transitDays: provider.transitDays,
      });
      if (!dates) continue;

      const existingAssignment = assignmentByTaskId.get(outTask.id);

      if (existingAssignment) {
        // Update if the new dates are later (more constraining)
        const newEnd = dates.return.toISOString();
        if (newEnd > existingAssignment.scheduledEnd) {
          const updated: TaskAssignment = {
            ...existingAssignment,
            scheduledStart: dates.departure.toISOString(),
            scheduledEnd: newEnd,
            updatedAt: new Date().toISOString(),
          };
          updatedAssignments.push(updated);
          assignmentByTaskId.set(outTask.id, updated);
        }
      } else {
        // Create new assignment
        const outAssignment: TaskAssignment = {
          id: generateId(),
          taskId: outTask.id,
          targetId: provider.id,
          isOutsourced: true,
          scheduledStart: dates.departure.toISOString(),
          scheduledEnd: dates.return.toISOString(),
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        newAssignments.push(outAssignment);
        assignmentByTaskId.set(outTask.id, outAssignment);
      }
    }
  }

  return { newAssignments, updatedAssignments };
}

/**
 * Find auto-assigned outsourced task IDs that should be removed when a
 * predecessor task is unassigned. An outsourced task's assignment is removed
 * if it no longer has ANY scheduled predecessor element last-tasks.
 */
function getOutsourcedTasksToRemoveOnUnassign(
  snapshot: ScheduleSnapshot,
  unassignedTaskId: string,
  remainingAssignments: TaskAssignment[],
): string[] {
  const elements = snapshot.elements ?? [];
  if (elements.length === 0) return [];

  const assignmentByTaskId = new Map(remainingAssignments.map((a) => [a.taskId, a]));
  const taskById = new Map(snapshot.tasks.map((t) => [t.id, t]));

  const unassignedTask = taskById.get(unassignedTaskId);
  if (!unassignedTask) return [];

  const unassignedElement = elements.find((e) => e.id === unassignedTask.elementId);
  if (!unassignedElement) return [];

  // Find elements that depend on the unassigned task's element
  const dependentElements = elements.filter((e) =>
    e.prerequisiteElementIds.includes(unassignedElement.id)
  );

  const toRemove: string[] = [];

  for (const depElem of dependentElements) {
    const outsourcedTasks = depElem.taskIds
      .map((id) => taskById.get(id))
      .filter((t): t is OutsourcedTask => t !== undefined && t.type === 'Outsourced')
      .filter((t) => assignmentByTaskId.has(t.id));

    for (const outTask of outsourcedTasks) {
      // Check if ALL prerequisite elements' last tasks are still scheduled
      // (symmetric with auto-assign which requires ALL to be scheduled)
      let allPrereqsScheduled = true;
      for (const prereqId of depElem.prerequisiteElementIds) {
        const prereqElem = elements.find((e) => e.id === prereqId);
        if (!prereqElem) { allPrereqsScheduled = false; break; }
        const prereqTasks = prereqElem.taskIds
          .map((id) => taskById.get(id))
          .filter((t): t is Task => t !== undefined)
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        const lastTask = prereqTasks[prereqTasks.length - 1];
        if (!lastTask || !assignmentByTaskId.has(lastTask.id)) {
          allPrereqsScheduled = false;
          break;
        }
      }
      if (!allPrereqsScheduled) {
        toRemove.push(outTask.id);
      }
    }
  }

  return toRemove;
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

  // Auto-assign or update outsourced successor tasks based on scheduled predecessors
  const allAssignments = [...updatedAssignments, newAssignment];
  const { newAssignments: outsourcedNew, updatedAssignments: outsourcedUpdated } =
    autoAssignOutsourcedSuccessors(currentSnapshot, taskId, allAssignments);

  // Apply outsourced updates to existing assignments
  const updatedIds = new Set(outsourcedUpdated.map((a) => a.taskId));
  const finalAssignments = allAssignments
    .map((a) => {
      const updated = outsourcedUpdated.find((u) => u.taskId === a.taskId);
      return updated ?? a;
    })
    .concat(outsourcedNew);

  // Update snapshot (conflicts are automatically recalculated by updateSnapshot)
  updateSnapshot((snapshot) => ({
    ...snapshot,
    assignments: finalAssignments,
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

  // Auto-assign or update outsourced successor tasks based on rescheduled position
  const allAssignments = [...updatedAssignments, updatedAssignment];
  const { newAssignments: outsourcedNew, updatedAssignments: outsourcedUpdated } =
    autoAssignOutsourcedSuccessors(currentSnapshot, taskId, allAssignments);

  // Apply outsourced updates to existing assignments
  const finalAssignments = allAssignments
    .map((a) => {
      const updated = outsourcedUpdated.find((u) => u.taskId === a.taskId);
      return updated ?? a;
    })
    .concat(outsourcedNew);

  // Update snapshot (conflicts are automatically recalculated by updateSnapshot)
  updateSnapshot((snapshot) => ({
    ...snapshot,
    assignments: finalAssignments,
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

  // Check which assignments remain after removing this one
  const remainingAssignments = currentSnapshot.assignments.filter((a) => a.taskId !== taskId);

  // Find auto-assigned outsourced tasks that should be removed
  const outsourcedToRemove = new Set(
    getOutsourcedTasksToRemoveOnUnassign(currentSnapshot, taskId, remainingAssignments)
  );

  // Update snapshot (conflicts are automatically recalculated by updateSnapshot)
  updateSnapshot((snapshot) => ({
    ...snapshot,
    assignments: remainingAssignments.filter((a) => !outsourcedToRemove.has(a.taskId)),
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
  setupMinutes?: number;
  runMinutes?: number;
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
 * Supports two formats:
 * - JCF format: "PosteName(setup+run)" or "PosteName(total)" (one per line)
 * - Legacy bracket format: "[ActionType] duration | [Action2] duration2"
 *
 * @param sequence - The sequence DSL string
 * @returns Array of parsed tasks
 */
function parseSequenceDsl(sequence: string): ParsedTask[] {
  if (!sequence || sequence.trim() === '') {
    return [];
  }

  const tasks: ParsedTask[] = [];
  const lines = sequence.split(/[\n|]/).map((p) => p.trim()).filter((p) => p.length > 0);

  for (const line of lines) {
    // JCF format: PosteName(setup+run) or PosteName(total)
    const jcfMatch = line.match(/^(\w+)\((\d+)(?:\+(\d+))?\)$/);
    if (jcfMatch) {
      const setupMinutes = parseInt(jcfMatch[2], 10);
      const runMinutes = jcfMatch[3] ? parseInt(jcfMatch[3], 10) : 0;
      tasks.push({
        actionType: jcfMatch[1],
        durationMinutes: setupMinutes + runMinutes,
        setupMinutes,
        runMinutes,
      });
      continue;
    }

    // Legacy bracket format: [ActionType] duration
    const bracketMatch = line.match(/\[([^\]]+)\]\s*(\d+)/);
    if (bracketMatch) {
      tasks.push({
        actionType: bracketMatch[1].toLowerCase().trim(),
        durationMinutes: parseInt(bracketMatch[2], 10),
      });
    }
  }

  return tasks;
}

/**
 * Get station ID for an action type.
 * Dynamically looks up station by name from snapshot first,
 * then falls back to ACTION_TO_STATION mapping.
 */
function getStationForAction(actionType: string, snapshot?: ScheduleSnapshot): string {
  const normalized = actionType.toLowerCase().replace(/\s+/g, '');

  // Dynamic lookup: match station name (spaces removed) from snapshot
  if (snapshot) {
    const station = snapshot.stations.find(
      s => s.name.toLowerCase().replace(/\s+/g, '') === normalized
    );
    if (station) return station.id;
  }

  // Fallback to static mapping
  const normalizedAction = actionType.toLowerCase().trim();
  if (ACTION_TO_STATION[normalizedAction]) {
    return ACTION_TO_STATION[normalizedAction];
  }

  // Partial match in static mapping
  for (const [key, stationId] of Object.entries(ACTION_TO_STATION)) {
    if (normalizedAction.includes(key) || key.includes(normalizedAction)) {
      return stationId;
    }
  }

  // Final fallback: first station in snapshot or hardcoded default
  return snapshot?.stations[0]?.id ?? 'sta-komori-g40';
}

/** Build ElementSpec from JcfElementInput request fields + parsed label. */
function buildSpecFromInput(input: { label?: string; quantite?: number; imposition?: string; impression?: string; surfacage?: string; autres?: string; qteFeuilles?: number; commentaires?: string }): ElementSpec | undefined {
  // Parse label → format, pagination, papier
  const labelParts = input.label ? input.label.split(' | ') : [];
  const format = labelParts[0] || undefined;
  const paginationStr = labelParts[1];
  const pagination = paginationStr ? parseInt(paginationStr, 10) : undefined;
  const papier = labelParts[2] || undefined;

  const spec: ElementSpec = {
    ...(format && { format }),
    ...(papier && { papier }),
    ...(pagination && !isNaN(pagination) && { pagination }),
    ...(input.imposition && { imposition: input.imposition }),
    ...(input.impression && { impression: input.impression }),
    ...(input.surfacage && { surfacage: input.surfacage }),
    ...(input.quantite !== undefined && { quantite: input.quantite }),
    ...(input.qteFeuilles !== undefined && { qteFeuilles: input.qteFeuilles }),
    ...(input.autres && { autres: input.autres }),
    ...(input.commentaires && { commentaires: input.commentaires }),
  };

  return Object.keys(spec).length > 0 ? spec : undefined;
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

      const stationId = getStationForAction(parsedTask.actionType, currentSnapshot);

      // Use explicit setup/run if provided (JCF format), otherwise estimate (20%/80%)
      const setupMinutes = parsedTask.setupMinutes ?? Math.max(15, Math.round(parsedTask.durationMinutes * 0.2));
      const runMinutes = parsedTask.runMinutes ?? (parsedTask.durationMinutes - setupMinutes);

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
    const spec = buildSpecFromInput(elementInput);
    const element: Element = {
      id: elementId,
      jobId,
      name: elementInput.name,
      label: elementInput.label,
      prerequisiteElementIds: [], // Will be resolved in second pass
      taskIds,
      ...(spec && { spec }),
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
    ...(body.quantity !== undefined && { quantity: body.quantity }),
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
// Job Update Handler
// ============================================================================

/**
 * Response type for update job operation
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
 * PUT /jobs/:jobId - Update job (mock implementation)
 *
 * Updates an existing job's metadata fields and optionally replaces
 * elements/tasks when `elements` array is provided in the body.
 *
 * @see docs/releases/v0.5.13b-job-edit-via-jcf-modal.md
 */
const handleUpdateJob = async (
  args: FetchArgs
): Promise<{ data: UpdateJobResponse } | { error: FetchBaseQueryError }> => {
  const jobId = extractPathParam(args.url, /\/jobs\/([^/]+)$/);
  if (!jobId) {
    return { error: createNotFoundError('Invalid job ID') };
  }

  const body = args.body as UpdateJobRequest;
  const currentSnapshot = getSnapshot();

  const jobIndex = currentSnapshot.jobs.findIndex((j) => j.id === jobId);
  if (jobIndex === -1) {
    return { error: createNotFoundError('Job not found') };
  }

  const existingJob = currentSnapshot.jobs[jobIndex];
  const now = new Date().toISOString();

  // If elements provided, rebuild elements and tasks
  let newElementIds = existingJob.elementIds;
  let newTaskIds = existingJob.taskIds;
  const newElements: Element[] = [];
  const newTasks: Task[] = [];

  if (body.elements && body.elements.length > 0) {
    const elementNameToId: Record<string, string> = {};
    newElementIds = [];
    newTaskIds = [];

    // First pass: create elements and tasks
    for (let i = 0; i < body.elements.length; i++) {
      const elementInput = body.elements[i];
      const elementId = `elem-${jobId}-upd-${i}`;
      newElementIds.push(elementId);
      elementNameToId[elementInput.name] = elementId;

      const parsedTasks = parseSequenceDsl(elementInput.sequence || '');
      const taskIds: string[] = [];

      for (let j = 0; j < parsedTasks.length; j++) {
        const parsed = parsedTasks[j];
        const taskId = `task-${jobId}-upd-${i}-${j}`;
        taskIds.push(taskId);
        newTaskIds.push(taskId);

        const stationId = getStationForAction(parsed.actionType, currentSnapshot);
        const setupMinutes = parsed.setupMinutes ?? Math.max(15, Math.round(parsed.durationMinutes * 0.2));
        const runMinutes = parsed.runMinutes ?? (parsed.durationMinutes - setupMinutes);

        newTasks.push({
          id: taskId,
          elementId,
          sequenceOrder: j,
          status: 'Ready',
          type: 'Internal',
          stationId,
          duration: { setupMinutes, runMinutes },
          createdAt: now,
          updatedAt: now,
        } as InternalTask);
      }

      const spec = buildSpecFromInput(elementInput);
      newElements.push({
        id: elementId,
        jobId,
        name: elementInput.name,
        label: elementInput.label,
        prerequisiteElementIds: [],
        taskIds,
        ...(spec && { spec }),
        paperStatus: 'in_stock',
        batStatus: 'bat_approved',
        plateStatus: 'ready',
      });
    }

    // Second pass: resolve prerequisite names to IDs
    for (let i = 0; i < body.elements.length; i++) {
      const prereqNames = body.elements[i].prerequisiteNames;
      if (prereqNames && prereqNames.length > 0) {
        newElements[i].prerequisiteElementIds = prereqNames
          .map((name) => elementNameToId[name])
          .filter((id) => id !== undefined);
      }
    }
  }

  // Merge metadata (only provided fields)
  const updatedJob: Job = {
    ...existingJob,
    ...(body.reference !== undefined && { reference: body.reference }),
    ...(body.client !== undefined && { client: body.client }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.workshopExitDate !== undefined && { workshopExitDate: body.workshopExitDate }),
    ...(body.quantity !== undefined && { quantity: body.quantity }),
    elementIds: newElementIds,
    taskIds: newTaskIds,
    updatedAt: now,
  };

  // Update snapshot
  updateSnapshot((snapshot) => {
    const newJobs = [...snapshot.jobs];
    newJobs[jobIndex] = updatedJob;

    if (body.elements && body.elements.length > 0) {
      // Remove old elements and tasks for this job, add new ones
      const oldElementIds = new Set(existingJob.elementIds);
      const oldTaskIds = new Set(existingJob.taskIds);

      // Also remove assignments for deleted tasks
      const filteredAssignments = snapshot.assignments.filter(
        (a) => !oldTaskIds.has(a.taskId)
      );

      return {
        ...snapshot,
        jobs: newJobs,
        elements: [
          ...snapshot.elements.filter((e) => !oldElementIds.has(e.id)),
          ...newElements,
        ],
        tasks: [
          ...snapshot.tasks.filter((t) => !oldTaskIds.has(t.id)),
          ...newTasks,
        ],
        assignments: filteredAssignments,
      };
    }

    return { ...snapshot, jobs: newJobs };
  });

  const response: UpdateJobResponse = {
    id: updatedJob.id,
    reference: updatedJob.reference,
    client: updatedJob.client,
    description: updatedJob.description,
    workshopExitDate: updatedJob.workshopExitDate,
    status: updatedJob.status,
    updatedAt: now,
  };

  return { data: response };
};

// ============================================================================
// Delete Job Handler
// ============================================================================

/**
 * DELETE /jobs/:jobId - Delete a job and all related data
 */
const handleDeleteJob = async (
  args: FetchArgs
): Promise<{ data: Record<string, never> } | { error: FetchBaseQueryError }> => {
  const jobId = extractPathParam(args.url, /\/jobs\/([^/]+)$/);
  if (!jobId) {
    return { error: createNotFoundError('Invalid job ID') };
  }

  const currentSnapshot = getSnapshot();
  const job = currentSnapshot.jobs.find((j) => j.id === jobId);
  if (!job) {
    return { error: createNotFoundError('Job not found') };
  }

  const jobElementIds = new Set(job.elementIds);
  const jobTaskIds = new Set(job.taskIds);

  updateSnapshot((snapshot) => ({
    ...snapshot,
    jobs: snapshot.jobs.filter((j) => j.id !== jobId),
    elements: snapshot.elements.filter((e) => !jobElementIds.has(e.id)),
    tasks: snapshot.tasks.filter((t) => !jobTaskIds.has(t.id)),
    assignments: snapshot.assignments.filter((a) => !jobTaskIds.has(a.taskId)),
  }));

  return { data: {} };
};

// ============================================================================
// Station Compact Handler
// ============================================================================

/**
 * POST /stations/:stationId/compact - Compact station assignments
 *
 * Removes gaps between tiles on a station by moving them as early as possible.
 * For each tile (earliest to latest), earliestStart = max(previousTileEnd,
 * predecessorEnd + optional drying time). First tile with no predecessor stays
 * in place. Respects precedence rules and drying time after offset printing.
 *
 * @see services/php-api/src/Service/CompactStationService.php
 */
const handleCompactStation = async (
  args: FetchArgs
): Promise<{ data: CompactStationResponse } | { error: FetchBaseQueryError }> => {
  const stationId = extractPathParam(args.url, /\/stations\/([^/]+)\/compact/);
  if (!stationId) {
    return { error: createNotFoundError('Invalid station ID') };
  }

  const currentSnapshot = getSnapshot();
  const station = currentSnapshot.stations.find((s) => s.id === stationId);
  if (!station) {
    return { error: createNotFoundError('Station not found') };
  }

  // Get assignments for this station, sorted by start time
  const stationAssignments = currentSnapshot.assignments
    .filter((a) => a.targetId === stationId && !a.isOutsourced)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  if (stationAssignments.length === 0) {
    return { data: { compactedCount: 0, assignments: [] } };
  }

  const taskMap = new Map(currentSnapshot.tasks.map((t) => [t.id, t]));
  const updatedEndTimes = new Map<string, Date>();
  let compactedCount = 0;
  let previousEndTime: Date | null = null;
  const updatedAssignmentsMap = new Map<string, { scheduledStart: string; scheduledEnd: string }>();

  for (const assignment of stationAssignments) {
    const task = taskMap.get(assignment.taskId);

    // Calculate earliest valid start: max(previousTileEnd, predecessorEnd+dryTime)
    let earliestStart: Date | null = null;

    // Station constraint: previous tile on same station
    if (previousEndTime !== null) {
      earliestStart = previousEndTime;
    }

    // Precedence constraint: predecessor's end time (+ drying time if offset station)
    if (task) {
      const predecessorEnd = getCompactPredecessorEnd(task, currentSnapshot, updatedEndTimes);
      if (predecessorEnd && (!earliestStart || predecessorEnd > earliestStart)) {
        earliestStart = predecessorEnd;
      }
    }

    // If no constraints (first tile with no predecessor), keep current position
    if (earliestStart === null) {
      earliestStart = new Date(assignment.scheduledStart);
    }

    // Calculate new end time
    const newEnd = task?.type === 'Internal'
      ? calculateEndTime(task as InternalTask, earliestStart.toISOString(), station)
      : new Date(earliestStart.getTime() + (new Date(assignment.scheduledEnd).getTime() - new Date(assignment.scheduledStart).getTime())).toISOString();

    // Check if position actually changed
    if (earliestStart.getTime() !== new Date(assignment.scheduledStart).getTime()) {
      updatedAssignmentsMap.set(assignment.id, {
        scheduledStart: earliestStart.toISOString(),
        scheduledEnd: newEnd,
      });
      compactedCount++;
    }

    updatedEndTimes.set(assignment.taskId, new Date(newEnd));
    previousEndTime = new Date(newEnd);
  }

  // Apply updates to snapshot
  if (compactedCount > 0) {
    updateSnapshot((snapshot) => ({
      ...snapshot,
      assignments: snapshot.assignments.map((assignment) => {
        const updated = updatedAssignmentsMap.get(assignment.id);
        return updated
          ? { ...assignment, scheduledStart: updated.scheduledStart, scheduledEnd: updated.scheduledEnd, updatedAt: new Date().toISOString() }
          : assignment;
      }),
    }));
  }

  // Build response
  const responseAssignments: AssignmentResponse[] = stationAssignments.map((a) => {
    const updated = updatedAssignmentsMap.get(a.id);
    return {
      taskId: a.taskId,
      targetId: a.targetId,
      isOutsourced: a.isOutsourced,
      scheduledStart: updated?.scheduledStart ?? a.scheduledStart,
      scheduledEnd: updated?.scheduledEnd ?? a.scheduledEnd,
      isCompleted: a.isCompleted,
      completedAt: a.completedAt,
    };
  });

  return {
    data: {
      compactedCount,
      assignments: responseAssignments,
    },
  };
};

/**
 * Get the predecessor's effective end time for compaction.
 *
 * Returns the predecessor's scheduledEnd (or updated end if already compacted),
 * plus DRY_TIME_MS if the predecessor is at a printing (offset) station.
 */
function getCompactPredecessorEnd(
  task: Task,
  snapshot: ScheduleSnapshot,
  updatedEndTimes: Map<string, Date>,
): Date | null {
  const elementTasks = snapshot.tasks
    .filter((t) => t.elementId === task.elementId)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const taskIndex = elementTasks.findIndex((t) => t.id === task.id);

  if (taskIndex <= 0) return null;

  const predecessorTask = elementTasks[taskIndex - 1];
  const predecessorAssignment = snapshot.assignments.find((a) => a.taskId === predecessorTask.id);
  if (!predecessorAssignment) return null;

  // Use updated end time if predecessor was already compacted in this pass
  const predecessorEnd = updatedEndTimes.get(predecessorTask.id)
    ?? new Date(predecessorAssignment.scheduledEnd);

  // Add drying time if predecessor is at a printing (offset) station
  const predStation = snapshot.stations.find((s) => s.id === predecessorAssignment.targetId);
  const category = snapshot.categories.find((c) => c.id === predStation?.categoryId);
  if (category?.name.toLowerCase().includes('offset')) {
    return new Date(predecessorEnd.getTime() + DRY_TIME_MS);
  }

  return predecessorEnd;
}

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
 * Mock client store for persistent client management.
 * Starts with MOCK_CLIENT_NAMES and grows as new clients are created.
 */
let mockClientStore: string[] = [...MOCK_CLIENT_NAMES];

/**
 * GET /clients?q={prefix} - Get client suggestions
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
  const prefix = url.searchParams.get('q');

  // If no q param, return full client list (for management page)
  if (prefix === null) {
    return {
      data: mockClientStore.map((name) => ({
        id: `client-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })) as unknown as string[],
    };
  }

  const normalizedPrefix = prefix.toLowerCase().trim();

  // Filter clients by prefix
  const suggestions = normalizedPrefix
    ? mockClientStore.filter((name) =>
        name.toLowerCase().includes(normalizedPrefix)
      )
    : mockClientStore;

  return { data: suggestions };
};

/**
 * POST /clients - Create a new client
 */
const handleCreateClient = async (
  args: FetchArgs
): Promise<{ data: { id: string; name: string; createdAt: string; updatedAt: string } } | { error: FetchBaseQueryError }> => {
  const body = args.body as { name: string };
  const name = body.name?.trim();

  if (!name) {
    return {
      error: {
        status: 400,
        data: { error: 'ValidationError', message: 'Client name is required' },
      },
    };
  }

  // Check for duplicate
  const exists = mockClientStore.some(
    (n) => n.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Client '${name}' already exists` },
      },
    };
  }

  mockClientStore.push(name);
  mockClientStore.sort();

  const now = new Date().toISOString();
  return {
    data: {
      id: `client-${Date.now()}`,
      name,
      createdAt: now,
      updatedAt: now,
    },
  };
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

  // Clients
  { method: 'GET', pattern: /^\/clients/, handler: handleGetClientSuggestions },
  { method: 'POST', pattern: /^\/clients$/, handler: handleCreateClient },

  // Jobs
  { method: 'GET', pattern: /^\/jobs\/clients/, handler: handleGetClientSuggestions },
  { method: 'GET', pattern: /^\/jobs\/lookup-by-reference/, handler: handleLookupByReference },
  { method: 'POST', pattern: /^\/jobs$/, handler: handleCreateJob },
  { method: 'PUT', pattern: /^\/jobs\/[^/]+$/, handler: handleUpdateJob },
  { method: 'DELETE', pattern: /^\/jobs\/[^/]+$/, handler: handleDeleteJob },

  // Station operations
  { method: 'POST', pattern: /^\/stations\/[^/]+\/compact$/, handler: handleCompactStation },

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

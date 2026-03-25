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
import { PRODUCT_FORMATS, IMPRESSION_PRESETS, SURFACAGE_PRESETS, FEUILLE_FORMATS } from '../../mock/reference-data';
import type { FormatResponse } from './formatApi';
import type { ImpressionPresetResponse } from './impressionPresetApi';
import type { SurfacagePresetResponse } from './surfacagePresetApi';
import type { FeuilleFormatResponse } from './feuilleFormatApi';
import type { StationResponse } from './stationApi';
import type {
  ScheduleSnapshot,
  AssignTaskRequest,
  AssignmentResponse,
  CompletionResponse,
  UnassignmentResponse,
  InternalTask,
  OutsourcedTask,
  Station,
  TaskAssignment,
  CreateJobRequest,
  UpdateJobRequest,
  Job,
  Element,
  ElementSpec,
  Task,
  ReferenceLookupResponse,
  JcfTemplateCreateInput,
  JcfTemplateUpdateInput,
} from '@flux/types';
import { getSnapshot, updateSnapshot } from '../../mock/snapshot';
import { FLUX_STATIC_JOBS } from '../../mock/fluxStaticData';
import { getTemplates as mockGetTemplates, createTemplate as mockCreateTemplate, updateTemplate as mockUpdateTemplate, deleteTemplate as mockDeleteTemplate } from '../../mock/templateApi';
import { generateId, calculateEndTime, applyPushDown } from '../../utils';
import { applySplitToSnapshot, applyFuseToSnapshot } from '../../utils/splitFuse';
import { calculateOutsourcingDates } from '../../utils/outsourcingCalculation';
import { isLastTaskOfJob, compareTaskOrder } from '../../utils/taskHelpers';
import { computeAsapPlacements } from '../../utils/asapPlacement';
import { computeAlapPlacements } from '../../utils/alapPlacement';
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
        .sort(compareTaskOrder);
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

      const oneWay = isLastTaskOfJob(outTask.id, elements, snapshot.tasks);
      const dates = calculateOutsourcingDates(latestPredecessorEnd, {
        workDays: outTask.duration.openDays,
        latestDepartureTime: outTask.duration.latestDepartureTime,
        receptionTime: outTask.duration.receptionTime,
        transitDays: provider.transitDays,
        oneWay,
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
          .sort(compareTaskOrder);
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
  return { data: structuredClone(snapshot) };
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
      formeStatus: 'none',
      createdAt: now,
      updatedAt: now,
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

  // Resolve requiredJobReferences to IDs
  let resolvedRequiredJobIds: string[] = [];
  if (body.requiredJobReferences && body.requiredJobReferences.length > 0) {
    resolvedRequiredJobIds = body.requiredJobReferences
      .map((ref) => currentSnapshot.jobs.find((j) => j.reference === ref)?.id)
      .filter((id): id is string => id !== undefined);
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
    requiredJobIds: resolvedRequiredJobIds,
    elementIds,
    taskIds: allTaskIds,
    createdAt: now,
    updatedAt: now,
    shipped: false,
    shippedAt: null,
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
        formeStatus: 'none',
        createdAt: now,
        updatedAt: now,
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

  // Resolve requiredJobReferences to IDs
  let resolvedRequiredJobIds: string[] | undefined;
  if (body.requiredJobReferences !== undefined) {
    resolvedRequiredJobIds = body.requiredJobReferences
      .map((ref) => currentSnapshot.jobs.find((j) => j.reference === ref)?.id)
      .filter((id): id is string => id !== undefined);
  }

  // Merge metadata (only provided fields)
  const updatedJob: Job = {
    ...existingJob,
    ...(body.reference !== undefined && { reference: body.reference }),
    ...(body.client !== undefined && { client: body.client }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.workshopExitDate !== undefined && { workshopExitDate: body.workshopExitDate }),
    ...(body.quantity !== undefined && { quantity: body.quantity }),
    ...(resolvedRequiredJobIds !== undefined && { requiredJobIds: resolvedRequiredJobIds }),
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
// Clear Job Assignments Handler
// ============================================================================

/**
 * DELETE /jobs/:jobId/assignments - Clear all tile assignments for a job
 */
const handleClearJobAssignments: MockRouteHandler = async (args: FetchArgs) => {
  const jobId = extractPathParam(args.url, /\/jobs\/([^/]+)\/assignments$/);
  if (!jobId) {
    return { error: createNotFoundError('Invalid job ID') };
  }

  const currentSnapshot = getSnapshot();
  const job = currentSnapshot.jobs.find((j: Job) => j.id === jobId);
  if (!job) {
    return { error: createNotFoundError('Job not found') };
  }

  const jobTaskIds = new Set(job.taskIds);

  // Find clearable assignments (exclude completed and in-progress)
  const now = new Date().toISOString();
  const jobAssignmentTaskIds = currentSnapshot.assignments
    .filter((a: TaskAssignment) => jobTaskIds.has(a.taskId))
    .filter((a: TaskAssignment) => !a.isCompleted)
    .filter((a: TaskAssignment) => {
      if (a.scheduledStart <= now && (!a.scheduledEnd || a.scheduledEnd > now)) return false;
      return true;
    })
    .map((a: TaskAssignment) => a.taskId);

  const clearableTaskIds = new Set(jobAssignmentTaskIds);

  // For each task being unassigned, check for outsourced cascade removals
  let remainingAssignments = currentSnapshot.assignments.filter(
    (a: TaskAssignment) => !clearableTaskIds.has(a.taskId)
  );

  const outsourcedToRemove = new Set<string>();
  for (const taskId of jobAssignmentTaskIds) {
    const toRemove = getOutsourcedTasksToRemoveOnUnassign(
      currentSnapshot,
      taskId,
      remainingAssignments
    );
    for (const id of toRemove) {
      outsourcedToRemove.add(id);
    }
  }

  remainingAssignments = remainingAssignments.filter(
    (a: TaskAssignment) => !outsourcedToRemove.has(a.taskId)
  );

  updateSnapshot((snapshot) => ({
    ...snapshot,
    assignments: remainingAssignments,
  }));

  return { data: { unassignedCount: jobAssignmentTaskIds.length } };
};

/**
 * DELETE /schedule/assignments - Clear all clearable tile assignments globally
 *
 * Query params:
 * - includeInProgress=1: also clear tiles intersecting with NOW
 * - fuseSplits=1: fuse split tile groups back into single tasks after clearing
 */
const handleClearAllAssignments: MockRouteHandler = async (args: FetchArgs) => {
  const url = new URL(args.url, 'http://localhost');
  const includeInProgress = url.searchParams.get('includeInProgress') === '1';
  const fuseSplits = url.searchParams.get('fuseSplits') === '1';

  const currentSnapshot = getSnapshot();
  const now = new Date().toISOString();

  const clearableTaskIds = new Set(
    currentSnapshot.assignments
      .filter((a: TaskAssignment) => !a.isCompleted)
      .filter((a: TaskAssignment) => {
        if (!includeInProgress && a.scheduledStart <= now && (!a.scheduledEnd || a.scheduledEnd > now)) return false;
        return true;
      })
      .map((a: TaskAssignment) => a.taskId)
  );

  let remainingAssignments = currentSnapshot.assignments.filter(
    (a: TaskAssignment) => !clearableTaskIds.has(a.taskId)
  );

  // Outsourced cascade removal
  const outsourcedToRemove = new Set<string>();
  for (const taskId of clearableTaskIds) {
    const toRemove = getOutsourcedTasksToRemoveOnUnassign(currentSnapshot, taskId, remainingAssignments);
    for (const id of toRemove) outsourcedToRemove.add(id);
  }
  remainingAssignments = remainingAssignments.filter(
    (a: TaskAssignment) => !outsourcedToRemove.has(a.taskId)
  );

  updateSnapshot((snapshot) => {
    const updated = { ...snapshot, assignments: remainingAssignments };

    // Fuse split groups where ALL parts have been cleared
    if (fuseSplits) {
      const splitGroups = new Map<string, string[]>();
      for (const task of updated.tasks) {
        if (task.type === 'Internal') {
          const it = task as InternalTask;
          if (it.splitGroupId) {
            const group = splitGroups.get(it.splitGroupId) || [];
            group.push(it.id);
            splitGroups.set(it.splitGroupId, group);
          }
        }
      }
      for (const [, memberIds] of splitGroups) {
        // Only fuse if ALL members are unassigned (none remain in assignments)
        const anyStillAssigned = memberIds.some((id) =>
          updated.assignments.some((a: TaskAssignment) => a.taskId === id)
        );
        if (!anyStillAssigned) {
          const restoredId = generateId();
          applyFuseToSnapshot(updated as ScheduleSnapshot, { taskId: memberIds[0], restoredId, now });
        }
      }
    }

    return updated;
  });

  return { data: { unassignedCount: clearableTaskIds.size } };
};

// ============================================================================
// Auto-Place Job Handler
// ============================================================================

/**
 * POST /jobs/:jobId/auto-place - ASAP auto-placement for all unscheduled tasks
 */
const handleAutoPlace: MockRouteHandler = async (args: FetchArgs) => {
  const jobId = extractPathParam(args.url, /\/jobs\/([^/]+)\/auto-place$/);
  if (!jobId) {
    return { error: createNotFoundError('Invalid job ID') };
  }

  const currentSnapshot = getSnapshot();
  const job = currentSnapshot.jobs.find((j: Job) => j.id === jobId);
  if (!job) {
    return { error: createNotFoundError('Job not found') };
  }

  const t0 = performance.now();
  const result = computeAsapPlacements(jobId, currentSnapshot);
  const computeMs = Math.round(performance.now() - t0);

  if (result.placements.length === 0) {
    return { data: { placedCount: 0, computeMs } };
  }

  // Apply placements to snapshot
  updateSnapshot((snapshot) => {
    const updatedAssignments = [...snapshot.assignments];

    for (const p of result.placements) {
      const task = snapshot.tasks.find((t: Task) => t.id === p.taskId);
      let scheduledEnd: string;

      if (task && 'stationId' in task) {
        const station = snapshot.stations.find((s: Station) => s.id === p.targetId);
        scheduledEnd = calculateEndTime(task as InternalTask, p.scheduledStart, station);
      } else if (task && 'providerId' in task) {
        const outsourcedTask = task as OutsourcedTask;
        const provider = snapshot.providers?.find(pr => pr.id === outsourcedTask.providerId);
        if (provider) {
          const oneWay = isLastTaskOfJob(task.id, snapshot.elements, snapshot.tasks);
          const dates = calculateOutsourcingDates(p.scheduledStart, {
            workDays: outsourcedTask.duration.openDays,
            latestDepartureTime: provider.latestDepartureTime,
            receptionTime: provider.receptionTime,
            transitDays: provider.transitDays,
            oneWay,
          });
          scheduledEnd = dates ? dates.return.toISOString() : p.scheduledStart;
        } else {
          scheduledEnd = p.scheduledStart;
        }
      } else {
        scheduledEnd = p.scheduledStart;
      }

      const now = new Date().toISOString();
      updatedAssignments.push({
        id: generateId(),
        taskId: p.taskId,
        targetId: p.targetId,
        isOutsourced: p.isOutsourced,
        scheduledStart: p.scheduledStart,
        scheduledEnd,
        isCompleted: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Also run auto-assign outsourced successors for each placed internal task
    let finalAssignments = updatedAssignments;
    for (const p of result.placements) {
      if (!p.isOutsourced) {
        const autoResult = autoAssignOutsourcedSuccessors(
          { ...snapshot, assignments: finalAssignments },
          p.taskId,
          finalAssignments,
        );
        finalAssignments = [
          ...finalAssignments.filter(
            (a: TaskAssignment) => !autoResult.updatedAssignments.some(u => u.taskId === a.taskId)
          ),
          ...autoResult.newAssignments,
          ...autoResult.updatedAssignments,
        ];
      }
    }

    return { ...snapshot, assignments: finalAssignments };
  });

  return { data: { placedCount: result.placements.length, computeMs } };
};

// ============================================================================
// Auto-Place Job ALAP Handler
// ============================================================================

/**
 * POST /jobs/:jobId/auto-place-alap - ALAP auto-placement for all unscheduled tasks
 */
const handleAutoPlaceAlap: MockRouteHandler = async (args: FetchArgs) => {
  const jobId = extractPathParam(args.url, /\/jobs\/([^/]+)\/auto-place-alap$/);
  if (!jobId) {
    return { error: createNotFoundError('Invalid job ID') };
  }

  const currentSnapshot = getSnapshot();
  const job = currentSnapshot.jobs.find((j: Job) => j.id === jobId);
  if (!job) {
    return { error: createNotFoundError('Job not found') };
  }

  const t0 = performance.now();
  const result = computeAlapPlacements(jobId, currentSnapshot);
  const computeMs = Math.round(performance.now() - t0);

  if (result.placements.length === 0) {
    return { data: { placedCount: 0, computeMs } };
  }

  // Apply placements to snapshot
  updateSnapshot((snapshot) => {
    const updatedAssignments = [...snapshot.assignments];

    for (const p of result.placements) {
      const task = snapshot.tasks.find((t: Task) => t.id === p.taskId);
      let scheduledEnd: string;

      if (task && 'stationId' in task) {
        const station = snapshot.stations.find((s: Station) => s.id === p.targetId);
        scheduledEnd = calculateEndTime(task as InternalTask, p.scheduledStart, station);
      } else if (task && 'providerId' in task) {
        const outsourcedTask = task as OutsourcedTask;
        const provider = snapshot.providers?.find(pr => pr.id === outsourcedTask.providerId);
        if (provider) {
          const oneWay = isLastTaskOfJob(task.id, snapshot.elements, snapshot.tasks);
          const dates = calculateOutsourcingDates(p.scheduledStart, {
            workDays: outsourcedTask.duration.openDays,
            latestDepartureTime: provider.latestDepartureTime,
            receptionTime: provider.receptionTime,
            transitDays: provider.transitDays,
            oneWay,
          });
          scheduledEnd = dates ? dates.return.toISOString() : p.scheduledStart;
        } else {
          scheduledEnd = p.scheduledStart;
        }
      } else {
        scheduledEnd = p.scheduledStart;
      }

      const now = new Date().toISOString();
      updatedAssignments.push({
        id: generateId(),
        taskId: p.taskId,
        targetId: p.targetId,
        isOutsourced: p.isOutsourced,
        scheduledStart: p.scheduledStart,
        scheduledEnd,
        isCompleted: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // ALAP places ALL outsourced tasks backward explicitly — no autoAssignSuccessors
    // (which uses forward/ASAP logic and would create lateness).
    return { ...snapshot, assignments: updatedAssignments };
  });

  return { data: { placedCount: result.placements.length, computeMs } };
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
 * POST /schedule/batch-reschedule - Batch reschedule multiple assignments
 *
 * Used by smart compaction to persist all reordered assignments in a single request.
 */
const handleBatchReschedule = async (
  args: FetchArgs
): Promise<{ data: { updatedCount: number } } | { error: FetchBaseQueryError }> => {
  const body = args.body as { assignments?: Array<{ taskId: string; scheduledStart: string; scheduledEnd: string }> } | undefined;
  const assignments = body?.assignments;

  if (!assignments || !Array.isArray(assignments)) {
    return { error: createNotFoundError('Request body must contain an "assignments" array.') };
  }

  const currentSnapshot = getSnapshot();
  const assignmentMap = new Map(currentSnapshot.assignments.map((a) => [a.taskId, a]));

  let updatedCount = 0;
  const updates = new Map<string, { scheduledStart: string; scheduledEnd: string }>();

  for (const item of assignments) {
    if (!item.taskId || !item.scheduledStart || !item.scheduledEnd) continue;
    const existing = assignmentMap.get(item.taskId);
    if (!existing) continue;

    updates.set(item.taskId, {
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
    });
    updatedCount++;
  }

  if (updatedCount > 0) {
    updateSnapshot((snapshot) => ({
      ...snapshot,
      assignments: snapshot.assignments.map((a) => {
        const update = updates.get(a.taskId);
        return update
          ? { ...a, scheduledStart: update.scheduledStart, scheduledEnd: update.scheduledEnd, updatedAt: new Date().toISOString() }
          : a;
      }),
    }));
  }

  return { data: { updatedCount } };
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
      id: `client-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      createdAt: now,
      updatedAt: now,
    },
  };
};

/**
 * PUT /clients/:id - Update a client
 */
const handleUpdateClient = async (
  args: FetchArgs
): Promise<{ data: { id: string; name: string; createdAt: string; updatedAt: string } } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/clients\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing client ID' } } };
  }

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

  // Find existing client by ID
  const existingName = mockClientStore.find(
    (n) => `client-${n.toLowerCase().replace(/\s+/g, '-')}` === id
  );
  if (!existingName) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Client not found' } } };
  }

  // Check for duplicate (excluding current)
  const duplicate = mockClientStore.some(
    (n) => n.toLowerCase() === name.toLowerCase() && n !== existingName
  );
  if (duplicate) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Client '${name}' already exists` },
      },
    };
  }

  // Replace old name with new name
  const idx = mockClientStore.indexOf(existingName);
  mockClientStore[idx] = name;
  mockClientStore.sort();

  const now = new Date().toISOString();
  return {
    data: {
      id: `client-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      createdAt: now,
      updatedAt: now,
    },
  };
};

/**
 * DELETE /clients/:id - Delete a client
 */
const handleDeleteClient = async (
  args: FetchArgs
): Promise<{ data: Record<string, never> } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/clients\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing client ID' } } };
  }

  const existingName = mockClientStore.find(
    (n) => `client-${n.toLowerCase().replace(/\s+/g, '-')}` === id
  );
  if (!existingName) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Client not found' } } };
  }

  mockClientStore = mockClientStore.filter((n) => n !== existingName);

  return { data: {} };
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

/**
 * PUT /elements/:elementId/prerequisites - Update element prerequisite status
 */
const handleUpdateElementStatus = async (
  args: FetchArgs
): Promise<{ data: unknown } | { error: FetchBaseQueryError }> => {
  const elementId = extractPathParam(args.url, /\/elements\/([^/]+)\/prerequisites$/);
  if (!elementId) {
    return { error: { status: 400, data: { error: { code: 'BAD_REQUEST', message: 'Missing element ID' } } } };
  }

  const currentSnapshot = getSnapshot();
  const element = currentSnapshot.elements.find((e) => e.id === elementId);
  if (!element) {
    return { error: { status: 404, data: { error: { code: 'NOT_FOUND', message: 'Element not found' } } } };
  }

  const body = args.body as Record<string, string> | undefined;
  if (!body) {
    return { error: { status: 400, data: { error: { code: 'BAD_REQUEST', message: 'Missing body' } } } };
  }

  updateSnapshot((snapshot) => ({
    ...snapshot,
    elements: snapshot.elements.map((e) =>
      e.id === elementId
        ? { ...e, ...body, updatedAt: new Date().toISOString() }
        : e
    ),
  }));

  const updated = getSnapshot().elements.find((e) => e.id === elementId)!;
  return {
    data: {
      elementId: updated.id,
      paperStatus: updated.paperStatus,
      batStatus: updated.batStatus,
      plateStatus: updated.plateStatus,
      formeStatus: updated.formeStatus,
      isBlocked: false,
    },
  };
};

// ============================================================================
// Station Category Handlers
// ============================================================================

/**
 * GET /station-categories - List all station categories
 */
const handleGetStationCategories = async (): Promise<{ data: unknown }> => {
  const snapshot = getSnapshot();
  const now = new Date().toISOString();
  const data = snapshot.categories.map((cat, index) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description,
    similarityCriteria: cat.similarityCriteria,
    abbreviation: (cat as { abbreviation?: string }).abbreviation ?? cat.name.substring(0, 5),
    displayOrder: (cat as { displayOrder?: number }).displayOrder ?? index,
    createdAt: now,
    updatedAt: now,
  }));
  return { data };
};

/**
 * POST /station-categories - Create a station category
 */
const handleCreateStationCategory = async (
  args: FetchArgs
): Promise<{ data: unknown } | { error: FetchBaseQueryError }> => {
  const body = args.body as { name: string; description?: string; similarityCriteria: { name: string; fieldPath: string }[] };
  const name = body.name?.trim();

  if (!name) {
    return {
      error: {
        status: 400,
        data: { error: 'ValidationError', message: 'Category name is required' },
      },
    };
  }

  const snapshot = getSnapshot();
  const exists = snapshot.categories.some((c) => c.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Category '${name}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const newCategory = {
    id: `cat-${Date.now()}`,
    name,
    description: body.description,
    similarityCriteria: body.similarityCriteria ?? [],
  };

  updateSnapshot((s) => ({
    ...s,
    categories: [...s.categories, newCategory],
  }));

  return {
    data: { ...newCategory, createdAt: now, updatedAt: now },
  };
};

/**
 * PUT /station-categories/:id - Update a station category
 */
const handleUpdateStationCategory = async (
  args: FetchArgs
): Promise<{ data: unknown } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/station-categories\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing category ID' } } };
  }

  const body = args.body as { name: string; description?: string; similarityCriteria: { name: string; fieldPath: string }[] };
  const name = body.name?.trim();

  if (!name) {
    return {
      error: {
        status: 400,
        data: { error: 'ValidationError', message: 'Category name is required' },
      },
    };
  }

  const snapshot = getSnapshot();
  const index = snapshot.categories.findIndex((c) => c.id === id);
  if (index === -1) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Category not found' } } };
  }

  const duplicateName = snapshot.categories.some(
    (c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicateName) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Category '${name}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const updated = {
    ...snapshot.categories[index],
    name,
    description: body.description,
    similarityCriteria: body.similarityCriteria ?? [],
  };

  updateSnapshot((s) => ({
    ...s,
    categories: s.categories.map((c) => (c.id === id ? updated : c)),
  }));

  return { data: { ...updated, createdAt: now, updatedAt: now } };
};

/**
 * DELETE /station-categories/:id - Delete a station category
 */
const handleDeleteStationCategory = async (
  args: FetchArgs
): Promise<{ data: unknown } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/station-categories\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing category ID' } } };
  }

  const snapshot = getSnapshot();
  const category = snapshot.categories.find((c) => c.id === id);
  if (!category) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Category not found' } } };
  }

  const inUse = snapshot.stations.some((s) => s.categoryId === id);
  if (inUse) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: 'Category is in use by one or more stations' },
      },
    };
  }

  updateSnapshot((s) => ({
    ...s,
    categories: s.categories.filter((c) => c.id !== id),
  }));

  return { data: {} };
};

// ============================================================================
// Format Handlers
// ============================================================================

/**
 * Mock format store — initialized from PRODUCT_FORMATS reference data.
 * Grows / shrinks as formats are created / deleted.
 */
let mockFormatStore: FormatResponse[] = PRODUCT_FORMATS.map((f) => ({
  id: `format-${f.id}`,
  name: f.name,
  width: f.width,
  height: f.height,
  createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
}));

/**
 * GET /formats - List all formats
 */
const handleGetFormats = async (): Promise<{ data: FormatResponse[] }> => {
  return { data: mockFormatStore };
};

/**
 * POST /formats - Create a new format
 */
const handleCreateFormat = async (
  args: FetchArgs
): Promise<{ data: FormatResponse } | { error: FetchBaseQueryError }> => {
  const body = args.body as { name?: string; width?: number; height?: number };
  const name = body.name?.trim();

  if (!name) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Format name is required' } },
    };
  }

  if (!body.width || body.width <= 0) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Width must be a positive integer' } },
    };
  }

  if (!body.height || body.height <= 0) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Height must be a positive integer' } },
    };
  }

  const exists = mockFormatStore.some((f) => f.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Format '${name}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const newFormat: FormatResponse = {
    id: `format-${Date.now()}`,
    name,
    width: body.width,
    height: body.height,
    createdAt: now,
    updatedAt: now,
  };

  mockFormatStore = [...mockFormatStore, newFormat].sort((a, b) => a.name.localeCompare(b.name));

  return { data: newFormat };
};

/**
 * PUT /formats/:id - Update a format
 */
const handleUpdateFormat = async (
  args: FetchArgs
): Promise<{ data: FormatResponse } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/formats\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing format ID' } } };
  }

  const body = args.body as { name?: string; width?: number; height?: number };
  const name = body.name?.trim();

  if (!name) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Format name is required' } },
    };
  }

  if (!body.width || body.width <= 0) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Width must be a positive integer' } },
    };
  }

  if (!body.height || body.height <= 0) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Height must be a positive integer' } },
    };
  }

  const existing = mockFormatStore.find((f) => f.id === id);
  if (!existing) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Format not found' } } };
  }

  const duplicate = mockFormatStore.some(
    (f) => f.id !== id && f.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Format '${name}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const updated: FormatResponse = {
    ...existing,
    name,
    width: body.width,
    height: body.height,
    updatedAt: now,
  };

  mockFormatStore = mockFormatStore
    .map((f) => (f.id === id ? updated : f))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { data: updated };
};

/**
 * DELETE /formats/:id - Delete a format
 */
const handleDeleteFormat = async (
  args: FetchArgs
): Promise<{ data: Record<string, never> } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/formats\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing format ID' } } };
  }

  const exists = mockFormatStore.some((f) => f.id === id);
  if (!exists) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Format not found' } } };
  }

  mockFormatStore = mockFormatStore.filter((f) => f.id !== id);

  return { data: {} };
};

// ============================================================================
// Impression Preset Handlers
// ============================================================================

const IMPRESSION_PRESET_LABELS: Record<string, string> = {
  'Q/Q': 'quadri recto/verso',
  'Q/': 'quadri recto',
  'N/N': 'noir recto/verso',
  'N/': 'noir recto',
};

/**
 * Mock impression preset store — initialized from IMPRESSION_PRESETS reference data.
 */
let mockImpressionPresetStore: ImpressionPresetResponse[] = IMPRESSION_PRESETS.map((p) => ({
  id: `impression-preset-${p.id}`,
  value: p.value,
  description: p.description,
  label: IMPRESSION_PRESET_LABELS[p.value] ?? '',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}));

/**
 * GET /impression-presets - List all impression presets
 */
const handleGetImpressionPresets = async (): Promise<{ data: ImpressionPresetResponse[] }> => {
  return { data: mockImpressionPresetStore };
};

/**
 * POST /impression-presets - Create a new impression preset
 */
const handleCreateImpressionPreset = async (
  args: FetchArgs
): Promise<{ data: ImpressionPresetResponse } | { error: FetchBaseQueryError }> => {
  const body = args.body as { value?: string; description?: string; label?: string };
  const value = body.value?.trim();
  const description = body.description?.trim();
  const label = body.label?.trim() ?? '';

  if (!value) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Value is required' } },
    };
  }

  if (!value.includes('/')) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Value must contain a / separator' } },
    };
  }

  if (!description) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Description is required' } },
    };
  }

  const exists = mockImpressionPresetStore.some((p) => p.value === value);
  if (exists) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Impression preset '${value}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const newPreset: ImpressionPresetResponse = {
    id: `impression-preset-${Date.now()}`,
    value,
    description,
    label,
    createdAt: now,
    updatedAt: now,
  };

  mockImpressionPresetStore = [...mockImpressionPresetStore, newPreset].sort((a, b) =>
    a.value.localeCompare(b.value)
  );

  return { data: newPreset };
};

/**
 * PUT /impression-presets/:id - Update an impression preset
 */
const handleUpdateImpressionPreset = async (
  args: FetchArgs
): Promise<{ data: ImpressionPresetResponse } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/impression-presets\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing preset ID' } } };
  }

  const body = args.body as { value?: string; description?: string; label?: string };
  const value = body.value?.trim();
  const description = body.description?.trim();
  const label = body.label?.trim() ?? '';

  if (!value) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Value is required' } },
    };
  }

  if (!value.includes('/')) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Value must contain a / separator' } },
    };
  }

  if (!description) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Description is required' } },
    };
  }

  const existing = mockImpressionPresetStore.find((p) => p.id === id);
  if (!existing) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Impression preset not found' } } };
  }

  const duplicate = mockImpressionPresetStore.some((p) => p.id !== id && p.value === value);
  if (duplicate) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Impression preset '${value}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const updated: ImpressionPresetResponse = {
    ...existing,
    value,
    description,
    label,
    updatedAt: now,
  };

  mockImpressionPresetStore = mockImpressionPresetStore
    .map((p) => (p.id === id ? updated : p))
    .sort((a, b) => a.value.localeCompare(b.value));

  return { data: updated };
};

/**
 * DELETE /impression-presets/:id - Delete an impression preset
 */
const handleDeleteImpressionPreset = async (
  args: FetchArgs
): Promise<{ data: Record<string, never> } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/impression-presets\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing preset ID' } } };
  }

  const exists = mockImpressionPresetStore.some((p) => p.id === id);
  if (!exists) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Impression preset not found' } } };
  }

  mockImpressionPresetStore = mockImpressionPresetStore.filter((p) => p.id !== id);

  return { data: {} };
};

// ============================================================================
// Surfacage Preset Handlers
// ============================================================================

const SURFACAGE_PRESET_LABELS: Record<string, string> = {
  'mat/mat': 'pelli mat recto/verso',
  'satin/satin': 'pelli satin recto/verso',
  'brillant/brillant': 'pelli brillant recto/verso',
  'UV/UV': 'vernis UV recto/verso',
  'dorure/dorure': 'dorure recto/verso',
  'mat/': 'pelli mat recto',
  'satin/': 'pelli satin recto',
  'brillant/': 'pelli brillant recto',
  'UV/': 'vernis UV recto',
  'dorure/': 'dorure recto',
};

/**
 * Mock surfacage preset store — initialized from SURFACAGE_PRESETS reference data.
 */
let mockSurfacagePresetStore: SurfacagePresetResponse[] = SURFACAGE_PRESETS.map((p) => ({
  id: `surfacage-preset-${p.id}`,
  value: p.value,
  description: p.description,
  label: SURFACAGE_PRESET_LABELS[p.value] ?? '',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}));

/**
 * GET /surfacage-presets - List all surfacage presets
 */
const handleGetSurfacagePresets = async (): Promise<{ data: SurfacagePresetResponse[] }> => {
  return { data: mockSurfacagePresetStore };
};

/**
 * POST /surfacage-presets - Create a new surfacage preset
 */
const handleCreateSurfacagePreset = async (
  args: FetchArgs
): Promise<{ data: SurfacagePresetResponse } | { error: FetchBaseQueryError }> => {
  const body = args.body as { value?: string; description?: string; label?: string };
  const value = body.value?.trim();
  const description = body.description?.trim();
  const label = body.label?.trim() ?? '';

  if (!value) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Value is required' } },
    };
  }

  if (!value.includes('/')) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Value must contain a / separator' } },
    };
  }

  if (!description) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Description is required' } },
    };
  }

  const exists = mockSurfacagePresetStore.some((p) => p.value === value);
  if (exists) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Surfacage preset '${value}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const newPreset: SurfacagePresetResponse = {
    id: `surfacage-preset-${Date.now()}`,
    value,
    description,
    label,
    createdAt: now,
    updatedAt: now,
  };

  mockSurfacagePresetStore = [...mockSurfacagePresetStore, newPreset].sort((a, b) =>
    a.value.localeCompare(b.value)
  );

  return { data: newPreset };
};

/**
 * PUT /surfacage-presets/:id - Update a surfacage preset
 */
const handleUpdateSurfacagePreset = async (
  args: FetchArgs
): Promise<{ data: SurfacagePresetResponse } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/surfacage-presets\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing preset ID' } } };
  }

  const body = args.body as { value?: string; description?: string; label?: string };
  const value = body.value?.trim();
  const description = body.description?.trim();
  const label = body.label?.trim() ?? '';

  if (!value) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Value is required' } },
    };
  }

  if (!value.includes('/')) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Value must contain a / separator' } },
    };
  }

  if (!description) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Description is required' } },
    };
  }

  const existing = mockSurfacagePresetStore.find((p) => p.id === id);
  if (!existing) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Surfacage preset not found' } } };
  }

  const duplicate = mockSurfacagePresetStore.some((p) => p.id !== id && p.value === value);
  if (duplicate) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Surfacage preset '${value}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const updated: SurfacagePresetResponse = {
    ...existing,
    value,
    description,
    label,
    updatedAt: now,
  };

  mockSurfacagePresetStore = mockSurfacagePresetStore
    .map((p) => (p.id === id ? updated : p))
    .sort((a, b) => a.value.localeCompare(b.value));

  return { data: updated };
};

/**
 * DELETE /surfacage-presets/:id - Delete a surfacage preset
 */
const handleDeleteSurfacagePreset = async (
  args: FetchArgs
): Promise<{ data: Record<string, never> } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/surfacage-presets\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing preset ID' } } };
  }

  const exists = mockSurfacagePresetStore.some((p) => p.id === id);
  if (!exists) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Surfacage preset not found' } } };
  }

  mockSurfacagePresetStore = mockSurfacagePresetStore.filter((p) => p.id !== id);

  return { data: {} };
};

// ============================================================================
// Feuille Format Handlers
// ============================================================================

/**
 * Mock feuille format store — initialized from FEUILLE_FORMATS reference data.
 */
let mockFeuilleFormatStore: FeuilleFormatResponse[] = FEUILLE_FORMATS.map((f) => ({
  id: `feuille-format-${f.format}`,
  format: f.format,
  poses: [...f.poses],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}));

/**
 * GET /feuille-formats - List all feuille formats
 */
const handleGetFeuilleFormats = async (): Promise<{ data: FeuilleFormatResponse[] }> => {
  return { data: mockFeuilleFormatStore };
};

/**
 * POST /feuille-formats - Create a new feuille format
 */
const handleCreateFeuilleFormat = async (
  args: FetchArgs
): Promise<{ data: FeuilleFormatResponse } | { error: FetchBaseQueryError }> => {
  const body = args.body as { format?: string; poses?: number[] };
  const format = body.format?.trim();

  if (!format) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Format is required' } },
    };
  }

  if (!/^[1-9]\d*x[1-9]\d*$/i.test(format)) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Format must match pattern WxH (e.g., 50x70)' } },
    };
  }

  if (!Array.isArray(body.poses) || body.poses.length === 0) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'At least one poses value is required' } },
    };
  }

  const exists = mockFeuilleFormatStore.some((f) => f.format === format);
  if (exists) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `FeuilleFormat '${format}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const newFormat: FeuilleFormatResponse = {
    id: `feuille-format-${Date.now()}`,
    format,
    poses: [...body.poses].sort((a, b) => a - b),
    createdAt: now,
    updatedAt: now,
  };

  mockFeuilleFormatStore = [...mockFeuilleFormatStore, newFormat].sort((a, b) =>
    a.format.localeCompare(b.format)
  );

  return { data: newFormat };
};

/**
 * PUT /feuille-formats/:id - Update a feuille format
 */
const handleUpdateFeuilleFormat = async (
  args: FetchArgs
): Promise<{ data: FeuilleFormatResponse } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/feuille-formats\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing format ID' } } };
  }

  const body = args.body as { format?: string; poses?: number[] };
  const format = body.format?.trim();

  if (!format) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Format is required' } },
    };
  }

  if (!/^[1-9]\d*x[1-9]\d*$/i.test(format)) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Format must match pattern WxH (e.g., 50x70)' } },
    };
  }

  if (!Array.isArray(body.poses) || body.poses.length === 0) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'At least one poses value is required' } },
    };
  }

  const existing = mockFeuilleFormatStore.find((f) => f.id === id);
  if (!existing) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'FeuilleFormat not found' } } };
  }

  const duplicate = mockFeuilleFormatStore.some((f) => f.id !== id && f.format === format);
  if (duplicate) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `FeuilleFormat '${format}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const updated: FeuilleFormatResponse = {
    ...existing,
    format,
    poses: [...body.poses].sort((a, b) => a - b),
    updatedAt: now,
  };

  mockFeuilleFormatStore = mockFeuilleFormatStore
    .map((f) => (f.id === id ? updated : f))
    .sort((a, b) => a.format.localeCompare(b.format));

  return { data: updated };
};

/**
 * DELETE /feuille-formats/:id - Delete a feuille format
 */
const handleDeleteFeuilleFormat = async (
  args: FetchArgs
): Promise<{ data: Record<string, never> } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/feuille-formats\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing format ID' } } };
  }

  const exists = mockFeuilleFormatStore.some((f) => f.id === id);
  if (!exists) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'FeuilleFormat not found' } } };
  }

  mockFeuilleFormatStore = mockFeuilleFormatStore.filter((f) => f.id !== id);

  return { data: {} };
};

// ============================================================================
// Station Handlers (Management CRUD)
// ============================================================================

/**
 * Mock station store — initialized from snapshot stations.
 */
let mockStationStore: StationResponse[] = getSnapshot().stations.map((s, i) => ({
  id: s.id,
  name: s.name,
  status: s.status as StationResponse['status'],
  categoryId: s.categoryId,
  groupId: s.groupId,
  capacity: s.capacity,
  displayOrder: i,
  operatingSchedule: (s.operatingSchedule as unknown as Record<string, { isOperating: boolean; slots: { start: string; end: string }[] }>) ?? null,
  scheduleExceptions: (s.exceptions ?? []).map((e) => ({
    date: (e as { date: string }).date,
    type: 'CLOSED',
    schedule: (e as { schedule?: unknown }).schedule ?? null,
    reason: (e as { reason?: string }).reason ?? null,
  })),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

/**
 * GET /stations - List all stations
 */
const handleGetStations = async (): Promise<{ data: StationResponse[] }> => {
  const sorted = [...mockStationStore].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.name.localeCompare(b.name);
  });
  return { data: sorted };
};

/**
 * POST /stations - Create a station
 */
const handleCreateStation = async (
  args: FetchArgs
): Promise<{ data: StationResponse } | { error: FetchBaseQueryError }> => {
  const body = args.body as { name?: string; status?: string; categoryId?: string; groupId?: string; capacity?: number; displayOrder?: number; operatingSchedule?: Record<string, unknown> | null; scheduleExceptions?: unknown[] | null };
  const name = body.name?.trim();

  if (!name) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Station name is required' } },
    };
  }

  const exists = mockStationStore.some((s) => s.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Station '${name}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const newStation: StationResponse = {
    id: `sta-${Date.now()}`,
    name,
    status: (body.status ?? 'Available') as StationResponse['status'],
    categoryId: body.categoryId ?? '',
    groupId: body.groupId ?? '',
    capacity: body.capacity ?? 1,
    displayOrder: body.displayOrder ?? 0,
    operatingSchedule: (body.operatingSchedule as StationResponse['operatingSchedule']) ?? null,
    scheduleExceptions: (body.scheduleExceptions as StationResponse['scheduleExceptions']) ?? null,
    createdAt: now,
    updatedAt: now,
  };

  mockStationStore = [...mockStationStore, newStation];

  // Update snapshot so scheduler sees the new station
  updateSnapshot((snapshot) => ({
    ...snapshot,
    stations: [
      ...snapshot.stations,
      {
        id: newStation.id,
        name: newStation.name,
        status: newStation.status,
        categoryId: newStation.categoryId,
        groupId: newStation.groupId,
        capacity: newStation.capacity,
        operatingSchedule: (newStation.operatingSchedule as unknown as import('@flux/types').OperatingSchedule | null) ?? { monday: { isOperating: false, slots: [] }, tuesday: { isOperating: false, slots: [] }, wednesday: { isOperating: false, slots: [] }, thursday: { isOperating: false, slots: [] }, friday: { isOperating: false, slots: [] }, saturday: { isOperating: false, slots: [] }, sunday: { isOperating: false, slots: [] } },
        exceptions: (newStation.scheduleExceptions ?? []).map((e, i) => ({
          id: `exc-${newStation.id}-${i}`,
          date: (e as { date: string }).date,
          schedule: ((e as { schedule?: unknown }).schedule ?? { isOperating: false, slots: [] }) as import('@flux/types').DaySchedule,
          reason: (e as { reason?: string | null }).reason ?? undefined,
        })),
      },
    ],
  }));

  return { data: newStation };
};

/**
 * PUT /stations/:id - Update a station
 */
const handleUpdateStation = async (
  args: FetchArgs
): Promise<{ data: StationResponse } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/stations\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing station ID' } } };
  }

  const body = args.body as { name?: string; status?: string; categoryId?: string; groupId?: string; capacity?: number; displayOrder?: number; operatingSchedule?: Record<string, unknown> | null; scheduleExceptions?: unknown[] | null };
  const name = body.name?.trim();

  if (!name) {
    return {
      error: { status: 400, data: { error: 'ValidationError', message: 'Station name is required' } },
    };
  }

  const existing = mockStationStore.find((s) => s.id === id);
  if (!existing) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Station not found' } } };
  }

  const duplicate = mockStationStore.some(
    (s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: `Station '${name}' already exists` },
      },
    };
  }

  const now = new Date().toISOString();
  const updated: StationResponse = {
    ...existing,
    name,
    status: (body.status ?? existing.status) as StationResponse['status'],
    categoryId: body.categoryId ?? existing.categoryId,
    groupId: body.groupId ?? existing.groupId,
    capacity: body.capacity ?? existing.capacity,
    displayOrder: body.displayOrder ?? existing.displayOrder,
    operatingSchedule: body.operatingSchedule !== undefined ? (body.operatingSchedule as StationResponse['operatingSchedule']) : existing.operatingSchedule,
    scheduleExceptions: body.scheduleExceptions !== undefined ? (body.scheduleExceptions as StationResponse['scheduleExceptions']) : existing.scheduleExceptions,
    updatedAt: now,
  };

  mockStationStore = mockStationStore.map((s) => (s.id === id ? updated : s));

  // Update snapshot
  updateSnapshot((snapshot) => ({
    ...snapshot,
    stations: snapshot.stations.map((s) =>
      s.id === id
        ? {
            ...s,
            name: updated.name,
            status: updated.status,
            categoryId: updated.categoryId,
            groupId: updated.groupId,
            capacity: updated.capacity,
            operatingSchedule: (updated.operatingSchedule as unknown as import('@flux/types').OperatingSchedule | null) ?? { monday: { isOperating: false, slots: [] }, tuesday: { isOperating: false, slots: [] }, wednesday: { isOperating: false, slots: [] }, thursday: { isOperating: false, slots: [] }, friday: { isOperating: false, slots: [] }, saturday: { isOperating: false, slots: [] }, sunday: { isOperating: false, slots: [] } },
            exceptions: (updated.scheduleExceptions ?? []).map((e, i) => ({
              id: `exc-${updated.id}-${i}`,
              date: (e as { date: string }).date,
              schedule: ((e as { schedule?: unknown }).schedule ?? { isOperating: false, slots: [] }) as import('@flux/types').DaySchedule,
              reason: (e as { reason?: string | null }).reason ?? undefined,
            })),
          }
        : s
    ),
  }));

  return { data: updated };
};

/**
 * DELETE /stations/:id - Delete a station
 */
const handleDeleteStation = async (
  args: FetchArgs
): Promise<{ data: Record<string, never> } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/stations\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing station ID' } } };
  }

  const existing = mockStationStore.find((s) => s.id === id);
  if (!existing) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Station not found' } } };
  }

  // Check if any tasks are assigned to this station
  const snapshot = getSnapshot();
  const hasAssignments = snapshot.assignments.some((a) => a.targetId === id);
  if (hasAssignments) {
    return {
      error: {
        status: 409,
        data: { error: 'Conflict', message: 'Station has scheduled assignments and cannot be deleted' },
      },
    };
  }

  mockStationStore = mockStationStore.filter((s) => s.id !== id);

  updateSnapshot((s) => ({
    ...s,
    stations: s.stations.filter((st) => st.id !== id),
  }));

  return { data: {} };
};

/**
 * GET /templates - List templates
 */
const handleGetTemplates = async (
  _args: FetchArgs
): Promise<{ data: unknown } | { error: FetchBaseQueryError }> => {
  const items = mockGetTemplates();
  return { data: { items, total: items.length, page: 1, limit: 100, pages: 1 } };
};

/**
 * POST /templates - Create a template
 */
const handleCreateTemplate = async (
  args: FetchArgs
): Promise<{ data: unknown } | { error: FetchBaseQueryError }> => {
  const body = args.body as JcfTemplateCreateInput;
  try {
    const template = await mockCreateTemplate(body);
    return { data: template };
  } catch (e) {
    return { error: { status: 400, data: { error: { code: 'BAD_REQUEST', message: String(e) } } } };
  }
};

/**
 * PUT /templates/:id - Update a template
 */
const handleUpdateTemplate = async (
  args: FetchArgs
): Promise<{ data: unknown } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/templates\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: { code: 'BAD_REQUEST', message: 'Missing template ID' } } } };
  }

  const body = args.body as JcfTemplateUpdateInput;
  try {
    const template = await mockUpdateTemplate(id, body);
    return { data: template };
  } catch {
    return { error: { status: 404, data: { error: { code: 'NOT_FOUND', message: 'Template not found' } } } };
  }
};

/**
 * DELETE /templates/:id - Delete a template
 */
const handleDeleteTemplate = async (
  args: FetchArgs
): Promise<{ data: unknown } | { error: FetchBaseQueryError }> => {
  const id = extractPathParam(args.url, /\/templates\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: { code: 'BAD_REQUEST', message: 'Missing template ID' } } } };
  }

  try {
    mockDeleteTemplate(id);
    return { data: {} };
  } catch {
    return { error: { status: 404, data: { error: { code: 'NOT_FOUND', message: 'Template not found' } } } };
  }
};

// ============================================================================
// Flux (Production Flow Dashboard) Handlers
// ============================================================================

/**
 * GET /flux/jobs — Return mock flux jobs for fixture/development mode.
 *
 * Returns FLUX_STATIC_JOBS directly (FluxJob[] shape).
 * The fluxApi transformResponse handles this format transparently.
 */
const handleGetFluxJobs = async (): Promise<{ data: unknown }> => {
  return { data: FLUX_STATIC_JOBS };
};

/**
 * PATCH /flux/elements/{id} — Mock prerequisite update.
 *
 * Updates FLUX_STATIC_JOBS in-memory so subsequent GET /flux/jobs returns
 * the updated value. The optimistic update already applied the change to
 * the RTK Query cache via onQueryStarted; this ensures consistency if the
 * cache is invalidated and refetched during the same session.
 *
 * Returns { data: {} } — the response body is not used by the mutation
 * (onQueryStarted handles the cache update).
 */
const handlePatchFluxElement = async (
  args: FetchArgs,
): Promise<{ data: unknown }> => {
  const urlMatch = args.url.match(/^\/flux\/elements\/(.+)$/);
  const elementId = urlMatch?.[1];
  const body = args.body as { column?: string; value?: string } | undefined;

  if (elementId && body?.column && body?.value) {
    const column = body.column as 'bat' | 'papier' | 'formes' | 'plaques';
    const value = body.value;
    for (const job of FLUX_STATIC_JOBS) {
      const el = job.elements.find((e) => e.id === elementId);
      if (el && column in el) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el as any)[column] = value;
        break;
      }
    }
  }

  return { data: {} };
};

// ============================================================================
// Saved Schedules (in-memory store)
// ============================================================================

interface MockSavedSchedule {
  id: string;
  name: string;
  assignments: TaskAssignment[];
  assignmentCount: number;
  sourceVersion: number;
  createdAt: string;
}

const mockSavedSchedules: MockSavedSchedule[] = [];

const handleGetSavedSchedules: MockRouteHandler = async () => {
  return {
    data: mockSavedSchedules.map(({ id, name, assignmentCount, sourceVersion, createdAt }) => ({
      id, name, assignmentCount, sourceVersion, createdAt,
    })),
  };
};

const handleSaveSchedule: MockRouteHandler = async (args: FetchArgs) => {
  const body = args.body as { name?: string } | undefined;
  const name = body?.name ?? 'Untitled';

  const snapshot = getSnapshot();
  const assignments = [...snapshot.assignments];

  const saved: MockSavedSchedule = {
    id: generateId(),
    name,
    assignments,
    assignmentCount: assignments.length,
    sourceVersion: snapshot.version ?? 0,
    createdAt: new Date().toISOString(),
  };

  mockSavedSchedules.unshift(saved);

  return {
    data: {
      id: saved.id,
      name: saved.name,
      assignmentCount: saved.assignmentCount,
      sourceVersion: saved.sourceVersion,
      createdAt: saved.createdAt,
    },
  };
};

const handleLoadSchedule: MockRouteHandler = async (args: FetchArgs) => {
  const id = extractPathParam(args.url, /^\/saved-schedules\/([^/]+)\/load$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing saved schedule ID' } } };
  }

  const saved = mockSavedSchedules.find((s) => s.id === id);
  if (!saved) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Saved schedule not found' } } };
  }

  // Replace snapshot assignments with saved ones
  const snapshot = getSnapshot();
  updateSnapshot({
    ...snapshot,
    assignments: [...saved.assignments],
    version: (snapshot.version ?? 0) + 1,
  });

  const updated = getSnapshot();
  return {
    data: {
      version: updated.version ?? 1,
      assignmentCount: updated.assignments.length,
      warnings: [],
    },
  };
};

const handleDeleteSavedSchedule: MockRouteHandler = async (args: FetchArgs) => {
  const id = extractPathParam(args.url, /^\/saved-schedules\/([^/]+)$/);
  if (!id) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing saved schedule ID' } } };
  }

  const index = mockSavedSchedules.findIndex((s) => s.id === id);
  if (index === -1) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Saved schedule not found' } } };
  }

  mockSavedSchedules.splice(index, 1);
  return { data: null };
};

// ============================================================================
// Split / Fuse Task Handlers
// ============================================================================

const handleSplitTask: MockRouteHandler = async (args: FetchArgs) => {
  const taskId = extractPathParam(args.url, /^\/tasks\/([^/]+)\/split$/);
  if (!taskId) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing task ID' } } };
  }

  const body = args.body as { ratio: number } | undefined;
  const ratio = body?.ratio ?? 0.5;
  if (ratio < 0.05 || ratio > 0.95) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Ratio must be between 0.05 and 0.95' } } };
  }

  const snapshot = getSnapshot();
  const task = snapshot.tasks.find((t) => t.id === taskId);
  if (!task || task.type !== 'Internal') {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Internal task not found' } } };
  }

  const partAId = generateId();
  const partBId = generateId();
  const now = new Date().toISOString();

  let splitGroupId = '';
  updateSnapshot((snapshot) => {
    const updated = { ...snapshot };
    const result = applySplitToSnapshot(updated, { taskId, ratio, partAId, partBId, now });
    if (result) {
      splitGroupId = result.splitGroupId;
    }
    return updated;
  });

  return {
    data: {
      partIds: [partAId, partBId],
      splitGroupId,
    },
  };
};

const handleFuseTask: MockRouteHandler = async (args: FetchArgs) => {
  const taskId = extractPathParam(args.url, /^\/tasks\/([^/]+)\/fuse$/);
  if (!taskId) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Missing task ID' } } };
  }

  const snapshot = getSnapshot();
  const task = snapshot.tasks.find((t) => t.id === taskId) as InternalTask | undefined;
  if (!task || task.type !== 'Internal' || !task.splitGroupId) {
    return { error: { status: 404, data: { error: 'NotFound', message: 'Split task not found' } } };
  }

  const splitGroupId = task.splitGroupId;
  const groupMembers = snapshot.tasks.filter(
    (t) => t.type === 'Internal' && (t as InternalTask).splitGroupId === splitGroupId
  ) as InternalTask[];

  if (groupMembers.length < 2) {
    return { error: { status: 400, data: { error: 'BadRequest', message: 'Task is not split' } } };
  }

  const restoredId = generateId();
  const now = new Date().toISOString();

  let originalRunMinutes = 0;
  updateSnapshot((snapshot) => {
    const updated = { ...snapshot };
    const result = applyFuseToSnapshot(updated, { taskId, restoredId, now });
    if (result) {
      originalRunMinutes = result.originalRunMinutes;
    }
    return updated;
  });

  return {
    data: {
      taskId: restoredId,
      runMinutes: originalRunMinutes,
    },
  };
};

const routes: MockRoute[] = [
  // Schedule
  { method: 'GET', pattern: /^\/schedule\/snapshot$/, handler: handleGetSnapshot },

  // Clients
  { method: 'GET', pattern: /^\/clients/, handler: handleGetClientSuggestions },
  { method: 'POST', pattern: /^\/clients$/, handler: handleCreateClient },
  { method: 'PUT', pattern: /^\/clients\/[^/]+$/, handler: handleUpdateClient },
  { method: 'DELETE', pattern: /^\/clients\/[^/]+$/, handler: handleDeleteClient },

  // Jobs
  { method: 'GET', pattern: /^\/jobs\/clients/, handler: handleGetClientSuggestions },
  { method: 'GET', pattern: /^\/jobs\/lookup-by-reference/, handler: handleLookupByReference },
  { method: 'POST', pattern: /^\/jobs$/, handler: handleCreateJob },
  { method: 'PUT', pattern: /^\/jobs\/[^/]+$/, handler: handleUpdateJob },
  { method: 'POST', pattern: /^\/jobs\/[^/]+\/auto-place-alap$/, handler: handleAutoPlaceAlap },
  { method: 'POST', pattern: /^\/jobs\/[^/]+\/auto-place$/, handler: handleAutoPlace },
  { method: 'DELETE', pattern: /^\/jobs\/[^/]+\/assignments$/, handler: handleClearJobAssignments },
  { method: 'DELETE', pattern: /^\/schedule\/assignments$/, handler: handleClearAllAssignments },
  { method: 'DELETE', pattern: /^\/jobs\/[^/]+$/, handler: handleDeleteJob },

  // Elements
  { method: 'PUT', pattern: /^\/elements\/[^/]+\/prerequisites$/, handler: handleUpdateElementStatus },

  // Flux — Production Flow Dashboard
  { method: 'GET',   pattern: /^\/flux\/jobs$/,           handler: handleGetFluxJobs },
  { method: 'PATCH', pattern: /^\/flux\/elements\/[^/]+$/, handler: handlePatchFluxElement },

  // Templates
  { method: 'GET',  pattern: /^\/templates(\?.*)?$/, handler: handleGetTemplates },
  { method: 'POST', pattern: /^\/templates$/, handler: handleCreateTemplate },
  { method: 'PUT', pattern: /^\/templates\/[^/]+$/, handler: handleUpdateTemplate },
  { method: 'DELETE', pattern: /^\/templates\/[^/]+$/, handler: handleDeleteTemplate },

  // Station Categories
  { method: 'GET',    pattern: /^\/station-categories$/,        handler: handleGetStationCategories },
  { method: 'POST',   pattern: /^\/station-categories$/,        handler: handleCreateStationCategory },
  { method: 'PUT',    pattern: /^\/station-categories\/[^/]+$/, handler: handleUpdateStationCategory },
  { method: 'DELETE', pattern: /^\/station-categories\/[^/]+$/, handler: handleDeleteStationCategory },

  // Formats
  { method: 'GET',    pattern: /^\/formats$/,          handler: handleGetFormats },
  { method: 'POST',   pattern: /^\/formats$/,           handler: handleCreateFormat },
  { method: 'PUT',    pattern: /^\/formats\/[^/]+$/,    handler: handleUpdateFormat },
  { method: 'DELETE', pattern: /^\/formats\/[^/]+$/,    handler: handleDeleteFormat },

  // Impression Presets
  { method: 'GET',    pattern: /^\/impression-presets$/,          handler: handleGetImpressionPresets },
  { method: 'POST',   pattern: /^\/impression-presets$/,           handler: handleCreateImpressionPreset },
  { method: 'PUT',    pattern: /^\/impression-presets\/[^/]+$/,    handler: handleUpdateImpressionPreset },
  { method: 'DELETE', pattern: /^\/impression-presets\/[^/]+$/,    handler: handleDeleteImpressionPreset },

  // Surfacage Presets
  { method: 'GET',    pattern: /^\/surfacage-presets$/,          handler: handleGetSurfacagePresets },
  { method: 'POST',   pattern: /^\/surfacage-presets$/,           handler: handleCreateSurfacagePreset },
  { method: 'PUT',    pattern: /^\/surfacage-presets\/[^/]+$/,    handler: handleUpdateSurfacagePreset },
  { method: 'DELETE', pattern: /^\/surfacage-presets\/[^/]+$/,    handler: handleDeleteSurfacagePreset },

  // Feuille Formats
  { method: 'GET',    pattern: /^\/feuille-formats$/,          handler: handleGetFeuilleFormats },
  { method: 'POST',   pattern: /^\/feuille-formats$/,           handler: handleCreateFeuilleFormat },
  { method: 'PUT',    pattern: /^\/feuille-formats\/[^/]+$/,    handler: handleUpdateFeuilleFormat },
  { method: 'DELETE', pattern: /^\/feuille-formats\/[^/]+$/,    handler: handleDeleteFeuilleFormat },

  // Stations (management CRUD)
  { method: 'GET',    pattern: /^\/stations$/,        handler: handleGetStations },
  { method: 'POST',   pattern: /^\/stations$/,         handler: handleCreateStation },
  { method: 'PUT',    pattern: /^\/stations\/[^/]+$/,  handler: handleUpdateStation },
  { method: 'DELETE', pattern: /^\/stations\/[^/]+$/,  handler: handleDeleteStation },

  // Schedule operations
  { method: 'POST', pattern: /^\/schedule\/batch-reschedule$/, handler: handleBatchReschedule },

  // Task assignments
  { method: 'POST', pattern: /^\/tasks\/[^/]+\/assign$/, handler: handleAssignTask },
  { method: 'PUT', pattern: /^\/tasks\/[^/]+\/assign$/, handler: handleRescheduleTask },
  { method: 'DELETE', pattern: /^\/tasks\/[^/]+\/assign$/, handler: handleUnassignTask },

  // Task completion
  { method: 'PUT', pattern: /^\/tasks\/[^/]+\/completion$/, handler: handleToggleCompletion },

  // Task split/fuse
  { method: 'POST', pattern: /^\/tasks\/[^/]+\/split$/, handler: handleSplitTask },
  { method: 'POST', pattern: /^\/tasks\/[^/]+\/fuse$/,  handler: handleFuseTask },

  // Saved Schedules (load must come before generic ID route)
  { method: 'GET',    pattern: /^\/saved-schedules$/,              handler: handleGetSavedSchedules },
  { method: 'POST',   pattern: /^\/saved-schedules$/,              handler: handleSaveSchedule },
  { method: 'POST',   pattern: /^\/saved-schedules\/[^/]+\/load$/, handler: handleLoadSchedule },
  { method: 'DELETE', pattern: /^\/saved-schedules\/[^/]+$/,       handler: handleDeleteSavedSchedule },
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

  // Strip query string for route matching (handlers parse params from full URL)
  const pathOnly = url.split('?')[0];

  // Find matching route
  const route = routes.find((r) => r.method === method && r.pattern.test(pathOnly));

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

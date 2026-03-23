/**
 * Smart Compaction Algorithm
 *
 * Replaces simple gap-closing compaction with similarity-based reordering.
 * Groups similar tiles together on each station to minimize changeover time,
 * then uses compactTimeline for correct time assignment.
 *
 * 4 phases:
 *   Phase 0 — Preparation: partition tiles into immobile/movable/frozen
 *   Phase 1 — Similarity ordering: greedy nearest-neighbor per station
 *   Phase 2 — Time assignment: via compactTimeline (gap-closing + precedence)
 *   Phase 3 — Deadline validation: rollback jobs that became late
 */

import type {
  ScheduleSnapshot,
  TaskAssignment,
  Task,
  InternalTask,
  Station,
  StationCategory,
  Element,
  Job,
  ElementSpec,
  SimilarityCriterion,
} from '@flux/types';
import { getDeadlineDate } from '@flux/types';
import { compareSimilarity } from '../components/Tile/similarityUtils';
import { compactTimeline } from './compactTimeline';
import { roundToNearestQuarterHour } from './workingTime';
import type { CompactHorizon } from '../constants';
import { compareTaskOrder } from './taskHelpers';

// ============================================================================
// Types
// ============================================================================

export interface SmartCompactOptions {
  snapshot: ScheduleSnapshot;
  horizonHours: CompactHorizon;
  now?: Date;
  calculateEndTime: (task: InternalTask, start: string, station: Station | undefined) => string;
}

export interface SmartCompactResult {
  snapshot: ScheduleSnapshot;
  movedCount: number;
  reorderedCount: number;
  similarityBefore: number;
  similarityAfter: number;
  rollbackCount: number;
  stationResults: StationCompactResult[];
}

export interface StationCompactResult {
  stationId: string;
  stationName: string;
  movableCount: number;
  reorderedCount: number;
  similarityBefore: number;
  similarityAfter: number;
}

export interface SmartCompactProgress {
  phase: 'analyze' | 'reorder' | 'validate' | 'apply' | 'complete';
  stationName?: string;
  stationIndex?: number;
  totalStations?: number;
  result?: SmartCompactResult;
  message?: string;
}

/** A movable block: single tile or group of split parts */
interface TileBlock {
  /** All assignments in this block (1 for single tile, N for split group) */
  assignments: TaskAssignment[];
  /** All tasks in this block */
  tasks: InternalTask[];
  /** The element spec used for similarity scoring (from first task's element) */
  spec: ElementSpec | undefined;
  /** Element ID (for intra-element ordering constraint) */
  elementId: string;
  /** Minimum sequenceOrder in the block (for ordering constraint) */
  minSequenceOrder: number;
  /** workshopExitDate for tie-breaking */
  workshopExitDate: string | undefined;
  /** Split group ID (if this is a split group) */
  splitGroupId: string | undefined;
}

// ============================================================================
// Phase 0 — Preparation
// ============================================================================

interface StationPartition {
  station: Station;
  category: StationCategory | undefined;
  immobile: TaskAssignment[];
  movable: TaskAssignment[];
  frozen: TaskAssignment[];
}

function partitionStationTiles(
  station: Station,
  snapshot: ScheduleSnapshot,
  now: Date,
  horizonMs: number,
  categoryMap: Map<string, StationCategory>,
): StationPartition {
  const category = categoryMap.get(station.categoryId);
  const stationAssignments = snapshot.assignments
    .filter((a) => a.targetId === station.id && !a.isOutsourced)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  const immobile: TaskAssignment[] = [];
  const movable: TaskAssignment[] = [];
  const frozen: TaskAssignment[] = [];
  const horizonEnd = new Date(now.getTime() + horizonMs);

  for (const a of stationAssignments) {
    const start = new Date(a.scheduledStart);
    if (start < now) {
      immobile.push(a);
    } else if (start <= horizonEnd) {
      movable.push(a);
    } else {
      frozen.push(a);
    }
  }

  return { station, category, immobile, movable, frozen };
}

// ============================================================================
// Phase 1 — Similarity-Optimal Ordering
// ============================================================================

function buildTileBlocks(
  movable: TaskAssignment[],
  taskMap: Map<string, Task>,
  elementMap: Map<string, Element>,
  jobMap: Map<string, Job>,
): TileBlock[] {
  // Group assignments by splitGroupId (split parts form one block)
  const splitGroups = new Map<string, TaskAssignment[]>();
  const singles: TaskAssignment[] = [];

  for (const a of movable) {
    const task = taskMap.get(a.taskId);
    if (task?.type === 'Internal') {
      const splitGroupId = (task as InternalTask).splitGroupId;
      if (splitGroupId) {
        const group = splitGroups.get(splitGroupId) ?? [];
        group.push(a);
        splitGroups.set(splitGroupId, group);
      } else {
        singles.push(a);
      }
    } else {
      singles.push(a);
    }
  }

  const blocks: TileBlock[] = [];

  // Single tiles
  for (const a of singles) {
    const task = taskMap.get(a.taskId);
    if (!task || task.type !== 'Internal') continue;
    const internalTask = task as InternalTask;
    const element = elementMap.get(task.elementId);
    const job = element ? jobMap.get(element.jobId) : undefined;

    blocks.push({
      assignments: [a],
      tasks: [internalTask],
      spec: element?.spec ?? undefined,
      elementId: task.elementId,
      minSequenceOrder: task.sequenceOrder,
      workshopExitDate: job?.workshopExitDate,
      splitGroupId: undefined,
    });
  }

  // Split groups
  for (const [groupId, assignments] of splitGroups) {
    const tasks = assignments
      .map((a) => taskMap.get(a.taskId))
      .filter((t): t is InternalTask => t?.type === 'Internal')
      .sort(compareTaskOrder);

    if (tasks.length === 0) continue;

    // Sort assignments to match task order
    const taskIdOrder = new Map(tasks.map((t, i) => [t.id, i]));
    const sortedAssignments = [...assignments].sort(
      (a, b) => (taskIdOrder.get(a.taskId) ?? 0) - (taskIdOrder.get(b.taskId) ?? 0)
    );

    const element = elementMap.get(tasks[0].elementId);
    const job = element ? jobMap.get(element.jobId) : undefined;

    blocks.push({
      assignments: sortedAssignments,
      tasks,
      spec: element?.spec ?? undefined,
      elementId: tasks[0].elementId,
      minSequenceOrder: Math.min(...tasks.map((t) => t.sequenceOrder)),
      workshopExitDate: job?.workshopExitDate,
      splitGroupId: groupId,
    });
  }

  return blocks;
}

/**
 * Count matched similarity criteria between two specs.
 */
function similarityScore(
  specA: ElementSpec | undefined,
  specB: ElementSpec | undefined,
  criteria: SimilarityCriterion[],
): number {
  if (!specA || !specB) return 0;
  return compareSimilarity(specA, specB, criteria).filter((r) => r.isMatched).length;
}

/**
 * Compute total similarity score for a sequence of blocks (sum of consecutive pair scores).
 */
function totalSimilarityScore(
  blocks: TileBlock[],
  criteria: SimilarityCriterion[],
  anchorSpec: ElementSpec | undefined,
): number {
  if (blocks.length === 0) return 0;

  let total = 0;
  // Score between anchor and first block
  if (anchorSpec) {
    total += similarityScore(anchorSpec, blocks[0].spec, criteria);
  }
  // Score between consecutive blocks
  for (let i = 1; i < blocks.length; i++) {
    total += similarityScore(blocks[i - 1].spec, blocks[i].spec, criteria);
  }
  return total;
}

/**
 * Check if all same-station, same-element predecessors of a block are already placed.
 * This preserves intra-element ordering (sequenceOrder).
 */
function canPlace(
  block: TileBlock,
  placedElementOrders: Map<string, number[]>,
  allBlocks: TileBlock[],
): boolean {
  // Find all blocks with the same elementId that have lower sequenceOrder
  const sameElementBlocks = allBlocks.filter(
    (b) => b !== block && b.elementId === block.elementId && b.minSequenceOrder < block.minSequenceOrder
  );

  // All such predecessors must already be placed
  const placedOrders = placedElementOrders.get(block.elementId) ?? [];
  return sameElementBlocks.every((pred) =>
    placedOrders.includes(pred.minSequenceOrder)
  );
}

/**
 * Greedy nearest-neighbor ordering for a station's movable blocks.
 */
function reorderBySimilarity(
  blocks: TileBlock[],
  criteria: SimilarityCriterion[],
  anchorSpec: ElementSpec | undefined,
): TileBlock[] {
  if (blocks.length <= 1) return blocks;

  const result: TileBlock[] = [];
  const remaining = new Set(blocks);
  const placedElementOrders = new Map<string, number[]>();

  let lastSpec = anchorSpec;

  while (remaining.size > 0) {
    let bestBlock: TileBlock | null = null;
    let bestScore = -1;
    let bestDeadline: Date | null = null;

    for (const candidate of remaining) {
      // Check intra-element ordering constraint
      if (!canPlace(candidate, placedElementOrders, blocks)) continue;

      const score = similarityScore(lastSpec, candidate.spec, criteria);

      // Pick highest similarity; tie-break by earlier workshopExitDate
      const candidateDeadline = candidate.workshopExitDate
        ? getDeadlineDate(candidate.workshopExitDate)
        : null;

      if (
        score > bestScore ||
        (score === bestScore && candidateDeadline && bestDeadline && candidateDeadline < bestDeadline) ||
        (score === bestScore && candidateDeadline && !bestDeadline)
      ) {
        bestBlock = candidate;
        bestScore = score;
        bestDeadline = candidateDeadline;
      }
    }

    if (!bestBlock) {
      // All remaining blocks are constrained — place them in original order
      const sorted = [...remaining].sort((a, b) => {
        const aIdx = blocks.indexOf(a);
        const bIdx = blocks.indexOf(b);
        return aIdx - bIdx;
      });
      result.push(...sorted);
      break;
    }

    result.push(bestBlock);
    remaining.delete(bestBlock);

    // Track placed ordering for intra-element constraint
    const orders = placedElementOrders.get(bestBlock.elementId) ?? [];
    orders.push(bestBlock.minSequenceOrder);
    placedElementOrders.set(bestBlock.elementId, orders);

    lastSpec = bestBlock.spec;
  }

  return result;
}

/**
 * Get the anchor spec: the element spec of the last immobile tile on this station.
 */
function getAnchorSpec(
  immobile: TaskAssignment[],
  taskMap: Map<string, Task>,
  elementMap: Map<string, Element>,
): ElementSpec | undefined {
  if (immobile.length === 0) return undefined;
  const lastImmobile = immobile[immobile.length - 1];
  const task = taskMap.get(lastImmobile.taskId);
  if (!task) return undefined;
  const element = elementMap.get(task.elementId);
  return element?.spec ?? undefined;
}

// ============================================================================
// Phase 2 — Time Assignment via compactTimeline
// ============================================================================

/**
 * Apply the reordered blocks to the snapshot by setting synthetic scheduledStart
 * values that force compactTimeline to preserve our ordering.
 * Then call compactTimeline for correct time assignment.
 */
function applyReorderedTimeline(
  snapshot: ScheduleSnapshot,
  stationReorders: Map<string, TaskAssignment[]>,
  options: SmartCompactOptions,
): ScheduleSnapshot {
  // Build a map of taskId → new synthetic start for reordered assignments
  const syntheticStarts = new Map<string, string>();
  const now = options.now ?? new Date();
  const snappedNow = roundToNearestQuarterHour(now);

  for (const [, reorderedAssignments] of stationReorders) {
    // Set synthetic starts: snappedNow + index * 1ms to preserve order
    // Must be >= snappedNow so compactTimeline treats them as movable
    for (let i = 0; i < reorderedAssignments.length; i++) {
      const syntheticStart = new Date(snappedNow.getTime() + i);
      syntheticStarts.set(reorderedAssignments[i].taskId, syntheticStart.toISOString());
    }
  }

  // Apply synthetic starts to snapshot
  const reorderedAssignments = snapshot.assignments.map((a) => {
    const syntheticStart = syntheticStarts.get(a.taskId);
    if (syntheticStart) {
      return { ...a, scheduledStart: syntheticStart };
    }
    return a;
  });

  const reorderedSnapshot = { ...snapshot, assignments: reorderedAssignments };

  // Now call compactTimeline which handles: precedence-aware earliest start,
  // drying time, working hours snapping, quarter-hour boundaries
  const result = compactTimeline({
    snapshot: reorderedSnapshot,
    horizonHours: options.horizonHours,
    now: options.now,
    calculateEndTime: options.calculateEndTime,
  });

  return result.snapshot;
}

// ============================================================================
// Phase 3 — Deadline Validation & Rollback
// ============================================================================

interface RollbackResult {
  snapshot: ScheduleSnapshot;
  rollbackCount: number;
}

/**
 * Check if any job that was previously on-time is now late.
 * If so, revert that job's tiles to original positions.
 */
function validateDeadlines(
  originalSnapshot: ScheduleSnapshot,
  newSnapshot: ScheduleSnapshot,
  options: SmartCompactOptions,
): RollbackResult {
  const jobMap = new Map(newSnapshot.jobs.map((j) => [j.id, j]));
  const elementMap = new Map(newSnapshot.elements.map((e) => [e.id, e]));
  const taskMap = new Map(newSnapshot.tasks.map((t) => [t.id, t]));

  // Build task→job mapping
  const taskToJob = new Map<string, string>();
  for (const element of newSnapshot.elements) {
    for (const taskId of element.taskIds) {
      taskToJob.set(taskId, element.jobId);
    }
  }

  // Find jobs with moved tiles
  const movedJobIds = new Set<string>();
  for (const newAssignment of newSnapshot.assignments) {
    const origAssignment = originalSnapshot.assignments.find((a) => a.taskId === newAssignment.taskId);
    if (origAssignment && origAssignment.scheduledStart !== newAssignment.scheduledStart) {
      const jobId = taskToJob.get(newAssignment.taskId);
      if (jobId) movedJobIds.add(jobId);
    }
  }

  // For each moved job, check if it was on-time before but late now
  const jobsToRollback = new Set<string>();

  for (const jobId of movedJobIds) {
    const job = jobMap.get(jobId);
    if (!job?.workshopExitDate) continue;

    const deadline = getDeadlineDate(job.workshopExitDate);

    // Get the job's last task end time in both snapshots
    const jobLastEndOriginal = getJobLastEndTime(jobId, originalSnapshot, elementMap, taskMap);
    const jobLastEndNew = getJobLastEndTime(jobId, newSnapshot, elementMap, taskMap);

    if (!jobLastEndOriginal || !jobLastEndNew) continue;

    const wasOnTime = jobLastEndOriginal <= deadline;
    const isNowLate = jobLastEndNew > deadline;

    if (wasOnTime && isNowLate) {
      jobsToRollback.add(jobId);
    }
  }

  if (jobsToRollback.size === 0) {
    return { snapshot: newSnapshot, rollbackCount: 0 };
  }

  // Revert rolled-back jobs' tiles to original positions
  let rollbackCount = 0;
  const rolledBackAssignments = newSnapshot.assignments.map((a) => {
    const jobId = taskToJob.get(a.taskId);
    if (jobId && jobsToRollback.has(jobId)) {
      const origAssignment = originalSnapshot.assignments.find((o) => o.taskId === a.taskId);
      if (origAssignment && origAssignment.scheduledStart !== a.scheduledStart) {
        rollbackCount++;
        return { ...a, scheduledStart: origAssignment.scheduledStart, scheduledEnd: origAssignment.scheduledEnd };
      }
    }
    return a;
  });

  // Re-run compactTimeline on the snapshot with rolled-back tiles
  const rolledBackSnapshot = { ...newSnapshot, assignments: rolledBackAssignments };
  const recompacted = compactTimeline({
    snapshot: rolledBackSnapshot,
    horizonHours: options.horizonHours,
    now: options.now,
    calculateEndTime: options.calculateEndTime,
  });

  return { snapshot: recompacted.snapshot, rollbackCount };
}

/**
 * Get the latest scheduledEnd among all of a job's assigned tasks.
 */
function getJobLastEndTime(
  jobId: string,
  snapshot: ScheduleSnapshot,
  elementMap: Map<string, Element>,
  taskMap: Map<string, Task>,
): Date | null {
  const jobElements = snapshot.elements.filter((e) => e.jobId === jobId);
  let latest: Date | null = null;

  for (const element of jobElements) {
    for (const taskId of element.taskIds) {
      const assignment = snapshot.assignments.find((a) => a.taskId === taskId);
      if (assignment) {
        const end = new Date(assignment.scheduledEnd);
        if (!latest || end > latest) {
          latest = end;
        }
      }
    }
  }

  return latest;
}

// ============================================================================
// Main: Async Generator for UI Progress
// ============================================================================

/**
 * Run smart compaction as an async generator, yielding progress events.
 */
export async function* runSmartCompact(
  options: SmartCompactOptions,
): AsyncGenerator<SmartCompactProgress> {
  const { snapshot, horizonHours } = options;
  const now = roundToNearestQuarterHour(options.now ?? new Date());
  const horizonMs = horizonHours * 60 * 60 * 1000;

  // Build lookup maps
  const taskMap = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const elementMap = new Map(snapshot.elements.map((e) => [e.id, e]));
  const jobMap = new Map(snapshot.jobs.map((j) => [j.id, j]));
  const categoryMap = new Map(snapshot.categories.map((c) => [c.id, c]));

  // Phase 0 — Analyze
  yield { phase: 'analyze', message: 'Analyzing schedule' };
  await new Promise((r) => setTimeout(r, 0));

  // Partition tiles for each station
  const partitions: StationPartition[] = [];
  const stationsWithMovable: StationPartition[] = [];

  for (const station of snapshot.stations) {
    const partition = partitionStationTiles(station, snapshot, now, horizonMs, categoryMap);
    partitions.push(partition);
    if (partition.movable.length > 1) {
      // Need at least 2 movable tiles to reorder
      stationsWithMovable.push(partition);
    }
  }

  // Phase 1 — Reorder each station
  const stationReorders = new Map<string, TaskAssignment[]>();
  const stationResults: StationCompactResult[] = [];
  let totalSimilarityBefore = 0;
  let totalSimilarityAfter = 0;
  let totalReordered = 0;

  for (let i = 0; i < stationsWithMovable.length; i++) {
    const partition = stationsWithMovable[i];
    const criteria = partition.category?.similarityCriteria ?? [];

    yield {
      phase: 'reorder',
      stationName: partition.station.name,
      stationIndex: i,
      totalStations: stationsWithMovable.length,
    };
    await new Promise((r) => setTimeout(r, 0));

    // Skip stations without similarity criteria
    if (criteria.length === 0) {
      stationResults.push({
        stationId: partition.station.id,
        stationName: partition.station.name,
        movableCount: partition.movable.length,
        reorderedCount: 0,
        similarityBefore: 0,
        similarityAfter: 0,
      });
      continue;
    }

    // Build tile blocks
    const blocks = buildTileBlocks(partition.movable, taskMap, elementMap, jobMap);
    const anchorSpec = getAnchorSpec(partition.immobile, taskMap, elementMap);

    // Compute similarity before reordering
    const simBefore = totalSimilarityScore(blocks, criteria, anchorSpec);

    // Reorder using greedy nearest-neighbor
    const reordered = reorderBySimilarity(blocks, criteria, anchorSpec);

    // Compute similarity after reordering
    const simAfter = totalSimilarityScore(reordered, criteria, anchorSpec);

    // Flatten reordered blocks back to assignments
    const reorderedAssignments = reordered.flatMap((b) => b.assignments);

    // Count how many tiles actually changed position
    let stationReorderedCount = 0;
    for (let j = 0; j < reorderedAssignments.length; j++) {
      if (reorderedAssignments[j].taskId !== partition.movable[j]?.taskId) {
        stationReorderedCount++;
      }
    }

    if (stationReorderedCount > 0) {
      stationReorders.set(partition.station.id, reorderedAssignments);
    }

    totalSimilarityBefore += simBefore;
    totalSimilarityAfter += simAfter;
    totalReordered += stationReorderedCount;

    stationResults.push({
      stationId: partition.station.id,
      stationName: partition.station.name,
      movableCount: partition.movable.length,
      reorderedCount: stationReorderedCount,
      similarityBefore: simBefore,
      similarityAfter: simAfter,
    });
  }

  // Phase 2 — Time assignment via compactTimeline
  yield { phase: 'validate', message: 'Assigning times and validating constraints' };
  await new Promise((r) => setTimeout(r, 0));

  let finalSnapshot: ScheduleSnapshot;
  let rollbackCount = 0;

  if (stationReorders.size > 0) {
    // Apply reordered tiles and run compactTimeline
    const reorderedSnapshot = applyReorderedTimeline(snapshot, stationReorders, options);

    // Phase 3 — Deadline validation & rollback
    const rollbackResult = validateDeadlines(snapshot, reorderedSnapshot, options);
    finalSnapshot = rollbackResult.snapshot;
    rollbackCount = rollbackResult.rollbackCount;
  } else {
    // No reordering needed — just run plain compactTimeline for gap-closing
    const result = compactTimeline({
      snapshot,
      horizonHours,
      now: options.now,
      calculateEndTime: options.calculateEndTime,
    });
    finalSnapshot = result.snapshot;
  }

  // Count total moved tiles
  let movedCount = 0;
  for (const newAssignment of finalSnapshot.assignments) {
    const origAssignment = snapshot.assignments.find((a) => a.taskId === newAssignment.taskId);
    if (origAssignment && origAssignment.scheduledStart !== newAssignment.scheduledStart) {
      movedCount++;
    }
  }

  // Phase 4 — Apply
  yield { phase: 'apply', message: 'Applying changes' };
  await new Promise((r) => setTimeout(r, 0));

  const result: SmartCompactResult = {
    snapshot: finalSnapshot,
    movedCount,
    reorderedCount: totalReordered,
    similarityBefore: totalSimilarityBefore,
    similarityAfter: totalSimilarityAfter,
    rollbackCount,
    stationResults,
  };

  yield { phase: 'complete', result };
}

// ============================================================================
// Exports for testing
// ============================================================================

export {
  partitionStationTiles,
  buildTileBlocks,
  reorderBySimilarity,
  similarityScore,
  totalSimilarityScore,
  getAnchorSpec,
  getJobLastEndTime,
};
export type { StationPartition, TileBlock };

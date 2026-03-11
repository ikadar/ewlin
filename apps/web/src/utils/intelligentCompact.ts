/**
 * Intelligent Compaction: Similarity-Aware Tile Reordering
 *
 * Reorders tiles on each station to maximize similarity between consecutive tiles,
 * subject to deadline, precedence, and operating hours constraints.
 *
 * Algorithm:
 * 1. Compute time windows (forward + backward pass)
 * 2. Partition each station into segments around immobile tiles
 * 3. Greedy nearest-neighbor construction per segment
 * 4. Adjacent-swap local improvement per segment
 * 5. Compact gaps (standard compaction)
 * 6. Cascade repair for cross-station precedence
 */

import type {
  ScheduleSnapshot,
  TaskAssignment,
  Task,
  Station,
  InternalTask,
  Element,
  ElementSpec,
  SimilarityCriterion,
  StationCategory,
} from '@flux/types';
import { DRY_TIME_MS } from '@flux/types';
import { compareSimilarity } from '../components/Tile/similarityUtils';
import { isPrintingStation } from './precedenceConstraints';
import { snapToNextWorkingTime, addWorkingTime } from './workingTime';
import { getElementTasks } from './taskHelpers';
import { computeTimeWindows } from './timeWindows';
import type { CompactHorizon } from '../constants';

export interface IntelligentCompactOptions {
  snapshot: ScheduleSnapshot;
  horizonHours: CompactHorizon;
  now?: Date;
  calculateEndTime: (task: InternalTask, start: string, station: Station | undefined) => string;
  /** Similarity vs urgency weight. 0.0 = urgency only, 1.0 = similarity only. Default: 0.7 */
  alpha?: number;
}

export interface IntelligentCompactResult {
  snapshot: ScheduleSnapshot;
  movedCount: number;
  reorderedCount: number;
  skippedCount: number;
  similarityBefore: number;
  similarityAfter: number;
}

interface TileInfo {
  assignment: TaskAssignment;
  task: Task;
  element: Element;
  spec: ElementSpec | undefined;
  durationMs: number;
}

interface Segment {
  /** Left time bound (end of previous frozen tile or now) */
  leftBound: number;
  /** Right time bound (start of next frozen tile or horizon end) */
  rightBound: number;
  /** Spec of the tile just before this segment (or undefined) */
  anchorSpec: ElementSpec | undefined;
  /** Movable tiles in this segment (original order) */
  tiles: TileInfo[];
}

// ============================================================================
// Helpers
// ============================================================================

function snapToQuarterHour(date: Date): Date {
  const snapped = new Date(date);
  const minutes = snapped.getMinutes();
  const remainder = minutes % 15;
  if (remainder > 0) {
    snapped.setMinutes(minutes + (15 - remainder), 0, 0);
  } else {
    snapped.setSeconds(0, 0);
  }
  return snapped;
}

function isTaskImmobile(assignment: TaskAssignment, now: Date): boolean {
  return new Date(assignment.scheduledStart) < now;
}

function isWithinHorizon(assignment: TaskAssignment, now: Date, horizonMs: number): boolean {
  const start = new Date(assignment.scheduledStart);
  const horizonEnd = new Date(now.getTime() + horizonMs);
  return start >= now && start <= horizonEnd;
}

function getTaskDurationMs(task: Task): number {
  if (task.type !== 'Internal') return 0;
  return (task.duration.setupMinutes + task.duration.runMinutes) * 60 * 1000;
}

function getStationCategory(
  snapshot: ScheduleSnapshot,
  station: Station
): StationCategory | undefined {
  return snapshot.categories.find((c) => c.id === station.categoryId);
}

function getSimilarityCriteria(
  snapshot: ScheduleSnapshot,
  station: Station
): SimilarityCriterion[] {
  const category = getStationCategory(snapshot, station);
  return category?.similarityCriteria ?? [];
}

function getElementForTask(task: Task, elements: Element[]): Element | undefined {
  return elements.find((e) => e.id === task.elementId);
}

/**
 * Compute similarity score [0, 1] between two specs using the given criteria.
 */
function similarityScore(
  specA: ElementSpec | undefined,
  specB: ElementSpec | undefined,
  criteria: SimilarityCriterion[]
): number {
  if (!specA || !specB || criteria.length === 0) return 0;
  const results = compareSimilarity(specA, specB, criteria);
  return results.filter((r) => r.isMatched).length / results.length;
}

/**
 * Compute urgency score [0, 1]. Higher = more urgent.
 */
function urgencyScore(latestStart: number, nowMs: number, horizonMs: number): number {
  const slack = latestStart - nowMs;
  if (slack <= 0) return 1.0;
  return 1.0 - Math.min(slack / horizonMs, 1.0);
}

/**
 * Compute total similarity score across all stations.
 */
export function computeTotalSimilarity(snapshot: ScheduleSnapshot): number {
  let totalScore = 0;
  let totalPairs = 0;

  for (const station of snapshot.stations) {
    const criteria = getSimilarityCriteria(snapshot, station);
    if (criteria.length === 0) continue;

    const stationAssignments = snapshot.assignments
      .filter((a) => a.targetId === station.id && !a.isOutsourced)
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

    const taskMap = new Map(snapshot.tasks.map((t) => [t.id, t]));

    for (let i = 0; i < stationAssignments.length - 1; i++) {
      const taskA = taskMap.get(stationAssignments[i].taskId);
      const taskB = taskMap.get(stationAssignments[i + 1].taskId);
      if (!taskA || !taskB) continue;

      const elemA = getElementForTask(taskA, snapshot.elements);
      const elemB = getElementForTask(taskB, snapshot.elements);

      totalScore += similarityScore(elemA?.spec, elemB?.spec, criteria);
      totalPairs++;
    }
  }

  return totalPairs > 0 ? totalScore / totalPairs : 0;
}

// ============================================================================
// Segment Partitioning
// ============================================================================

/**
 * Partition a station's assignments into segments around immobile tiles.
 */
function partitionIntoSegments(
  stationAssignments: TaskAssignment[],
  snapshot: ScheduleSnapshot,
  now: Date,
  horizonMs: number
): Segment[] {
  const taskMap = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const sorted = [...stationAssignments].sort(
    (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
  );

  const segments: Segment[] = [];
  let currentSegmentTiles: TileInfo[] = [];
  let leftBound = now.getTime();
  let anchorSpec: ElementSpec | undefined = undefined;

  for (const assignment of sorted) {
    const task = taskMap.get(assignment.taskId);
    if (!task || task.type !== 'Internal') continue;

    const element = getElementForTask(task, snapshot.elements);
    if (!element) continue;

    const tile: TileInfo = {
      assignment,
      task,
      element,
      spec: element.spec,
      durationMs: getTaskDurationMs(task),
    };

    if (isTaskImmobile(assignment, now)) {
      // Frozen tile: close current segment, then this tile becomes anchor
      if (currentSegmentTiles.length > 0) {
        segments.push({
          leftBound,
          rightBound: new Date(assignment.scheduledStart).getTime(),
          anchorSpec,
          tiles: currentSegmentTiles,
        });
        currentSegmentTiles = [];
      }
      leftBound = new Date(assignment.scheduledEnd).getTime();
      anchorSpec = element.spec;
    } else if (!isWithinHorizon(assignment, now, horizonMs)) {
      // Outside horizon: acts as right boundary for current segment
      if (currentSegmentTiles.length > 0) {
        segments.push({
          leftBound,
          rightBound: new Date(assignment.scheduledStart).getTime(),
          anchorSpec,
          tiles: currentSegmentTiles,
        });
        currentSegmentTiles = [];
      }
      // Don't update leftBound or anchorSpec — tiles outside horizon are not touched
      break;
    } else {
      currentSegmentTiles.push(tile);
    }
  }

  // Close the last segment
  if (currentSegmentTiles.length > 0) {
    segments.push({
      leftBound,
      rightBound: now.getTime() + horizonMs + 365 * 24 * 60 * 60 * 1000, // effectively no right limit
      anchorSpec,
      tiles: currentSegmentTiles,
    });
  }

  return segments;
}

// ============================================================================
// Phase 2: Greedy Construction
// ============================================================================

function greedyConstruct(
  segment: Segment,
  criteria: SimilarityCriterion[],
  timeWindows: Map<string, { earliestStart: number; latestEnd: number }>,
  station: Station,
  snapshot: ScheduleSnapshot,
  nowMs: number,
  horizonMs: number,
  alpha: number
): TileInfo[] {
  if (segment.tiles.length <= 1) return [...segment.tiles];

  const remaining = new Set(segment.tiles);
  const sequence: TileInfo[] = [];
  let currentTime = segment.leftBound;
  let currentSpec = segment.anchorSpec;
  // Track original order for tie-breaking (preserve stability)
  const originalIndex = new Map(segment.tiles.map((t, i) => [t.task.id, i]));

  while (remaining.size > 0) {
    // 1. Find feasible candidates
    const candidates = [...remaining].filter((tile) => {
      const tw = timeWindows.get(tile.task.id);
      if (!tw) return true; // No window info = allow placement
      const start = Math.max(currentTime, tw.earliestStart);
      const snapped = snapToNextWorkingTime(new Date(start), station).getTime();
      const end = addWorkingTime(new Date(snapped), tile.durationMs, station).getTime();
      return end <= tw.latestEnd;
    });

    if (candidates.length === 0) {
      // SAFETY: no tile fits → return original order
      return [...segment.tiles];
    }

    // 2. Check for critical tiles (must go now)
    const critical = candidates.filter((tile) => {
      const tw = timeWindows.get(tile.task.id);
      if (!tw) return false;
      const latestStart = tw.latestEnd - tile.durationMs;
      return latestStart <= currentTime;
    });

    let best: TileInfo;
    if (critical.length > 0) {
      // Place most urgent critical tile (earliest deadline first)
      best = critical.reduce((a, b) => {
        const aEnd = timeWindows.get(a.task.id)?.latestEnd ?? Infinity;
        const bEnd = timeWindows.get(b.task.id)?.latestEnd ?? Infinity;
        return aEnd <= bEnd ? a : b;
      });
    } else {
      // 3. Score by similarity + urgency
      best = candidates.reduce((bestSoFar, tile) => {
        const sim = similarityScore(currentSpec, tile.spec, criteria);
        const tw = timeWindows.get(tile.task.id);
        const ls = tw ? tw.latestEnd - tile.durationMs : Infinity;
        const urg = urgencyScore(ls, nowMs, horizonMs);
        const score = alpha * sim + (1 - alpha) * urg;

        const bestSim = similarityScore(currentSpec, bestSoFar.spec, criteria);
        const bestTw = timeWindows.get(bestSoFar.task.id);
        const bestLs = bestTw ? bestTw.latestEnd - bestSoFar.durationMs : Infinity;
        const bestUrg = urgencyScore(bestLs, nowMs, horizonMs);
        const bestScore = alpha * bestSim + (1 - alpha) * bestUrg;

        if (score > bestScore) return tile;
        // Tie-break: prefer original order for stability
        if (score === bestScore) {
          const tileIdx = originalIndex.get(tile.task.id) ?? Infinity;
          const bestIdx = originalIndex.get(bestSoFar.task.id) ?? Infinity;
          return tileIdx < bestIdx ? tile : bestSoFar;
        }
        return bestSoFar;
      });
    }

    // 4. Place the tile
    sequence.push(best);
    remaining.delete(best);

    const tw = timeWindows.get(best.task.id);
    const start = Math.max(currentTime, tw?.earliestStart ?? currentTime);
    const snapped = snapToNextWorkingTime(new Date(start), station).getTime();
    currentTime = addWorkingTime(new Date(snapped), best.durationMs, station).getTime();
    currentSpec = best.spec;
  }

  return sequence;
}

// ============================================================================
// Phase 3: Adjacent-Swap Improvement
// ============================================================================

function isFeasibleOrder(
  sequence: TileInfo[],
  timeWindows: Map<string, { earliestStart: number; latestEnd: number }>,
  segment: Segment,
  station: Station,
  _snapshot: ScheduleSnapshot
): boolean {
  let currentTime = segment.leftBound;

  for (const tile of sequence) {
    const tw = timeWindows.get(tile.task.id);
    const start = Math.max(currentTime, tw?.earliestStart ?? currentTime);
    const snapped = snapToNextWorkingTime(new Date(start), station).getTime();
    const end = addWorkingTime(new Date(snapped), tile.durationMs, station).getTime();

    if (tw && end > tw.latestEnd) return false;
    if (end > segment.rightBound) return false;

    currentTime = end;
  }

  return true;
}

function improveBySwaps(
  sequence: TileInfo[],
  criteria: SimilarityCriterion[],
  timeWindows: Map<string, { earliestStart: number; latestEnd: number }>,
  segment: Segment,
  station: Station,
  snapshot: ScheduleSnapshot
): TileInfo[] {
  let result = [...sequence];
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i];
      const b = result[i + 1];

      const prevSpec = i > 0 ? result[i - 1].spec : segment.anchorSpec;
      const nextSpec = i + 2 < result.length ? result[i + 2].spec : undefined;

      const oldScore =
        similarityScore(prevSpec, a.spec, criteria) +
        similarityScore(a.spec, b.spec, criteria) +
        (nextSpec !== undefined ? similarityScore(b.spec, nextSpec, criteria) : 0);

      const newScore =
        similarityScore(prevSpec, b.spec, criteria) +
        similarityScore(b.spec, a.spec, criteria) +
        (nextSpec !== undefined ? similarityScore(a.spec, nextSpec, criteria) : 0);

      if (newScore > oldScore) {
        const candidate = [...result];
        candidate[i] = b;
        candidate[i + 1] = a;
        if (isFeasibleOrder(candidate, timeWindows, segment, station, snapshot)) {
          result = candidate;
          improved = true;
          break; // restart scan
        }
      }
    }
  }

  return result;
}

// ============================================================================
// Phase 5: Cascade Repair
// ============================================================================

/**
 * After reordering, recompute cross-station precedence.
 * Push affected downstream tasks forward if needed.
 */
function cascadeRepair(
  snapshot: ScheduleSnapshot,
  calculateEndTime: (task: InternalTask, start: string, station: Station | undefined) => string
): ScheduleSnapshot {
  const taskMap = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const stationMap = new Map(snapshot.stations.map((s) => [s.id, s]));
  const elementMap = new Map(snapshot.elements.map((e) => [e.id, e]));
  const updatedAssignments = new Map(
    snapshot.assignments.map((a) => [a.id, { ...a }])
  );

  const maxIterations = 3;
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let changed = false;

    for (const assignment of updatedAssignments.values()) {
      if (assignment.isOutsourced) continue;

      const task = taskMap.get(assignment.taskId);
      if (!task || task.type !== 'Internal') continue;

      const element = elementMap.get(task.elementId);
      if (!element) continue;

      // Compute earliest start from predecessors
      let earliestStart = new Date(assignment.scheduledStart).getTime();
      let constrainedBy: number | null = null;

      // Intra-element predecessor
      const elementTasks = getElementTasks(element.id, snapshot.tasks);
      const taskIndex = elementTasks.findIndex((t) => t.id === task.id);
      if (taskIndex > 0) {
        const pred = elementTasks[taskIndex - 1];
        const predAssignment = [...updatedAssignments.values()].find(
          (a) => a.taskId === pred.id
        );
        if (predAssignment) {
          let predEnd = new Date(predAssignment.scheduledEnd).getTime();
          if (isPrintingStation(snapshot, predAssignment.targetId)) {
            predEnd += DRY_TIME_MS;
          }
          if (predEnd > (constrainedBy ?? 0)) constrainedBy = predEnd;
        }
      }

      // Cross-element predecessors
      if (taskIndex === 0 && element.prerequisiteElementIds.length > 0) {
        for (const prereqElemId of element.prerequisiteElementIds) {
          const prereqTasks = getElementTasks(prereqElemId, snapshot.tasks);
          if (prereqTasks.length === 0) continue;
          const lastTask = prereqTasks[prereqTasks.length - 1];
          const lastAssignment = [...updatedAssignments.values()].find(
            (a) => a.taskId === lastTask.id
          );
          if (lastAssignment) {
            let predEnd = new Date(lastAssignment.scheduledEnd).getTime();
            if (!lastAssignment.isOutsourced && isPrintingStation(snapshot, lastAssignment.targetId)) {
              predEnd += DRY_TIME_MS;
            }
            if (predEnd > (constrainedBy ?? 0)) constrainedBy = predEnd;
          }
        }
      }

      if (constrainedBy !== null && constrainedBy > earliestStart) {
        // Need to push this task forward
        const station = stationMap.get(assignment.targetId);
        const newStart = station
          ? snapToNextWorkingTime(new Date(constrainedBy), station)
          : new Date(constrainedBy);

        const newEnd = calculateEndTime(
          task as InternalTask,
          newStart.toISOString(),
          station
        );

        const existing = updatedAssignments.get(assignment.id)!;
        existing.scheduledStart = newStart.toISOString();
        existing.scheduledEnd = newEnd;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return {
    ...snapshot,
    assignments: snapshot.assignments.map((a) => updatedAssignments.get(a.id) ?? a),
  };
}

// ============================================================================
// Station Processing Order
// ============================================================================

/**
 * Compute topological order of stations based on cross-element dependencies.
 * Upstream stations (press) should be processed before downstream (finishing).
 */
function getStationProcessingOrder(snapshot: ScheduleSnapshot): Station[] {
  const stationDeps = new Map<string, Set<string>>();
  for (const station of snapshot.stations) {
    stationDeps.set(station.id, new Set());
  }

  const taskMap = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const assignmentByTask = new Map(snapshot.assignments.map((a) => [a.taskId, a]));

  for (const element of snapshot.elements) {
    if (element.prerequisiteElementIds.length === 0) continue;

    // Get first task's station (downstream)
    const elemTasks = getElementTasks(element.id, snapshot.tasks);
    if (elemTasks.length === 0) continue;
    const firstTask = elemTasks[0];
    const firstAssignment = assignmentByTask.get(firstTask.id);
    if (!firstAssignment || firstAssignment.isOutsourced) continue;
    const downstreamStationId = firstAssignment.targetId;

    // Get last task stations of prerequisite elements (upstream)
    for (const prereqElemId of element.prerequisiteElementIds) {
      const prereqTasks = getElementTasks(prereqElemId, snapshot.tasks);
      if (prereqTasks.length === 0) continue;
      const lastTask = prereqTasks[prereqTasks.length - 1];
      const lastAssignment = assignmentByTask.get(lastTask.id);
      if (!lastAssignment || lastAssignment.isOutsourced) continue;
      const upstreamStationId = lastAssignment.targetId;

      if (upstreamStationId !== downstreamStationId) {
        stationDeps.get(downstreamStationId)?.add(upstreamStationId);
      }
    }
  }

  // Topological sort of stations
  const visited = new Set<string>();
  const result: Station[] = [];
  const stationMap = new Map(snapshot.stations.map((s) => [s.id, s]));

  function visit(stationId: string) {
    if (visited.has(stationId)) return;
    visited.add(stationId);
    const deps = stationDeps.get(stationId);
    if (deps) {
      for (const dep of deps) visit(dep);
    }
    const station = stationMap.get(stationId);
    if (station) result.push(station);
  }

  for (const station of snapshot.stations) {
    visit(station.id);
  }

  return result;
}

// ============================================================================
// Main Algorithm
// ============================================================================

export function intelligentCompact(options: IntelligentCompactOptions): IntelligentCompactResult {
  const { snapshot, horizonHours, calculateEndTime } = options;
  const now = snapToQuarterHour(options.now ?? new Date());
  const horizonMs = horizonHours * 60 * 60 * 1000;
  const alpha = options.alpha ?? 0.7;

  // Compute similarity before
  const similarityBefore = computeTotalSimilarity(snapshot);

  // Phase 1: Compute time windows
  const { windows: timeWindows } = computeTimeWindows(snapshot, now);

  // Build simplified time window map for greedy/feasibility
  const twMap = new Map<string, { earliestStart: number; latestEnd: number }>();
  for (const [taskId, tw] of timeWindows) {
    twMap.set(taskId, { earliestStart: tw.earliestStart, latestEnd: tw.latestEnd });
  }

  // Get station processing order (upstream first)
  const stationsInOrder = getStationProcessingOrder(snapshot);

  let workingSnapshot = { ...snapshot, assignments: [...snapshot.assignments] };
  let movedCount = 0;
  let reorderedCount = 0;
  let skippedCount = 0;

  for (const station of stationsInOrder) {
    const criteria = getSimilarityCriteria(snapshot, station);

    // Skip stations with no similarity criteria
    if (criteria.length === 0) continue;

    // Skip stations in limited-capacity groups
    const group = snapshot.groups.find((g) => g.id === station.groupId);
    if (group && group.maxConcurrent !== null) continue;

    const stationAssignments = workingSnapshot.assignments.filter(
      (a) => a.targetId === station.id && !a.isOutsourced
    );

    if (stationAssignments.length < 2) continue;

    // Phase 1b: Partition into segments
    const segments = partitionIntoSegments(stationAssignments, workingSnapshot, now, horizonMs);

    for (const segment of segments) {
      if (segment.tiles.length <= 1) continue;

      // Phase 2: Greedy construction
      const greedyOrder = greedyConstruct(
        segment,
        criteria,
        twMap,
        station,
        workingSnapshot,
        now.getTime(),
        horizonMs,
        alpha
      );

      // Phase 3: Local improvement
      const improvedOrder = improveBySwaps(
        greedyOrder,
        criteria,
        twMap,
        segment,
        station,
        workingSnapshot
      );

      // Phase 4: Apply new order with compaction (remove gaps)
      const originalTaskIds = segment.tiles.map((t) => t.task.id);
      const newTaskIds = improvedOrder.map((t) => t.task.id);

      // Count reordered tiles
      for (let i = 0; i < originalTaskIds.length; i++) {
        if (originalTaskIds[i] !== newTaskIds[i]) {
          reorderedCount++;
        }
      }

      // Place tiles in new order, compacting as we go
      let currentTime = segment.leftBound;
      for (const tile of improvedOrder) {
        const tw = twMap.get(tile.task.id);
        const startMs = Math.max(currentTime, tw?.earliestStart ?? currentTime);
        const snappedStart = snapToNextWorkingTime(new Date(startMs), station);

        const newEnd = calculateEndTime(
          tile.task as InternalTask,
          snappedStart.toISOString(),
          station
        );

        // Update assignment in working snapshot
        const assignmentIndex = workingSnapshot.assignments.findIndex(
          (a) => a.id === tile.assignment.id
        );
        if (assignmentIndex >= 0) {
          const oldAssignment = workingSnapshot.assignments[assignmentIndex];
          const oldStart = oldAssignment.scheduledStart;

          workingSnapshot.assignments[assignmentIndex] = {
            ...oldAssignment,
            scheduledStart: snappedStart.toISOString(),
            scheduledEnd: newEnd,
            updatedAt: new Date().toISOString(),
          };

          if (snappedStart.toISOString() !== oldStart) {
            movedCount++;
          }
        }

        currentTime = new Date(newEnd).getTime();
      }
    }

    // Count skipped immobile tiles
    const immobileCount = stationAssignments.filter((a) => isTaskImmobile(a, now)).length;
    skippedCount += immobileCount;
  }

  // Phase 5: Cascade repair for cross-station effects
  workingSnapshot = cascadeRepair(workingSnapshot, calculateEndTime);

  // Compute similarity after
  const similarityAfter = computeTotalSimilarity(workingSnapshot);

  return {
    snapshot: workingSnapshot,
    movedCount,
    reorderedCount,
    skippedCount,
    similarityBefore,
    similarityAfter,
  };
}

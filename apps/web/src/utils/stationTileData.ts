import type {
  Station,
  StationCategory,
  Task,
  Job,
  Element,
  TaskAssignment,
  SimilarityScore,
} from '@flux/types';
import { isInternalTask } from '@flux/types';
import { compareSimilarity, computeTileState } from '../components/Tile';
import { timeToYPosition } from '../components/TimelineColumn';
import type { Collapse } from '../components/SchedulingGrid/collapseConfig';
import { getPrerequisiteBlockingInfo } from './prerequisites';
import { getTirageLabel } from './tileLabelResolver';
import { computeSimilarityScore } from './similarityScore';

export interface CachedTileData {
  jobId: string;
  element: Element | undefined;
  task: Task;
  job: Job;
  top: number;
  /** Collapse-aware pixel height — bottomY - topY through `timeToYPosition`. */
  height: number;
  similarityResults: ReturnType<typeof compareSimilarity> | undefined;
  /** Practicity score vs the previous tile on this station (Phase 2). */
  similarityScore: SimilarityScore | undefined;
  hasConflict: boolean;
  tileState: ReturnType<typeof computeTileState>;
  blocked: boolean;
  blockingInfo: ReturnType<typeof getPrerequisiteBlockingInfo> | undefined;
  tirageLabel: string | undefined;
  pixelsPerHour: number;
  operatorNames: string | undefined;
}

export interface ElementBlockingInfo {
  hasOffset: boolean;
  hasDieCutting: boolean;
  blocked: boolean;
  blockingInfo: ReturnType<typeof getPrerequisiteBlockingInfo> | undefined;
}

export interface ComputeTileDataCacheInput {
  assignmentsByStation: Map<string, TaskAssignment[]>;
  taskMap: Map<string, Task>;
  elementMap: Map<string, Element>;
  jobMap: Map<string, Job>;
  stationMap: Map<string, Station>;
  categoryMap: Map<string, StationCategory>;
  elementsByJobId: Map<string, Element[]>;
  elementBlockingCache: Map<string, ElementBlockingInfo>;
  assemblyStationIds: Set<string>;
  operatorNameMap: Map<string, string>;
  conflictTaskIds: Set<string>;
  shippedJobIds?: Set<string>;
  lateJobIds?: Set<string>;
  startHour: number;
  pixelsPerHour: number;
  startDate?: Date;
  now: Date;
  /** Optional list of collapse bands — when present, tile `top` uses the piecewise time→Y mapping. */
  collapses?: readonly Collapse[];
}

/**
 * Pre-compute per-tile render data for the station scheduling grid.
 * Pure function — keep all caller maps as inputs so both multi-column station view
 * and single-column focus view share one source of truth.
 */
export function computeTileDataCache(input: ComputeTileDataCacheInput): Map<string, CachedTileData> {
  const {
    assignmentsByStation, taskMap, elementMap, jobMap, stationMap, categoryMap,
    elementsByJobId, elementBlockingCache, assemblyStationIds, operatorNameMap,
    conflictTaskIds, shippedJobIds, lateJobIds, startHour, pixelsPerHour, startDate, now,
    collapses,
  } = input;

  const cache = new Map<string, CachedTileData>();

  for (const [stationId, stationAssignments] of assignmentsByStation) {
    const station = stationMap.get(stationId);
    const category = station ? categoryMap.get(station.categoryId) : undefined;
    const criteria = category?.similarityCriteria || [];

    stationAssignments.forEach((assignment, index) => {
      const task = taskMap.get(assignment.taskId);
      if (!task) return;
      const element = elementMap.get(task.elementId);
      const jobId = element?.jobId;
      const job = jobId ? jobMap.get(jobId) : undefined;
      if (!job || !isInternalTask(task)) return;

      const blocking = element ? elementBlockingCache.get(element.id) : undefined;
      const top = timeToYPosition(new Date(assignment.scheduledStart), startHour, pixelsPerHour, startDate, collapses);
      // Collapse-aware bottom — when the tile straddles a band, the span
      // here is smaller than the raw wall-clock duration. Without this,
      // Tile would self-compute a linear height and overflow past bands.
      const bottom = timeToYPosition(new Date(assignment.scheduledEnd), startHour, pixelsPerHour, startDate, collapses);
      const height = Math.max(bottom - top, 1);

      let similarityResults: ReturnType<typeof compareSimilarity> | undefined = undefined;
      let similarityScore: SimilarityScore | undefined = undefined;
      if (index > 0 && element?.spec) {
        const prevTask = taskMap.get(stationAssignments[index - 1].taskId);
        const prevElement = prevTask ? elementMap.get(prevTask.elementId) : undefined;
        if (prevElement?.spec && criteria.length > 0) {
          similarityResults = compareSimilarity(prevElement.spec, element.spec, criteria);
        }
        if (prevElement?.spec && category) {
          similarityScore = computeSimilarityScore(prevElement.spec, element.spec, category);
        }
      }

      const jobElements = elementsByJobId.get(job.id) ?? [];
      const rawTirageLabel = category && element
        ? getTirageLabel(category.name, element, job, jobElements, taskMap, assemblyStationIds)
        : '';

      const isJobShipped = shippedJobIds?.has(job.id) ?? false;
      const isJobLate = lateJobIds?.has(job.id) ?? false;
      const isTaskOverdue = !assignment.isCompleted && new Date(assignment.scheduledEnd) < now;
      const isLate = isJobLate || isTaskOverdue;
      const hasConflict = conflictTaskIds.has(task.id);
      const tileState = computeTileState(isJobShipped, isLate, hasConflict, blocking?.blocked ?? false, assignment.isCompleted);

      let operatorNames: string | undefined;
      if (assignment.operators && assignment.operators.length > 0 && operatorNameMap.size > 0) {
        operatorNames = assignment.operators
          .map(op => operatorNameMap.get(op.operatorId))
          .filter(Boolean)
          .join(', ') || undefined;
      }

      cache.set(assignment.id, {
        jobId: job.id, element, task, job, top, height,
        similarityResults,
        similarityScore,
        hasConflict, tileState,
        blocked: blocking?.blocked ?? false,
        blockingInfo: blocking?.blockingInfo,
        tirageLabel: rawTirageLabel || undefined,
        pixelsPerHour,
        operatorNames,
      });
    });
  }

  return cache;
}

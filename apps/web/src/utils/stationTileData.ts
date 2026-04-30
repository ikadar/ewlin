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
import { getTirageLabel, getProduitLabel } from './tileLabelResolver';
import { computeSimilarityScore } from './similarityScore';

/**
 * A calage overlay pre-computed in tile-local pixel space using the same
 * collapse-aware `timeToYPosition` mapping that produced the tile's own
 * height. Using linear `minutes × pixelsPerHour` inside `Tile` overflowed
 * past the rendered bottom whenever the tile straddled a collapse band
 * (e.g. an overnight tile with a lunch-time recalage rendered 400 px below
 * its own bottom and bled into the next tile's visual area).
 */
export interface CalageGeometry {
  kind: 'setup' | 'recalage';
  /** Offset from the tile's top, in collapse-aware pixels. */
  top: number;
  /** Height in collapse-aware pixels (min 4). */
  height: number;
}

/**
 * One sub-tile rendering geometry. Used when an assignment has been
 * chunk-split by the engine to route around an obstacle (typically a
 * safety-zone-frozen pin) inside its wall-clock envelope. Each chunk is
 * rendered as its own independent `<Tile>` so the gap between chunks is
 * naturally visible — without this, the merged envelope would visually
 * cover whatever sits in the gap.
 */
export interface ChunkGeometry {
  top: number;
  height: number;
  /** calageGeometries clipped to this chunk's bounds. */
  calageGeometries: readonly CalageGeometry[];
}

export interface CachedTileData {
  jobId: string;
  element: Element | undefined;
  task: Task;
  job: Job;
  top: number;
  /** Collapse-aware pixel height — bottomY - topY through `timeToYPosition`. */
  height: number;
  /**
   * Pre-computed calage overlays (initial setup + any recalages).
   * Each entry is already clamped within the tile's rendered bounds.
   */
  calageGeometries: readonly CalageGeometry[];
  /**
   * When the engine reports `assignment.activeWindows` (≥2 entries), this
   * field holds one geometry per window. Consumers render N independent
   * tiles instead of a single envelope so the gap stays visible.
   * Undefined for normal continuous tiles — the default `top`/`height`
   * apply.
   */
  chunks?: ChunkGeometry[];
  similarityResults: ReturnType<typeof compareSimilarity> | undefined;
  /** Practicity score vs the previous tile on this station (Phase 2). */
  similarityScore: SimilarityScore | undefined;
  /** Station category — drives SimilarityBadge's dynamic level derivation. */
  category: StationCategory | undefined;
  hasConflict: boolean;
  tileState: ReturnType<typeof computeTileState>;
  blocked: boolean;
  blockingInfo: ReturnType<typeof getPrerequisiteBlockingInfo> | undefined;
  tirageLabel: string | undefined;
  /**
   * Produit-mode label. Appends the element name (e.g. "CAH1") after the
   * client for multi-element jobs; falls back to `{reference} · {client}`
   * for single-element jobs to avoid the noise of trivial element names
   * like "ELT".
   */
  produitLabel: string;
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
  /**
   * Collapse bands list. REQUIRED — pass `[]` for contexts without bands
   * (focus view, single-day callers). Mirrors `timeToYPosition` so a
   * forgotten argument surfaces as a TypeScript error rather than a runtime
   * `undefined.length` crash inside the inner `timeToYPosition` calls.
   */
  collapses: readonly Collapse[];
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
      const scheduledStart = new Date(assignment.scheduledStart);
      const top = timeToYPosition(scheduledStart, startHour, pixelsPerHour, startDate, collapses);
      // Collapse-aware bottom — when the tile straddles a band, the span
      // here is smaller than the raw wall-clock duration. Without this,
      // Tile would self-compute a linear height and overflow past bands.
      const bottom = timeToYPosition(new Date(assignment.scheduledEnd), startHour, pixelsPerHour, startDate, collapses);
      const height = Math.max(bottom - top, 1);

      // Pre-compute calage overlays in tile-local, collapse-aware pixel space.
      // Using a linear minute→pixel conversion inside `Tile` silently positioned
      // recalage bands hundreds of pixels past the tile's rendered bottom
      // whenever a night/lunch collapse sat between `scheduledStart` and the
      // recalage — those orphan bands then bled into the visual area of the
      // tile directly below, creating the phantom "second calage" look.
      const projectWindow = (startMs: number, endMs: number): { top: number; height: number } | null => {
        if (!(endMs > startMs)) return null;
        const yStart = timeToYPosition(new Date(startMs), startHour, pixelsPerHour, startDate, collapses);
        const yEnd = timeToYPosition(new Date(endMs), startHour, pixelsPerHour, startDate, collapses);
        // Clamp within the tile's rendered bounds.
        const clampedTop = Math.max(0, Math.min(yStart - top, height));
        const clampedBottom = Math.max(0, Math.min(yEnd - top, height));
        const rawHeight = clampedBottom - clampedTop;
        if (rawHeight <= 0) return null;
        return { top: clampedTop, height: Math.max(rawHeight, 4) };
      };

      const calageGeometries: CalageGeometry[] = [];
      const setupEnd = assignment.setupEnd ? new Date(assignment.setupEnd).getTime() : null;
      if (setupEnd !== null) {
        const setupGeom = projectWindow(scheduledStart.getTime(), setupEnd);
        if (setupGeom) calageGeometries.push({ kind: 'setup', ...setupGeom });
      }
      for (const rc of assignment.recalages ?? []) {
        const rcGeom = projectWindow(new Date(rc.start).getTime(), new Date(rc.end).getTime());
        if (rcGeom) calageGeometries.push({ kind: 'recalage', ...rcGeom });
      }

      // Active-window decomposition: when the engine reports ≥2 active
      // sub-windows, we render one independent <Tile> per window instead
      // of a single envelope. Each chunk gets its own (top, height)
      // computed through the same collapse-aware projection used for the
      // envelope, plus the slice of calageGeometries that falls inside
      // that chunk's vertical bounds.
      let chunks: ChunkGeometry[] | undefined;
      const activeWindows = assignment.activeWindows;
      if (activeWindows && activeWindows.length >= 2) {
        chunks = [];
        for (const w of activeWindows) {
          const chunkTop = timeToYPosition(new Date(w.start), startHour, pixelsPerHour, startDate, collapses);
          const chunkBottom = timeToYPosition(new Date(w.end), startHour, pixelsPerHour, startDate, collapses);
          const chunkHeight = Math.max(chunkBottom - chunkTop, 1);
          // Clip the assignment-level calage geometries to this chunk by
          // re-anchoring on chunkTop and dropping anything outside [0, h].
          const chunkCalageGeoms: CalageGeometry[] = [];
          for (const g of calageGeometries) {
            // g.top is relative to the envelope's top; convert to absolute Y,
            // then re-anchor on chunkTop and clamp.
            const absTop = top + g.top;
            const absBottom = absTop + g.height;
            const localTop = Math.max(0, absTop - chunkTop);
            const localBottom = Math.min(chunkHeight, absBottom - chunkTop);
            const localH = localBottom - localTop;
            if (localH > 0) {
              chunkCalageGeoms.push({ kind: g.kind, top: localTop, height: localH });
            }
          }
          chunks.push({ top: chunkTop, height: chunkHeight, calageGeometries: chunkCalageGeoms });
        }
      }

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

      const produitLabel = getProduitLabel(job, element, jobElements.length);

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
        calageGeometries,
        chunks,
        similarityResults,
        similarityScore,
        category,
        hasConflict, tileState,
        blocked: blocking?.blocked ?? false,
        blockingInfo: blocking?.blockingInfo,
        tirageLabel: rawTirageLabel || undefined,
        produitLabel,
        pixelsPerHour,
        operatorNames,
      });
    });
  }

  return cache;
}

import { useMemo } from 'react';
import type { Station, StationCategory, TaskAssignment, Task, Element, Job, ScheduleConflict } from '@flux/types';
import { isInternalTask } from '@flux/types';
import type { TileState } from '../Tile/colorUtils';
import { computeTileState } from '../Tile/colorUtils';
import { getStationXOffset, getTotalContentWidth } from '../../utils/gridLayout';

export interface MinimapTile {
  normX: number;
  normW: number;
  normY: number;
  normH: number;
  tileState: TileState;
  jobId: string;
}

export interface MinimapDataResult {
  tiles: MinimapTile[];
  /** Start of the visible time window (ms since epoch) — "now" */
  windowStartMs: number;
  /** End of the visible time window (ms since epoch) — latest tile end */
  windowEndMs: number;
}

interface UseMinimapDataConfig {
  stations: Station[];
  categories: StationCategory[];
  assignments: TaskAssignment[];
  tasks: Task[];
  elements: Element[];
  jobs: Job[];
  totalDays: number;
  pixelsPerHour: number;
  startDate: Date;
  startHour: number;
  lateJobIds: Set<string>;
  shippedJobIds: Set<string>;
  conflicts: ScheduleConflict[];
}

export function useMinimapData(config: UseMinimapDataConfig): MinimapDataResult {
  const {
    stations, categories, assignments, tasks, elements, jobs,
    totalDays, pixelsPerHour, startDate, startHour,
    lateJobIds, shippedJobIds, conflicts,
  } = config;

  return useMemo(() => {
    const now = new Date();
    const empty: MinimapDataResult = { tiles: [], windowStartMs: now.getTime(), windowEndMs: now.getTime() + 24 * 60 * 60 * 1000 };
    if (stations.length === 0) return empty;

    const catMap = new Map(categories.map(c => [c.id, c]));
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const elementMap = new Map(elements.map(e => [e.id, e]));
    const jobMap = new Map(jobs.map(j => [j.id, j]));
    const stationIndexMap = new Map(stations.map((s, i) => [s.id, i]));

    const conflictTaskIds = new Set<string>();
    conflicts.forEach(c => {
      conflictTaskIds.add(c.taskId);
      if (c.relatedTaskId) conflictTaskIds.add(c.relatedTaskId);
    });

    const totalContentWidth = getTotalContentWidth(stations, catMap);
    if (totalContentWidth === 0) return empty;

    // First pass: collect raw tile data and find the latest end time
    interface RawTile {
      startMs: number;
      endMs: number;
      stationIndex: number;
      tileState: TileState;
      jobId: string;
    }

    const rawTiles: RawTile[] = [];
    let latestEndMs = now.getTime();

    for (const assignment of assignments) {
      if (assignment.isOutsourced) continue;

      const stationIndex = stationIndexMap.get(assignment.targetId);
      if (stationIndex === undefined) continue;

      const task = taskMap.get(assignment.taskId);
      if (!task || !isInternalTask(task)) continue;

      const element = elementMap.get(task.elementId);
      const jobId = element?.jobId;
      const job = jobId ? jobMap.get(jobId) : undefined;
      if (!job) continue;

      const startMs = new Date(assignment.scheduledStart).getTime();
      const endMs = new Date(assignment.scheduledEnd).getTime();

      const isJobShipped = shippedJobIds.has(job.id);
      const isJobLate = lateJobIds.has(job.id);
      const isTaskOverdue = !assignment.isCompleted && endMs < now.getTime();
      const isLate = isJobLate || isTaskOverdue;
      const hasConflict = conflictTaskIds.has(task.id);
      const tileState = computeTileState(isJobShipped, isLate, hasConflict, false, assignment.isCompleted);

      if (endMs > latestEndMs) latestEndMs = endMs;

      rawTiles.push({ startMs, endMs, stationIndex, tileState, jobId: job.id });
    }

    // Time window: now → latest tile end (with small padding)
    const windowStartMs = now.getTime();
    const windowDuration = latestEndMs - windowStartMs;
    if (windowDuration <= 0) return empty;
    const windowEndMs = latestEndMs;

    // Second pass: normalize positions within the window
    const result: MinimapTile[] = [];

    for (const raw of rawTiles) {
      // Skip tiles that end before "now"
      if (raw.endMs <= windowStartMs) continue;

      const { x, stationWidth } = getStationXOffset(raw.stationIndex, stations, catMap);

      const clampedStart = Math.max(raw.startMs, windowStartMs);
      const normY = (clampedStart - windowStartMs) / windowDuration;
      const normH = (raw.endMs - clampedStart) / windowDuration;

      result.push({
        normX: x / totalContentWidth,
        normW: stationWidth / totalContentWidth,
        normY,
        normH,
        tileState: raw.tileState,
        jobId: raw.jobId,
      });
    }

    return { tiles: result, windowStartMs, windowEndMs };
  }, [
    stations, categories, assignments, tasks, elements, jobs,
    totalDays, pixelsPerHour, startDate, startHour,
    lateJobIds, shippedJobIds, conflicts,
  ]);
}

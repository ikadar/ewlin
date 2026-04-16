import { useMemo } from 'react';
import type {
  Station,
  DaySchedule,
  ScheduleSnapshot,
  TaskAssignment,
} from '@flux/types';
import { DIE_CUTTING_CATEGORY_ID, DIE_CUTTING_KEYWORDS } from '@flux/types';
import { Tile } from '../Tile';
import { UnavailabilityOverlay } from '../StationColumns/UnavailabilityOverlay';
import { isElementBlocked, getPrerequisiteBlockingInfo } from '../../utils';
import {
  computeTileDataCache,
  type ElementBlockingInfo,
} from '../../utils/stationTileData';

export interface FocusStationColumnProps {
  station: Station;
  snapshot: ScheduleSnapshot;
  pixelsPerHour: number;
  gridStartDate: Date;
  startHour: number;
  columnHeight: number;
  now: Date;
  visibleDayRange: { start: number; end: number };
  dayCount: number;
}

const DAY_NAMES: (keyof Station['operatingSchedule'])[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function getStationDaySchedule(station: Station, date: Date): DaySchedule {
  if (station.exceptions?.length) {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const exception = station.exceptions.find((e) => e.date === dateStr);
    if (exception) return exception.schedule;
  }
  const dayName = DAY_NAMES[date.getDay()];
  return station.operatingSchedule[dayName];
}

/**
 * Single station column (read-only) — grid lines + unavailability overlay + tiles.
 */
export function FocusStationColumn({
  station,
  snapshot,
  pixelsPerHour,
  gridStartDate,
  startHour,
  columnHeight,
  now,
  visibleDayRange,
  dayCount,
}: FocusStationColumnProps) {
  const stationAssignments = useMemo<TaskAssignment[]>(() => {
    const filtered = snapshot.assignments.filter(
      (a) => !a.isOutsourced && a.targetId === station.id,
    );
    filtered.sort(
      (a, b) =>
        new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
    );
    return filtered;
  }, [snapshot.assignments, station.id]);

  const taskMap = useMemo(() => new Map(snapshot.tasks.map((t) => [t.id, t])), [snapshot.tasks]);
  const elementMap = useMemo(
    () => new Map(snapshot.elements.map((e) => [e.id, e])),
    [snapshot.elements],
  );
  const jobMap = useMemo(() => new Map(snapshot.jobs.map((j) => [j.id, j])), [snapshot.jobs]);
  const stationMap = useMemo(
    () => new Map(snapshot.stations.map((s) => [s.id, s])),
    [snapshot.stations],
  );
  const categoryMap = useMemo(
    () => new Map(snapshot.categories.map((c) => [c.id, c])),
    [snapshot.categories],
  );

  const assemblyStationIds = useMemo(() => {
    return new Set(
      snapshot.stations
        .filter((s) => {
          const cat = categoryMap.get(s.categoryId);
          if (!cat) return false;
          const n = cat.name.toLowerCase();
          return n.includes('encarteuse') || (n.includes('assembleuse') && n.includes('piqueuse'));
        })
        .map((s) => s.id),
    );
  }, [snapshot.stations, categoryMap]);

  const elementsByJobId = useMemo(() => {
    const map = new Map<string, typeof snapshot.elements>();
    for (const e of snapshot.elements) {
      const list = map.get(e.jobId) ?? [];
      list.push(e);
      map.set(e.jobId, list);
    }
    return map;
  }, [snapshot.elements]);

  const elementBlockingCache = useMemo(() => {
    const cache = new Map<string, ElementBlockingInfo>();
    for (const element of snapshot.elements) {
      const hasOffset = element.taskIds.some((taskId) => {
        const task = taskMap.get(taskId);
        if (!task || task.type !== 'Internal') return false;
        const stationInner = stationMap.get(task.stationId);
        if (!stationInner) return false;
        return (
          categoryMap.get(stationInner.categoryId)?.name.toLowerCase().includes('offset') ?? false
        );
      });
      const hasDieCutting = element.taskIds.some((taskId) => {
        const task = taskMap.get(taskId);
        if (!task) return false;
        if (task.type === 'Internal') {
          const stationInner = stationMap.get(task.stationId);
          return stationInner?.categoryId === DIE_CUTTING_CATEGORY_ID;
        }
        if (task.type === 'Outsourced') {
          return DIE_CUTTING_KEYWORDS.some((kw) =>
            task.actionType?.toLowerCase().includes(kw),
          );
        }
        return false;
      });
      const job = jobMap.get(element.jobId);
      const blockOpts = { hasOffset, hasDieCutting, batDeadline: job?.batDeadline };
      cache.set(element.id, {
        hasOffset,
        hasDieCutting,
        blocked: isElementBlocked(element, blockOpts),
        blockingInfo: getPrerequisiteBlockingInfo(element, blockOpts),
      });
    }
    return cache;
  }, [snapshot.elements, taskMap, stationMap, categoryMap, jobMap]);

  const operatorNameMap = useMemo(() => {
    return new Map(
      snapshot.operators.map((op) => [op.id, `${op.firstName} ${op.lastName}`]),
    );
  }, [snapshot.operators]);

  const conflictTaskIds = useMemo(() => {
    const taskIds = new Set<string>();
    snapshot.conflicts.forEach((conflict) => {
      if (
        (conflict.type === 'PrecedenceConflict' ||
          conflict.type === 'GroupCapacityConflict' ||
          conflict.type === 'AvailabilityConflict') &&
        conflict.taskId
      ) {
        taskIds.add(conflict.taskId);
      }
    });
    return taskIds;
  }, [snapshot.conflicts]);

  const lateJobIds = useMemo(
    () => new Set(snapshot.lateJobs.map((l) => l.jobId)),
    [snapshot.lateJobs],
  );

  const tileDataCache = useMemo(
    () =>
      computeTileDataCache({
        assignmentsByStation: new Map([[station.id, stationAssignments]]),
        taskMap,
        jobMap,
        elementMap,
        stationMap,
        categoryMap,
        elementsByJobId,
        elementBlockingCache,
        assemblyStationIds,
        operatorNameMap,
        conflictTaskIds,
        lateJobIds,
        startHour,
        pixelsPerHour,
        startDate: gridStartDate,
        now,
      }),
    [
      station.id,
      stationAssignments,
      taskMap,
      jobMap,
      elementMap,
      stationMap,
      categoryMap,
      elementsByJobId,
      elementBlockingCache,
      assemblyStationIds,
      operatorNameMap,
      conflictTaskIds,
      lateJobIds,
      startHour,
      pixelsPerHour,
      gridStartDate,
      now,
    ],
  );

  const gridLines = useMemo(() => {
    const lines: number[] = [];
    const startHourIndex = visibleDayRange.start * 24;
    const endHourIndex = (visibleDayRange.end + 1) * 24;
    for (let i = startHourIndex; i <= endHourIndex; i++) {
      lines.push(i * pixelsPerHour);
    }
    return lines;
  }, [visibleDayRange, pixelsPerHour]);

  const unavailabilityOverlays = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    const startDay = visibleDayRange.start;
    const endDay = Math.min(visibleDayRange.end, dayCount - 1);
    for (let d = startDay; d <= endDay; d++) {
      const currentDate = new Date(gridStartDate.getTime() + d * 24 * 60 * 60 * 1000);
      const daySchedule = getStationDaySchedule(station, currentDate);
      nodes.push(
        <UnavailabilityOverlay
          key={`unavail-${d}`}
          daySchedule={daySchedule}
          startHour={0}
          hoursToDisplay={24}
          pixelsPerHour={pixelsPerHour}
          yOffset={d * 24 * pixelsPerHour}
        />,
      );
    }
    return nodes;
  }, [station, gridStartDate, pixelsPerHour, visibleDayRange, dayCount]);

  return (
    <div
      className="relative bg-zinc-950"
      style={{ height: `${columnHeight}px` }}
      data-testid={`focus-station-column-${station.id}`}
    >
      {unavailabilityOverlays}
      {gridLines.map((top) => (
        <div
          key={top}
          className="absolute left-0 right-0 h-px bg-zinc-700/50 pointer-events-none"
          style={{ top: `${top}px` }}
          data-testid="hour-grid-line"
        />
      ))}
      {stationAssignments.map((assignment) => {
        const cached = tileDataCache.get(assignment.id);
        if (!cached) return null;
        return (
          <Tile
            key={assignment.id}
            assignment={assignment}
            task={cached.task}
            job={cached.job}
            element={cached.element}
            top={cached.top}
            similarityResults={cached.similarityResults}
            hasConflict={cached.hasConflict}
            tileState={cached.tileState}
            pixelsPerHour={cached.pixelsPerHour}
            isBlocked={cached.blocked}
            blockingInfo={cached.blockingInfo}
            tirageLabel={cached.tirageLabel}
            operatorNames={cached.operatorNames}
          />
        );
      })}
    </div>
  );
}

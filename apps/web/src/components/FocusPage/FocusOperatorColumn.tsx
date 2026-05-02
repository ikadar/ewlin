import { useEffect, useMemo, useRef, useState } from 'react';
import { isInternalTask } from '@flux/types';
import type {
  Operator,
  ScheduleSnapshot,
  TaskAssignment,
} from '@flux/types';
import { TileSegment } from '../Tile/TileSegment';
import { computeTileState } from '../Tile';
import { timeToYPosition } from '../TimelineColumn';
import {
  computeTileSlices,
  getOperatorDaySchedule,
  getOperatorOvertimePeriodsForDay,
} from '../../utils/operatorTileSlices';
import { UnavailabilityOverlay } from '../StationColumns/UnavailabilityOverlay';
import { OvertimeOverlay } from '../StationColumns/OvertimeOverlay';
import { getProduitLabel } from '../../utils/tileLabelResolver';
import { useProgressTriggers } from '../../hooks/useProgressTriggers';
import type { Collapse } from '../SchedulingGrid/collapseConfig';

export interface FocusOperatorColumnProps {
  operator: Operator;
  snapshot: ScheduleSnapshot;
  pixelsPerHour: number;
  gridStartDate: Date;
  startHour: number;
  columnHeight: number;
  now: Date;
  /** Visible day range from virtual scroll — drives grid lines + unavailability rendering */
  visibleDayRange: { start: number; end: number };
  /** Total number of days rendered in the grid (bounds overlay loop) */
  dayCount: number;
  /** Collapse bands (nights/weekends/closures). Empty array if none. */
  collapses: readonly Collapse[];
}

/**
 * Single operator column (read-only) — grid lines + unavailability overlay + tile segments.
 */
export function FocusOperatorColumn({
  operator,
  snapshot,
  pixelsPerHour,
  gridStartDate,
  startHour,
  columnHeight,
  now,
  visibleDayRange,
  dayCount,
  collapses,
}: FocusOperatorColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const operatorAssignments = useMemo<TaskAssignment[]>(() => {
    return snapshot.assignments.filter((a) =>
      a.operators?.some((o) => o.operatorId === operator.id),
    );
  }, [snapshot.assignments, operator.id]);

  const slices = useMemo(
    () => computeTileSlices(operatorAssignments, operator, snapshot.operators),
    [operatorAssignments, operator, snapshot.operators],
  );

  const taskMap = useMemo(() => new Map(snapshot.tasks.map((t) => [t.id, t])), [snapshot.tasks]);
  const elementMap = useMemo(
    () => new Map(snapshot.elements.map((e) => [e.id, e])),
    [snapshot.elements],
  );
  const elementCountByJobId = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of snapshot.elements) m.set(e.jobId, (m.get(e.jobId) ?? 0) + 1);
    return m;
  }, [snapshot.elements]);
  const jobMap = useMemo(() => new Map(snapshot.jobs.map((j) => [j.id, j])), [snapshot.jobs]);
  const stationMap = useMemo(
    () => new Map(snapshot.stations.map((s) => [s.id, s])),
    [snapshot.stations],
  );
  const lateJobIds = useMemo(
    () => new Set(snapshot.lateJobs.map((l) => l.jobId)),
    [snapshot.lateJobs],
  );

  // Saisie indicator placement — pick ONE slice per assignment to host the
  // indicator + modal so a chunk-split task never multiplies affordances.
  // Rule: the slice whose [from, to] contains `now` ; failing that, the
  // first future slice ; failing that, the last past slice (the task is
  // already over but the operator may still need to report a late saisie).
  const saisieSliceKeys = useMemo(() => {
    const byAssignment = new Map<string, typeof slices>();
    for (const s of slices) {
      const list = byAssignment.get(s.assignmentId) ?? [];
      list.push(s);
      byAssignment.set(s.assignmentId, list);
    }
    const keys = new Set<string>();
    for (const [, list] of byAssignment) {
      const sorted = list.slice().sort((a, b) => a.from.getTime() - b.from.getTime());
      const containingNow = sorted.find((s) => s.from <= now && now < s.to);
      const firstFuture = sorted.find((s) => s.from > now);
      const lastPast = sorted[sorted.length - 1];
      const chosen = containingNow ?? firstFuture ?? lastPast;
      if (chosen) {
        keys.add(`${chosen.assignmentId}-${chosen.from.getTime()}`);
      }
    }
    return keys;
  }, [slices, now]);

  const triggers = useProgressTriggers(operatorAssignments, now);

  // Hour grid lines (visible range only). Collapse-aware: skip lines whose
  // wall-clock hour falls inside a band (the band cover hides them) and use
  // collapse-aware Y for the surviving lines so they line up with the
  // piecewise-linear timeline column.
  const gridLines = useMemo(() => {
    const lines: number[] = [];
    const startDay = visibleDayRange.start;
    const endDay = visibleDayRange.end;
    const useCollapse = collapses.length > 0;

    for (let dayIndex = startDay; dayIndex <= endDay; dayIndex++) {
      for (let h = 0; h < 24; h++) {
        if (!useCollapse) {
          lines.push((dayIndex * 24 + h) * pixelsPerHour);
          continue;
        }
        const hourDate = new Date(gridStartDate.getTime() + (dayIndex * 24 + h) * 3_600_000);
        const ms = hourDate.getTime();
        const inside = collapses.some((c) => ms > c.from.getTime() && ms < c.to.getTime());
        if (inside) continue;
        lines.push(timeToYPosition(hourDate, 0, pixelsPerHour, gridStartDate, collapses));
      }
    }
    return lines;
  }, [visibleDayRange, pixelsPerHour, collapses, gridStartDate]);

  const unavailabilityOverlays = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    const startDay = visibleDayRange.start;
    const endDay = Math.min(visibleDayRange.end, dayCount - 1);
    const useCollapse = collapses.length > 0;
    for (let d = startDay; d <= endDay; d++) {
      const currentDate = new Date(gridStartDate.getTime() + d * 24 * 60 * 60 * 1000);
      const daySchedule = getOperatorDaySchedule(operator, currentDate);
      const overtimePeriods = getOperatorOvertimePeriodsForDay(operator, currentDate);
      // With collapses, day Y must be derived from the piecewise mapping —
      // a linear `d * 24 * pixelsPerHour` would land overlays under their
      // bands (or far below the actual visible day).
      const yOffset = useCollapse
        ? timeToYPosition(currentDate, 0, pixelsPerHour, gridStartDate, collapses)
        : d * 24 * pixelsPerHour;

      if (overtimePeriods.length > 0) {
        nodes.push(
          <OvertimeOverlay
            key={`ot-${d}`}
            periods={overtimePeriods}
            startHour={0}
            hoursToDisplay={24}
            pixelsPerHour={pixelsPerHour}
            yOffset={yOffset}
            collapses={collapses}
            dayDate={currentDate}
            gridStartDate={gridStartDate}
          />,
        );
      }

      nodes.push(
        <UnavailabilityOverlay
          key={`unavail-${d}`}
          daySchedule={daySchedule}
          startHour={0}
          hoursToDisplay={24}
          pixelsPerHour={pixelsPerHour}
          yOffset={yOffset}
          collapses={collapses}
          dayDate={currentDate}
          gridStartDate={gridStartDate}
        />,
      );
    }
    return nodes;
  }, [operator, gridStartDate, pixelsPerHour, visibleDayRange, dayCount, collapses]);

  return (
    <div
      ref={ref}
      className="relative bg-zinc-950"
      style={{ height: `${columnHeight}px` }}
      data-testid={`focus-operator-column-${operator.id}`}
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
      {slices.map((slice) => {
        const task = taskMap.get(slice.taskId);
        if (!task || !isInternalTask(task)) return null;
        const element = elementMap.get(task.elementId);
        const jobId = element?.jobId;
        const job = jobId ? jobMap.get(jobId) : undefined;
        if (!job) return null;
        const station = stationMap.get(task.stationId);
        const assignment = operatorAssignments.find((a) => a.id === slice.assignmentId);

        const top = timeToYPosition(slice.from, startHour, pixelsPerHour, gridStartDate, collapses);
        const bottom = timeToYPosition(slice.to, startHour, pixelsPerHour, gridStartDate, collapses);
        const height = Math.max(bottom - top, 8);

        const isLate =
          lateJobIds.has(job.id) ||
          (!assignment?.isCompleted && slice.to < now);
        const tileState = computeTileState(
          false,
          isLate,
          false,
          false,
          assignment?.isCompleted ?? false,
        );

        const overrideLeft = slice.position === 'right' ? '50%' : undefined;
        const overrideWidth = slice.position === 'full' ? undefined : '50%';

        const sliceKey = `${slice.assignmentId}-${slice.from.getTime()}`;
        const showSaisieIndicator = saisieSliceKeys.has(sliceKey);

        return (
          <TileSegment
            key={`${slice.assignmentId}-${slice.from.getTime()}-${slice.position}`}
            segmentKey={sliceKey}
            taskId={slice.taskId}
            assignmentId={slice.assignmentId}
            label={getProduitLabel(job, element, elementCountByJobId.get(job.id) ?? 1)}
            stationName={station?.name}
            top={top}
            height={height}
            width={width}
            sawtoothTop={slice.sawtoothTop}
            sawtoothBottom={slice.sawtoothBottom}
            relayLabelBottom={slice.relayLabelBottom}
            relayLabelTop={slice.relayLabelTop}
            tileState={tileState}
            isMaskedTime={slice.isMasked}
            overrideLeft={overrideLeft}
            overrideWidth={overrideWidth}
            showSaisieIndicator={showSaisieIndicator}
            saisieState={triggers[slice.assignmentId] ?? 'inactive'}
            assignment={assignment}
            jobHeader={{ reference: job.reference, client: job.client }}
            taskDuration={isInternalTask(task) ? task.duration : undefined}
            machineDisplayName={station?.name}
            now={now}
          />
        );
      })}
    </div>
  );
}

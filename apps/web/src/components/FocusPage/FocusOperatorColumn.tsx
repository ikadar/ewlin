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
  const jobMap = useMemo(() => new Map(snapshot.jobs.map((j) => [j.id, j])), [snapshot.jobs]);
  const stationMap = useMemo(
    () => new Map(snapshot.stations.map((s) => [s.id, s])),
    [snapshot.stations],
  );
  const lateJobIds = useMemo(
    () => new Set(snapshot.lateJobs.map((l) => l.jobId)),
    [snapshot.lateJobs],
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
      const daySchedule = getOperatorDaySchedule(operator, currentDate);
      const overtimePeriods = getOperatorOvertimePeriodsForDay(operator, currentDate);
      const yOffset = d * 24 * pixelsPerHour;

      if (overtimePeriods.length > 0) {
        nodes.push(
          <OvertimeOverlay
            key={`ot-${d}`}
            periods={overtimePeriods}
            startHour={0}
            hoursToDisplay={24}
            pixelsPerHour={pixelsPerHour}
            yOffset={yOffset}
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
        />,
      );
    }
    return nodes;
  }, [operator, gridStartDate, pixelsPerHour, visibleDayRange, dayCount]);

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

        const top = timeToYPosition(slice.from, startHour, pixelsPerHour, gridStartDate, []);
        const bottom = timeToYPosition(slice.to, startHour, pixelsPerHour, gridStartDate, []);
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

        return (
          <TileSegment
            key={`${slice.assignmentId}-${slice.from.getTime()}-${slice.position}`}
            segmentKey={`${slice.assignmentId}-${slice.from.getTime()}`}
            label={`${job.reference} · ${job.client}`}
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
          />
        );
      })}
    </div>
  );
}

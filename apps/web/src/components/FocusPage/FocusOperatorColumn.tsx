import { useEffect, useMemo, useRef, useState } from 'react';
import { isInternalTask } from '@flux/types';
import type {
  Operator,
  ScheduleSnapshot,
  TaskAssignment,
} from '@flux/types';
import { TileSegment } from '../Tile/TileSegment';
import { computeTileState } from '../Tile';
import { isCompletedEffective } from '../Tile/colorUtils';
import { computeChunkProgress } from '../Tile/saisieMath';
import { timeToYPosition } from '../TimelineColumn';
import {
  computeTileSlices,
  getOperatorDaySchedule,
  getOperatorOvertimePeriodsForDay,
} from '../../utils/operatorTileSlices';
import { UnavailabilityOverlay } from '../StationColumns/UnavailabilityOverlay';
import { OvertimeOverlay } from '../StationColumns/OvertimeOverlay';
import { getProduitLabel } from '../../utils/tileLabelResolver';
import { useSaisieModal } from '../../contexts/SaisieModalContext';
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
  /**
   * Right-click on any tile bubbles up here so the page (FocusPage) can
   * mount a single TileContextMenu / SetStartTimeDialog instead of N times
   * across columns. Includes a pre-bound `openSaisie` closure that fires
   * the saisie modal with the right assignment in scope — FocusPage just
   * forwards it to the menu's "Saisir l'avancement" item, gated by past-
   * start (only present when the task has started).
   */
  onTileContextMenu?: (payload: {
    x: number;
    y: number;
    assignmentId: string;
    taskId: string;
    jobId: string;
    job: { reference: string; client: string };
    currentScheduledStart: string;
    isPinned: boolean;
    isCompleted: boolean;
    /** Past-start only ; undefined when the task hasn't started yet. */
    openSaisie?: () => void;
  }) => void;
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
  onTileContextMenu,
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

  const saisieModal = useSaisieModal();

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

        // No-news = good-news: a slice crossing into the past without being
        // explicitly flagged otherwise reads as completed. Green outranks
        // late/conflict for past tiles — there's nothing left to act on.
        const isCompletedNow = assignment
          ? isCompletedEffective(assignment.isCompleted, assignment.scheduledEnd, now.getTime())
          : slice.to < now;
        const isLate = !isCompletedNow && lateJobIds.has(job.id);
        const tileState = computeTileState(
          false,
          isLate,
          false,
          false,
          isCompletedNow,
        );

        const overrideLeft = slice.position === 'right' ? '50%' : undefined;
        const overrideWidth = slice.position === 'full' ? undefined : '50%';

        const sliceKey = `${slice.assignmentId}-${slice.from.getTime()}`;
        const hasStarted = assignment
          ? new Date(assignment.scheduledStart).getTime() <= now.getTime()
          : false;

        // Per-slice wallclock fond-vert : each segment computes its own
        // progress from its slice.from..slice.to window. Past slices clamp
        // to 100, future slices to 0, the active slice fills linearly.
        // Earlier this used `computeOptimisticProgress` against the
        // assignment envelope and broadcast the same value across every
        // slice — chunk 1 (already past) showed only the envelope-relative
        // pct and chunk 2 (in the future) was already partially green
        // because the envelope had elapsed into it from above. Saisie
        // remains task-level and reshapes window boundaries on engine
        // recompute, never folded back into per-slice math.
        const progressFill = (assignment && isInternalTask(task))
          ? (isCompletedNow
              ? { pct: 100, isLate: false }
              : computeChunkProgress(
                  slice.from.toISOString(),
                  slice.to.toISOString(),
                  now.getTime(),
                ))
          : undefined;

        // Per-slice badge breakdown : each slice's share of the
        // operator-time invested on this assignment. Denominator is the
        // sum of every operator stint window (assignment.operators[]) so
        // the badges sum to 100% across all slices regardless of how
        // many operators worked the task. Earlier this used
        // `realisticDurationMinutes` (a single-stint figure) which made
        // a 30-min slice show 100% and a 15-min slice show 50% on a task
        // whose two stints together totalled 45 min — the chef expected
        // 67% / 33% (matching the JDP per-operator badges, same model).
        const sliceBadgePct = ((): number => {
          if (!assignment?.operators?.length) return 100;
          const opWindowMinutes = (op: { from?: string; to?: string }): number => {
            if (!op.from || !op.to) return 0;
            return Math.max(0, (new Date(op.to).getTime() - new Date(op.from).getTime()) / 60_000);
          };
          const totalOpMin = assignment.operators.reduce((s, op) => s + opWindowMinutes(op), 0);
          if (totalOpMin <= 0) return 100;
          const sliceMin = (slice.to.getTime() - slice.from.getTime()) / 60_000;
          return Math.max(0, Math.min(100, (sliceMin / totalOpMin) * 100));
        })();

        const handleOpenSaisie = assignment && isInternalTask(task)
          ? () =>
              saisieModal.open({
                assignment,
                taskDuration: task.duration,
                job: { reference: job.reference, client: job.client },
                machineName: station?.name ?? task.stationId,
                now,
              })
          : undefined;

        const handleContextMenu = (e: React.MouseEvent) => {
          if (!assignment || !onTileContextMenu) return;
          e.preventDefault();
          e.stopPropagation();
          onTileContextMenu({
            x: e.clientX,
            y: e.clientY,
            assignmentId: assignment.id,
            taskId: slice.taskId,
            jobId: job.id,
            job: { reference: job.reference, client: job.client },
            currentScheduledStart: assignment.scheduledStart,
            isPinned: assignment.isPinned ?? false,
            isCompleted: assignment.isCompleted ?? false,
            openSaisie: hasStarted ? handleOpenSaisie : undefined,
          });
        };

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
            onContextMenu={handleContextMenu}
            progressFill={progressFill}
            taskBadgePct={sliceBadgePct}
          />
        );
      })}
    </div>
  );
}

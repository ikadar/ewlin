/* eslint-disable react-refresh/only-export-components */
import { useState, useCallback } from 'react';
import type { Task, TaskAssignment } from '@flux/types';
import { isOutsourcedTask, isInternalTask } from '@flux/types';
import { formatScheduleDateTime } from '../../utils/dateFormat';
import { useTooltipDelay } from '../../hooks';

export interface ProgressDotsProps {
  tasks: Task[];
  assignments: TaskAssignment[];
}

export type DotState = 'unscheduled' | 'scheduled' | 'completed' | 'late';

const DOT_SIZE = 6;
const DOT_GAP = 2;
const DIAMOND_SIZE = 5;

const STATE_COLORS: Record<DotState, string> = {
  unscheduled: '#52525b',
  scheduled: '#3b82f6',
  completed: '#10b981',
  late: '#ef4444',
};

const STATE_LABELS: Record<DotState, string> = {
  unscheduled: 'Non planifiée',
  scheduled: 'Planifiée',
  completed: 'Terminée',
  late: 'En retard',
};

export function getDotState(
  _task: Task,
  assignment: TaskAssignment | undefined
): DotState {
  if (!assignment) return 'unscheduled';
  if (assignment.isCompleted) return 'completed';

  const scheduledEnd = new Date(assignment.scheduledEnd);
  if (scheduledEnd < new Date()) return 'late';

  return 'scheduled';
}

function buildTooltipText(task: Task, assignment: TaskAssignment | undefined, state: DotState): { line1: string; line2: string } {
  const statusLabel = STATE_LABELS[state];

  if (isOutsourcedTask(task)) {
    const line1 = `${task.actionType} · ${statusLabel}`;
    if (assignment) {
      const start = formatScheduleDateTime(assignment.scheduledStart);
      const end = formatScheduleDateTime(assignment.scheduledEnd);
      return { line1, line2: `${start} → ${end}` };
    }
    return { line1, line2: `${task.duration.openDays} jour(s) ouvré(s)` };
  }

  if (isInternalTask(task)) {
    const total = task.duration.setupMinutes + task.duration.runMinutes;
    const line1 = `Étape ${task.sequenceOrder + 1} · ${statusLabel}`;
    if (assignment) {
      const start = formatScheduleDateTime(assignment.scheduledStart);
      const end = formatScheduleDateTime(assignment.scheduledEnd);
      return { line1, line2: `${start} → ${end}` };
    }
    return { line1, line2: `${total} min (${task.duration.setupMinutes} calage + ${task.duration.runMinutes} roulage)` };
  }

  return { line1: `Étape ${task.sequenceOrder + 1}`, line2: statusLabel };
}

interface DotTooltipState {
  taskId: string;
  x: number;
  y: number;
  line1: string;
  line2: string;
}

function DotTooltip({ x, y, line1, line2 }: Omit<DotTooltipState, 'taskId'>) {
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
      data-testid="dot-tooltip"
    >
      <div className="flux-tooltip whitespace-nowrap leading-tight">
        <div className="text-[var(--tt-text)] font-medium">{line1}</div>
        <div className="text-[var(--tt-muted)] mt-0.5">{line2}</div>
      </div>
      <div className="flex justify-center">
        <div className="flux-tooltip-arrow" />
      </div>
    </div>
  );
}

export function ProgressDots({ tasks, assignments }: ProgressDotsProps) {
  const [tooltip, setTooltip] = useState<DotTooltipState | null>(null);
  const { isVisible: delayVisible, onMouseEnter: delayEnter, onMouseLeave: delayLeave } = useTooltipDelay({ showDelay: 0, hideDelay: 100 });

  if (tasks.length === 0) return null;

  const assignmentMap = new Map<string, TaskAssignment>();
  assignments.forEach((a) => assignmentMap.set(a.taskId, a));

  const sortedTasks = [...tasks].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const handleEnter = useCallback((e: React.MouseEvent, task: Task, assignment: TaskAssignment | undefined, state: DotState) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { line1, line2 } = buildTooltipText(task, assignment, state);
    setTooltip({
      taskId: task.id,
      x: rect.left + rect.width / 2,
      y: rect.top - 4,
      line1,
      line2,
    });
    delayEnter();
  }, [delayEnter]);

  const handleLeave = useCallback(() => {
    delayLeave();
  }, [delayLeave]);

  return (
    <>
      <div
        className="flex flex-wrap items-center"
        style={{ gap: `${DOT_GAP}px` }}
        data-testid="progress-dots"
      >
        {sortedTasks.map((task) => {
          const assignment = assignmentMap.get(task.id);
          const state = getDotState(task, assignment);
          const color = STATE_COLORS[state];
          const outsourced = isOutsourcedTask(task);

          const dotProps = {
            onMouseEnter: (e: React.MouseEvent) => handleEnter(e, task, assignment, state),
            onMouseLeave: handleLeave,
          };

          return outsourced ? (
            <div
              key={task.id}
              className="flex items-center justify-center"
              style={{ width: DOT_SIZE, height: DOT_SIZE }}
              data-testid={`dot-${task.id}`}
              data-state={state}
              data-outsourced="true"
              {...dotProps}
            >
              <div
                style={{
                  width: DIAMOND_SIZE,
                  height: DIAMOND_SIZE,
                  backgroundColor: color,
                  transform: 'rotate(45deg)',
                  borderRadius: 1,
                }}
              />
            </div>
          ) : (
            <div
              key={task.id}
              style={{
                width: DOT_SIZE,
                height: DOT_SIZE,
                backgroundColor: color,
                borderRadius: '50%',
              }}
              data-testid={`dot-${task.id}`}
              data-state={state}
              {...dotProps}
            />
          );
        })}
      </div>
      {tooltip && delayVisible && <DotTooltip x={tooltip.x} y={tooltip.y} line1={tooltip.line1} line2={tooltip.line2} />}
    </>
  );
}

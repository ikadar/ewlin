import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { Task, TaskAssignment, InternalTask, OutsourcedTask } from '@flux/types';
import { ProgressDots, getDotState } from './ProgressDots';

function createInternalTask(
  id: string,
  elementId: string,
  setupMinutes: number,
  runMinutes: number,
  sequenceOrder: number = 0
): InternalTask {
  return {
    id,
    elementId,
    type: 'Internal',
    stationId: 'station-1',
    sequenceOrder,
    status: 'Defined',
    duration: { setupMinutes, runMinutes },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createOutsourcedTask(
  id: string,
  elementId: string,
  openDays: number,
  sequenceOrder: number = 0
): OutsourcedTask {
  return {
    id,
    elementId,
    type: 'Outsourced',
    providerId: 'provider-1',
    actionType: 'Pelliculage',
    sequenceOrder,
    status: 'Defined',
    duration: {
      openDays,
      latestDepartureTime: '14:00',
      receptionTime: '10:00',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createAssignment(
  taskId: string,
  isCompleted: boolean,
  scheduledEnd: Date
): TaskAssignment {
  const now = new Date();
  return {
    id: `assign-${taskId}`,
    taskId,
    targetId: 'station-1',
    isOutsourced: false,
    scheduledStart: new Date(scheduledEnd.getTime() - 60 * 60 * 1000).toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
    isCompleted,
    completedAt: isCompleted ? now.toISOString() : null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

describe('getDotState', () => {
  it('returns "unscheduled" when no assignment', () => {
    const task = createInternalTask('task-1', 'job-1', 10, 20);
    expect(getDotState(task, undefined)).toBe('unscheduled');
  });

  it('returns "completed" when assignment is completed', () => {
    const task = createInternalTask('task-1', 'job-1', 10, 20);
    const assignment = createAssignment('task-1', true, new Date());
    expect(getDotState(task, assignment)).toBe('completed');
  });

  it('returns "late" when scheduledEnd is in the past and not completed', () => {
    const task = createInternalTask('task-1', 'job-1', 10, 20);
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    const assignment = createAssignment('task-1', false, pastDate);
    expect(getDotState(task, assignment)).toBe('late');
  });

  it('returns "scheduled" when scheduledEnd is in the future and not completed', () => {
    const task = createInternalTask('task-1', 'job-1', 10, 20);
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const assignment = createAssignment('task-1', false, futureDate);
    expect(getDotState(task, assignment)).toBe('scheduled');
  });
});

describe('ProgressDots component', () => {
  it('renders nothing when tasks array is empty', () => {
    const { container } = render(
      <ProgressDots tasks={[]} assignments={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a dot for each task', () => {
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', 10, 20, 0),
      createInternalTask('task-2', 'job-1', 15, 25, 1),
      createInternalTask('task-3', 'job-1', 20, 30, 2),
    ];

    render(<ProgressDots tasks={tasks} assignments={[]} />);

    expect(screen.getByTestId('dot-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('dot-task-2')).toBeInTheDocument();
    expect(screen.getByTestId('dot-task-3')).toBeInTheDocument();
  });

  it('renders unscheduled state for tasks without assignments', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];

    render(<ProgressDots tasks={tasks} assignments={[]} />);

    const dot = screen.getByTestId('dot-task-1');
    expect(dot).toHaveAttribute('data-state', 'unscheduled');
  });

  it('renders completed state for completed tasks', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];
    const assignments: TaskAssignment[] = [
      createAssignment('task-1', true, new Date()),
    ];

    render(<ProgressDots tasks={tasks} assignments={assignments} />);

    const dot = screen.getByTestId('dot-task-1');
    expect(dot).toHaveAttribute('data-state', 'completed');
  });

  it('renders late state for overdue tasks', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    const assignments: TaskAssignment[] = [
      createAssignment('task-1', false, pastDate),
    ];

    render(<ProgressDots tasks={tasks} assignments={assignments} />);

    const dot = screen.getByTestId('dot-task-1');
    expect(dot).toHaveAttribute('data-state', 'late');
  });

  it('renders scheduled state for future tasks', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const assignments: TaskAssignment[] = [
      createAssignment('task-1', false, futureDate),
    ];

    render(<ProgressDots tasks={tasks} assignments={assignments} />);

    const dot = screen.getByTestId('dot-task-1');
    expect(dot).toHaveAttribute('data-state', 'scheduled');
  });

  it('renders outsourced task with diamond marker', () => {
    const tasks: Task[] = [createOutsourcedTask('task-1', 'job-1', 3)];

    render(<ProgressDots tasks={tasks} assignments={[]} />);

    const dot = screen.getByTestId('dot-task-1');
    expect(dot).toHaveAttribute('data-outsourced', 'true');
  });

  it('sorts tasks by sequence order', () => {
    const tasks: Task[] = [
      createInternalTask('task-3', 'job-1', 10, 20, 2),
      createInternalTask('task-1', 'job-1', 10, 20, 0),
      createInternalTask('task-2', 'job-1', 10, 20, 1),
    ];

    render(<ProgressDots tasks={tasks} assignments={[]} />);

    const container = screen.getByTestId('progress-dots');
    const dots = container.querySelectorAll('[data-testid^="dot-"]');

    expect(dots[0]).toHaveAttribute('data-testid', 'dot-task-1');
    expect(dots[1]).toHaveAttribute('data-testid', 'dot-task-2');
    expect(dots[2]).toHaveAttribute('data-testid', 'dot-task-3');
  });

  it('shows tooltip with duration on hover for unscheduled internal task', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];

    render(<ProgressDots tasks={tasks} assignments={[]} />);

    fireEvent.mouseEnter(screen.getByTestId('dot-task-1'));

    const tooltip = screen.getByTestId('dot-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Non planifiée');
    expect(tooltip).toHaveTextContent('30 min');
  });

  it('shows tooltip with schedule on hover for scheduled task', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const assignments: TaskAssignment[] = [
      createAssignment('task-1', false, futureDate),
    ];

    render(<ProgressDots tasks={tasks} assignments={assignments} />);

    fireEvent.mouseEnter(screen.getByTestId('dot-task-1'));

    const tooltip = screen.getByTestId('dot-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Planifiée');
    expect(tooltip).toHaveTextContent('→');
  });

  it('shows tooltip with actionType for outsourced task', () => {
    const tasks: Task[] = [createOutsourcedTask('task-1', 'job-1', 3)];

    render(<ProgressDots tasks={tasks} assignments={[]} />);

    fireEvent.mouseEnter(screen.getByTestId('dot-task-1'));

    const tooltip = screen.getByTestId('dot-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Pelliculage');
    expect(tooltip).toHaveTextContent('3 jour(s) ouvré(s)');
  });

  it('hides tooltip on mouse leave', async () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];

    render(<ProgressDots tasks={tasks} assignments={[]} />);

    fireEvent.mouseEnter(screen.getByTestId('dot-task-1'));
    expect(screen.getByTestId('dot-tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('dot-task-1'));

    // Tooltip hides after 100ms timeout
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(screen.queryByTestId('dot-tooltip')).not.toBeInTheDocument();
  });
});

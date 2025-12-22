import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Task, TaskAssignment, InternalTask, OutsourcedTask } from '@flux/types';
import {
  ProgressSegments,
  getSegmentState,
  getSegmentWidth,
  getOutsourcedLabel,
} from './ProgressSegments';

// Helper to create internal task
function createInternalTask(
  id: string,
  jobId: string,
  setupMinutes: number,
  runMinutes: number,
  sequenceOrder: number = 0
): InternalTask {
  return {
    id,
    jobId,
    type: 'Internal',
    stationId: 'station-1',
    sequenceOrder,
    status: 'Defined',
    duration: { setupMinutes, runMinutes },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Helper to create outsourced task
function createOutsourcedTask(
  id: string,
  jobId: string,
  openDays: number,
  sequenceOrder: number = 0
): OutsourcedTask {
  return {
    id,
    jobId,
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

// Helper to create assignment
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

describe('getSegmentState', () => {
  it('returns "unscheduled" when no assignment', () => {
    const task = createInternalTask('task-1', 'job-1', 10, 20);
    expect(getSegmentState(task, undefined)).toBe('unscheduled');
  });

  it('returns "completed" when assignment is completed', () => {
    const task = createInternalTask('task-1', 'job-1', 10, 20);
    const assignment = createAssignment('task-1', true, new Date());
    expect(getSegmentState(task, assignment)).toBe('completed');
  });

  it('returns "late" when scheduledEnd is in the past and not completed', () => {
    const task = createInternalTask('task-1', 'job-1', 10, 20);
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const assignment = createAssignment('task-1', false, pastDate);
    expect(getSegmentState(task, assignment)).toBe('late');
  });

  it('returns "scheduled" when scheduledEnd is in the future and not completed', () => {
    const task = createInternalTask('task-1', 'job-1', 10, 20);
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    const assignment = createAssignment('task-1', false, futureDate);
    expect(getSegmentState(task, assignment)).toBe('scheduled');
  });
});

describe('getSegmentWidth', () => {
  it('returns 8px for internal task with 15 min duration', () => {
    const task = createInternalTask('task-1', 'job-1', 5, 10); // 15 min
    expect(getSegmentWidth(task)).toBe(8); // min width
  });

  it('returns 8px for internal task with 30 min duration', () => {
    const task = createInternalTask('task-1', 'job-1', 10, 20); // 30 min
    expect(getSegmentWidth(task)).toBe(8);
  });

  it('returns 16px for internal task with 60 min duration', () => {
    const task = createInternalTask('task-1', 'job-1', 20, 40); // 60 min
    expect(getSegmentWidth(task)).toBe(16);
  });

  it('returns 24px for internal task with 90 min duration', () => {
    const task = createInternalTask('task-1', 'job-1', 30, 60); // 90 min
    expect(getSegmentWidth(task)).toBe(24);
  });

  it('returns 32px for internal task with 120 min duration', () => {
    const task = createInternalTask('task-1', 'job-1', 40, 80); // 120 min
    expect(getSegmentWidth(task)).toBe(32);
  });

  it('returns 40px for outsourced task (5× standard)', () => {
    const task = createOutsourcedTask('task-1', 'job-1', 2);
    expect(getSegmentWidth(task)).toBe(40);
  });
});

describe('getOutsourcedLabel', () => {
  it('returns null for internal task', () => {
    const task = createInternalTask('task-1', 'job-1', 10, 20);
    expect(getOutsourcedLabel(task)).toBeNull();
  });

  it('returns "2JO" for outsourced task with 2 open days', () => {
    const task = createOutsourcedTask('task-1', 'job-1', 2);
    expect(getOutsourcedLabel(task)).toBe('2JO');
  });

  it('returns "5JO" for outsourced task with 5 open days', () => {
    const task = createOutsourcedTask('task-1', 'job-1', 5);
    expect(getOutsourcedLabel(task)).toBe('5JO');
  });
});

describe('ProgressSegments component', () => {
  it('renders nothing when tasks array is empty', () => {
    const { container } = render(
      <ProgressSegments tasks={[]} assignments={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders segments for each task', () => {
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', 10, 20, 0),
      createInternalTask('task-2', 'job-1', 15, 25, 1),
      createInternalTask('task-3', 'job-1', 20, 30, 2),
    ];

    render(<ProgressSegments tasks={tasks} assignments={[]} />);

    expect(screen.getByTestId('segment-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('segment-task-2')).toBeInTheDocument();
    expect(screen.getByTestId('segment-task-3')).toBeInTheDocument();
  });

  it('renders unscheduled state for tasks without assignments', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];

    render(<ProgressSegments tasks={tasks} assignments={[]} />);

    const segment = screen.getByTestId('segment-task-1');
    expect(segment).toHaveAttribute('data-state', 'unscheduled');
  });

  it('renders completed state for completed tasks', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];
    const assignments: TaskAssignment[] = [
      createAssignment('task-1', true, new Date()),
    ];

    render(<ProgressSegments tasks={tasks} assignments={assignments} />);

    const segment = screen.getByTestId('segment-task-1');
    expect(segment).toHaveAttribute('data-state', 'completed');
  });

  it('renders late state for overdue tasks', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    const assignments: TaskAssignment[] = [
      createAssignment('task-1', false, pastDate),
    ];

    render(<ProgressSegments tasks={tasks} assignments={assignments} />);

    const segment = screen.getByTestId('segment-task-1');
    expect(segment).toHaveAttribute('data-state', 'late');
  });

  it('renders scheduled state for future tasks', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 10, 20)];
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const assignments: TaskAssignment[] = [
      createAssignment('task-1', false, futureDate),
    ];

    render(<ProgressSegments tasks={tasks} assignments={assignments} />);

    const segment = screen.getByTestId('segment-task-1');
    expect(segment).toHaveAttribute('data-state', 'scheduled');
  });

  it('renders outsourced task with label', () => {
    const tasks: Task[] = [createOutsourcedTask('task-1', 'job-1', 3)];

    render(<ProgressSegments tasks={tasks} assignments={[]} />);

    const segment = screen.getByTestId('segment-task-1');
    expect(segment).toHaveTextContent('3JO');
  });

  it('sorts tasks by sequence order', () => {
    const tasks: Task[] = [
      createInternalTask('task-3', 'job-1', 10, 20, 2),
      createInternalTask('task-1', 'job-1', 10, 20, 0),
      createInternalTask('task-2', 'job-1', 10, 20, 1),
    ];

    render(<ProgressSegments tasks={tasks} assignments={[]} />);

    const container = screen.getByTestId('progress-segments');
    const segments = container.querySelectorAll('[data-testid^="segment-"]');

    expect(segments[0]).toHaveAttribute('data-testid', 'segment-task-1');
    expect(segments[1]).toHaveAttribute('data-testid', 'segment-task-2');
    expect(segments[2]).toHaveAttribute('data-testid', 'segment-task-3');
  });
});

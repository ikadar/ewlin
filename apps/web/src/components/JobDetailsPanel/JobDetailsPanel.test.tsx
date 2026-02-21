import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobDetailsPanel } from './JobDetailsPanel';
import { JobInfo } from './JobInfo';
import { InfoField } from './InfoField';
import { TaskList } from './TaskList';
import { TaskTile } from './TaskTile';
import type { Job, Task, TaskAssignment, Station, Element } from '@flux/types';

// Mock data
const mockJob: Job = {
  id: 'job-1',
  reference: '12345',
  client: 'Autosphere',
  description: 'Brochures Autosphère accueil',
  status: 'InProgress',
  workshopExitDate: '2025-12-18',
  fullyScheduled: false,
  color: '#8B5CF6',
  comments: [],
  taskIds: ['task-1', 'task-2'],
  elementIds: ['element-1'],
  createdAt: '2025-12-15T10:00:00Z',
  updatedAt: '2025-12-15T10:00:00Z',
};

const mockElements: Element[] = [
  {
    id: 'element-1',
    jobId: 'job-1',
    name: 'ELT',
    prerequisiteElementIds: [],
    taskIds: ['task-1', 'task-2'],
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
];

const mockTasks: Task[] = [
  {
    id: 'task-1',
    elementId: 'element-1',
    sequenceOrder: 0,
    status: 'Assigned',
    type: 'Internal',
    stationId: 'station-1',
    duration: { setupMinutes: 30, runMinutes: 120 },
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
  {
    id: 'task-2',
    elementId: 'element-1',
    sequenceOrder: 1,
    status: 'Ready',
    type: 'Internal',
    stationId: 'station-2',
    duration: { setupMinutes: 15, runMinutes: 30 },
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
];

const weekdaySchedule = { isOperating: true, slots: [{ start: '07:00', end: '19:00' }] };
const weekendSchedule = { isOperating: false, slots: [] };

const mockStations: Station[] = [
  {
    id: 'station-1',
    name: 'Komori G40',
    status: 'Available',
    categoryId: 'cat-1',
    groupId: 'group-1',
    capacity: 1,
    operatingSchedule: {
      monday: weekdaySchedule,
      tuesday: weekdaySchedule,
      wednesday: weekdaySchedule,
      thursday: weekdaySchedule,
      friday: weekdaySchedule,
      saturday: weekendSchedule,
      sunday: weekendSchedule,
    },
    exceptions: [],
  },
  {
    id: 'station-2',
    name: 'Polar 137',
    status: 'Available',
    categoryId: 'cat-2',
    groupId: 'group-2',
    capacity: 1,
    operatingSchedule: {
      monday: weekdaySchedule,
      tuesday: weekdaySchedule,
      wednesday: weekdaySchedule,
      thursday: weekdaySchedule,
      friday: weekdaySchedule,
      saturday: weekendSchedule,
      sunday: weekendSchedule,
    },
    exceptions: [],
  },
];

const mockAssignments: TaskAssignment[] = [
  {
    id: 'assign-1',
    taskId: 'task-1',
    targetId: 'station-1',
    isOutsourced: false,
    scheduledStart: '2025-12-15T07:00:00Z',
    scheduledEnd: '2025-12-15T09:30:00Z',
    isCompleted: false,
    completedAt: null,
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
];

describe('JobDetailsPanel', () => {
  it('renders nothing when no job is selected', () => {
    const { container } = render(
      <JobDetailsPanel
        job={null}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        stations={mockStations}
      />
    );
    expect(container.querySelector('[class]')).toBeNull();
  });

  it('renders when job is selected', () => {
    render(
      <JobDetailsPanel
        job={mockJob}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        stations={mockStations}
      />
    );
    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByText('Autosphere')).toBeInTheDocument();
  });

  it('displays all job info fields', () => {
    render(
      <JobDetailsPanel
        job={mockJob}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        stations={mockStations}
      />
    );
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByText('Intitulé')).toBeInTheDocument();
    expect(screen.getByText('Départ')).toBeInTheDocument();
  });

  it('displays task tiles', () => {
    render(
      <JobDetailsPanel
        job={mockJob}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        stations={mockStations}
      />
    );
    expect(screen.getByText('Komori G40')).toBeInTheDocument();
    expect(screen.getByText('Polar 137')).toBeInTheDocument();
  });
});

describe('InfoField', () => {
  it('renders label and value', () => {
    render(<InfoField label="Test Label" value="Test Value" />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test Value')).toBeInTheDocument();
  });

  it('applies monospace styling when mono is true', () => {
    render(<InfoField label="Code" value="12345" mono />);
    const valueElement = screen.getByText('12345');
    expect(valueElement).toHaveClass('font-mono');
  });
});

describe('JobInfo', () => {
  it('displays all job fields', () => {
    render(<JobInfo job={mockJob} />);
    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByText('Autosphere')).toBeInTheDocument();
    expect(screen.getByText('Brochures Autosphère accueil')).toBeInTheDocument();
    expect(screen.getByText('18/12/2025 14:00')).toBeInTheDocument();
  });
});

describe('TaskList', () => {
  it('renders task tiles sorted by sequence order', () => {
    render(
      <TaskList
        tasks={mockTasks}
        elements={mockElements}
        job={mockJob}
        assignments={mockAssignments}
        stations={mockStations}
      />
    );
    const tiles = screen.getAllByText(/Komori|Polar/);
    expect(tiles).toHaveLength(2);
  });

  it('shows empty state when no tasks', () => {
    render(
      <TaskList tasks={[]} elements={mockElements} job={mockJob} assignments={[]} stations={mockStations} />
    );
    expect(screen.getByText('Aucune tâche')).toBeInTheDocument();
  });
});

describe('TaskTile', () => {
  it('renders unscheduled task with duration', () => {
    const task = mockTasks[1]; // Unscheduled task
    render(
      <TaskTile
        task={task}
        job={mockJob}
        jobColor={mockJob.color}
        station={mockStations[1]}
      />
    );
    expect(screen.getByText('Polar 137')).toBeInTheDocument();
    expect(screen.getByText('0h45')).toBeInTheDocument();
  });

  it('renders scheduled task with datetime', () => {
    const task = mockTasks[0]; // Scheduled task
    render(
      <TaskTile
        task={task}
        job={mockJob}
        jobColor={mockJob.color}
        assignment={mockAssignments[0]}
        station={mockStations[0]}
      />
    );
    expect(screen.getByText('Komori G40')).toBeInTheDocument();
    // Should show scheduled time instead of duration
    // Time varies by timezone, so just check for the pattern (Day DD/MM HH:MM)
    expect(screen.getByText(/[A-Z][a-z] 15\/12 \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('has cursor-pointer class for unscheduled pickable tasks', () => {
    const task = mockTasks[1];
    const onPick = vi.fn();
    render(
      <TaskTile task={task} job={mockJob} jobColor={mockJob.color} station={mockStations[1]} onPick={onPick} />
    );
    const tile = screen.getByTestId(`task-tile-${task.id}`);
    expect(tile).toHaveClass('cursor-pointer');
  });

  it('has dark styling for scheduled tasks', () => {
    const task = mockTasks[0];
    render(
      <TaskTile
        task={task}
        job={mockJob}
        jobColor={mockJob.color}
        assignment={mockAssignments[0]}
        station={mockStations[0]}
      />
    );
    const tile = screen.getByTestId(`task-tile-${task.id}`);
    expect(tile).toHaveClass('bg-slate-800/40');
  });

  it('has select-none class for unscheduled tasks', () => {
    const task = mockTasks[1];
    render(
      <TaskTile task={task} job={mockJob} jobColor={mockJob.color} station={mockStations[1]} />
    );
    const tile = screen.getByTestId(`task-tile-${task.id}`);
    expect(tile).toHaveClass('select-none');
  });
});

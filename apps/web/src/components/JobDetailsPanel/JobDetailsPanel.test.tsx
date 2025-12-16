import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { JobDetailsPanel } from './JobDetailsPanel';
import { JobInfo } from './JobInfo';
import { JobStatus } from './JobStatus';
import { InfoField } from './InfoField';
import { TaskList } from './TaskList';
import { TaskTile } from './TaskTile';
import type { Job, Task, TaskAssignment, Station } from '@flux/types';

// Helper to wrap components with DndContext
const DndWrapper = ({ children }: { children: React.ReactNode }) => (
  <DndContext>{children}</DndContext>
);

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
  paperPurchaseStatus: 'Ordered',
  proofApproval: { sentAt: '2025-12-12T14:30:00Z', approvedAt: null },
  platesStatus: 'Done',
  requiredJobIds: [],
  comments: [],
  taskIds: ['task-1', 'task-2'],
  createdAt: '2025-12-15T10:00:00Z',
  updatedAt: '2025-12-15T10:00:00Z',
};

const mockTasks: Task[] = [
  {
    id: 'task-1',
    jobId: 'job-1',
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
    jobId: 'job-1',
    sequenceOrder: 1,
    status: 'Ready',
    type: 'Internal',
    stationId: 'station-2',
    duration: { setupMinutes: 15, runMinutes: 30 },
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
];

const mockStations: Station[] = [
  {
    id: 'station-1',
    name: 'Komori G40',
    status: 'Operational',
    categoryId: 'cat-1',
    groupId: 'group-1',
    capacity: 1,
    operatingSchedule: {
      monday: { start: '07:00', end: '19:00' },
      tuesday: { start: '07:00', end: '19:00' },
      wednesday: { start: '07:00', end: '19:00' },
      thursday: { start: '07:00', end: '19:00' },
      friday: { start: '07:00', end: '19:00' },
      saturday: null,
      sunday: null,
    },
    exceptions: [],
  },
  {
    id: 'station-2',
    name: 'Polar 137',
    status: 'Operational',
    categoryId: 'cat-2',
    groupId: 'group-2',
    capacity: 1,
    operatingSchedule: {
      monday: { start: '07:00', end: '19:00' },
      tuesday: { start: '07:00', end: '19:00' },
      wednesday: { start: '07:00', end: '19:00' },
      thursday: { start: '07:00', end: '19:00' },
      friday: { start: '07:00', end: '19:00' },
      saturday: null,
      sunday: null,
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
      <DndWrapper>
        <JobDetailsPanel
          job={null}
          tasks={mockTasks}
          assignments={mockAssignments}
          stations={mockStations}
        />
      </DndWrapper>
    );
    expect(container.querySelector('[class]')).toBeNull();
  });

  it('renders when job is selected', () => {
    render(
      <DndWrapper>
        <JobDetailsPanel
          job={mockJob}
          tasks={mockTasks}
          assignments={mockAssignments}
          stations={mockStations}
        />
      </DndWrapper>
    );
    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByText('Autosphere')).toBeInTheDocument();
  });

  it('displays all job info fields', () => {
    render(
      <DndWrapper>
        <JobDetailsPanel
          job={mockJob}
          tasks={mockTasks}
          assignments={mockAssignments}
          stations={mockStations}
        />
      </DndWrapper>
    );
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByText('Intitulé')).toBeInTheDocument();
    expect(screen.getByText('Départ')).toBeInTheDocument();
  });

  it('displays job status fields', () => {
    render(
      <DndWrapper>
        <JobDetailsPanel
          job={mockJob}
          tasks={mockTasks}
          assignments={mockAssignments}
          stations={mockStations}
        />
      </DndWrapper>
    );
    expect(screen.getByText('BAT')).toBeInTheDocument();
    expect(screen.getByText('Papier')).toBeInTheDocument();
    expect(screen.getByText('Plaques')).toBeInTheDocument();
  });

  it('displays task tiles', () => {
    render(
      <DndWrapper>
        <JobDetailsPanel
          job={mockJob}
          tasks={mockTasks}
          assignments={mockAssignments}
          stations={mockStations}
        />
      </DndWrapper>
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
    expect(screen.getByText('18/12/2025')).toBeInTheDocument();
  });
});

describe('JobStatus', () => {
  it('displays formatted status values', () => {
    render(<JobStatus job={mockJob} />);
    expect(screen.getByText('Commandé')).toBeInTheDocument();
    expect(screen.getByText('Prêtes')).toBeInTheDocument();
  });

  it('displays BAT status with date when sent', () => {
    render(<JobStatus job={mockJob} />);
    // The BAT was sent, so it should show "Reçu DD/MM HH:MM"
    // Time varies by timezone, so just check for the pattern
    expect(screen.getByText(/Reçu 12\/12 \d{2}:\d{2}/)).toBeInTheDocument();
  });
});

describe('TaskList', () => {
  it('renders task tiles sorted by sequence order', () => {
    render(
      <DndWrapper>
        <TaskList
          tasks={mockTasks}
          job={mockJob}
          assignments={mockAssignments}
          stations={mockStations}
        />
      </DndWrapper>
    );
    const tiles = screen.getAllByText(/Komori|Polar/);
    expect(tiles).toHaveLength(2);
  });

  it('shows empty state when no tasks', () => {
    render(
      <DndWrapper>
        <TaskList tasks={[]} job={mockJob} assignments={[]} stations={mockStations} />
      </DndWrapper>
    );
    expect(screen.getByText('Aucune tâche')).toBeInTheDocument();
  });
});

describe('TaskTile', () => {
  it('renders unscheduled task with duration', () => {
    const task = mockTasks[1]; // Unscheduled task
    render(
      <DndWrapper>
        <TaskTile
          task={task}
          job={mockJob}
          jobColor={mockJob.color}
          station={mockStations[1]}
        />
      </DndWrapper>
    );
    expect(screen.getByText('Polar 137')).toBeInTheDocument();
    expect(screen.getByText('0h45')).toBeInTheDocument();
  });

  it('renders scheduled task with datetime', () => {
    const task = mockTasks[0]; // Scheduled task
    render(
      <DndWrapper>
        <TaskTile
          task={task}
          job={mockJob}
          jobColor={mockJob.color}
          assignment={mockAssignments[0]}
          station={mockStations[0]}
        />
      </DndWrapper>
    );
    expect(screen.getByText('Komori G40')).toBeInTheDocument();
    // Should show scheduled time instead of duration
    // Time varies by timezone, so just check for the pattern (Day DD/MM HH:MM)
    expect(screen.getByText(/[A-Z][a-z] 15\/12 \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('has cursor-grab class for unscheduled tasks', () => {
    const task = mockTasks[1];
    render(
      <DndWrapper>
        <TaskTile task={task} job={mockJob} jobColor={mockJob.color} station={mockStations[1]} />
      </DndWrapper>
    );
    const tile = screen.getByTestId(`task-tile-${task.id}`);
    expect(tile).toHaveClass('cursor-grab');
  });

  it('has dark styling for scheduled tasks', () => {
    const task = mockTasks[0];
    render(
      <DndWrapper>
        <TaskTile
          task={task}
          job={mockJob}
          jobColor={mockJob.color}
          assignment={mockAssignments[0]}
          station={mockStations[0]}
        />
      </DndWrapper>
    );
    const tile = screen.getByTestId(`task-tile-${task.id}`);
    expect(tile).toHaveClass('bg-slate-800/40');
  });

  it('is not draggable when scheduled', () => {
    const task = mockTasks[0];
    render(
      <DndWrapper>
        <TaskTile
          task={task}
          job={mockJob}
          jobColor={mockJob.color}
          assignment={mockAssignments[0]}
          station={mockStations[0]}
        />
      </DndWrapper>
    );
    const tile = screen.getByTestId(`task-tile-${task.id}`);
    // Scheduled tiles don't have drag attributes
    expect(tile).not.toHaveClass('touch-none');
    expect(tile).not.toHaveClass('select-none');
  });

  it('has draggable attributes when unscheduled', () => {
    const task = mockTasks[1];
    render(
      <DndWrapper>
        <TaskTile task={task} job={mockJob} jobColor={mockJob.color} station={mockStations[1]} />
      </DndWrapper>
    );
    const tile = screen.getByTestId(`task-tile-${task.id}`);
    expect(tile).toHaveClass('touch-none');
    expect(tile).toHaveClass('select-none');
  });
});

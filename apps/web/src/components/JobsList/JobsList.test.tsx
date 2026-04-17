import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobsList } from './JobsList';
import { JobCard } from './JobCard';
import { JobsListHeader } from './JobsListHeader';
import type { Job, Task, TaskAssignment, LateJob, ScheduleConflict, Element } from '@flux/types';

const mockJobs: Job[] = [
  {
    id: 'job-1',
    reference: '12345',
    client: 'Test Client',
    description: 'Test Job Description',
    status: 'InProgress',
    workshopExitDate: '2025-12-20',
    fullyScheduled: false,
    color: '#FF5733',
    comments: [],
    taskIds: ['task-1', 'task-2'],
    elementIds: ['element-1'],
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
    shipped: false,
    shippedAt: null,
  },
  {
    id: 'job-2',
    reference: '12346',
    client: 'Another Client',
    description: 'Another Job',
    status: 'Planned',
    workshopExitDate: '2025-12-22',
    fullyScheduled: false,
    color: '#33FF57',
    comments: [],
    taskIds: ['task-3'],
    elementIds: ['element-2'],
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
    shipped: false,
    shippedAt: null,
  },
  {
    id: 'job-3',
    reference: '12347',
    client: 'Late Client',
    description: 'Late Job',
    status: 'Delayed',
    workshopExitDate: '2025-12-10',
    fullyScheduled: false,
    color: '#5733FF',
    comments: [],
    taskIds: [],
    elementIds: ['element-3'],
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
    shipped: false,
    shippedAt: null,
  },
];

const mockElements: Element[] = [
  {
    id: 'element-1',
    jobId: 'job-1',
    name: 'Element 1',
    prerequisiteElementIds: [],
    taskIds: ['task-1', 'task-2'],
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    formeStatus: 'none',
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
  {
    id: 'element-2',
    jobId: 'job-2',
    name: 'Element 2',
    prerequisiteElementIds: [],
    taskIds: ['task-3'],
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    formeStatus: 'none',
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
  {
    id: 'element-3',
    jobId: 'job-3',
    name: 'Element 3',
    prerequisiteElementIds: [],
    taskIds: [],
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    formeStatus: 'none',
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
];

const mockTasks: Task[] = [
  {
    id: 'task-1',
    elementId: 'element-1',
    sequenceOrder: 0,
    status: 'Completed',
    type: 'Internal',
    stationId: 'station-1',
    duration: { setupMinutes: 30, runMinutes: 60 },
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
  {
    id: 'task-2',
    elementId: 'element-1',
    sequenceOrder: 1,
    status: 'Assigned',
    type: 'Internal',
    stationId: 'station-2',
    duration: { setupMinutes: 15, runMinutes: 45 },
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
  {
    id: 'task-3',
    elementId: 'element-2',
    sequenceOrder: 0,
    status: 'Ready',
    type: 'Internal',
    stationId: 'station-1',
    duration: { setupMinutes: 20, runMinutes: 30 },
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
];

const mockAssignments: TaskAssignment[] = [
  {
    id: 'assign-1',
    taskId: 'task-1',
    targetId: 'station-1',
    isOutsourced: false,
    scheduledStart: '2025-12-15T08:00:00Z',
    scheduledEnd: '2025-12-15T09:30:00Z',
    isCompleted: true,
    completedAt: '2025-12-15T09:25:00Z',
    createdAt: '2025-12-15T07:00:00Z',
    updatedAt: '2025-12-15T09:25:00Z',
  },
  {
    id: 'assign-2',
    taskId: 'task-2',
    targetId: 'station-2',
    isOutsourced: false,
    scheduledStart: '2025-12-16T08:00:00Z',
    scheduledEnd: '2025-12-16T09:00:00Z',
    isCompleted: false,
    completedAt: null,
    createdAt: '2025-12-15T07:00:00Z',
    updatedAt: '2025-12-15T07:00:00Z',
  },
];

const mockLateJobs: LateJob[] = [
  {
    jobId: 'job-1',
    deadline: '2025-12-10',
    expectedCompletion: '2025-12-18',
    delayDays: 8,
  },
];

const _mockConflicts: ScheduleConflict[] = [];

const headerStubs = {
  activeTab: 'planified' as const,
  onTabChange: () => {},
  tabCounts: { planified: 0, unplanified: 0 },
  activeChip: 'all' as const,
  onChipChange: () => {},
  chipCounts: { all: 0, late: 0, conflict: 0 },
};

describe('JobsList', () => {
  it('renders without crashing', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        lateJobs={[]}
        conflicts={[]}
      />
    );
    expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
  });

  it('renders tabs for planified / unplanified', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        lateJobs={[]}
        conflicts={[]}
      />
    );
    expect(screen.getByRole('tab', { name: /Planifiées/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Non planifiées/ })).toBeInTheDocument();
  });

  it('defaults to planified tab and shows jobs with assignments', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        lateJobs={[]}
        conflicts={[]}
      />
    );
    // job-1 has assignments (planified) — should be visible on default tab
    expect(screen.getByText('12345')).toBeInTheDocument();
    // job-2 has no assignments (unplanified) — hidden on default tab
    expect(screen.queryByText('12346')).not.toBeInTheDocument();
  });

  it('switches to unplanified tab and shows jobs without assignments', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        lateJobs={[]}
        conflicts={[]}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Non planifiées/ }));

    expect(screen.getByText('12346')).toBeInTheDocument();
    expect(screen.queryByText('12345')).not.toBeInTheDocument();
  });

  it('shows late badge for late jobs in the list', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        lateJobs={mockLateJobs}
        conflicts={[]}
      />
    );
    expect(screen.getByText('En retard')).toBeInTheDocument();
  });

  it('filters jobs by search query', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        lateJobs={[]}
        conflicts={[]}
      />
    );

    const searchInput = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(searchInput, { target: { value: 'Test Client' } });

    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.queryByText('12346')).not.toBeInTheDocument();
  });

  it('shows empty state when no jobs match search', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        lateJobs={[]}
        conflicts={[]}
      />
    );

    const searchInput = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('Aucun travail trouvé')).toBeInTheDocument();
  });

  it('calls onSelectJob when clicking a job', () => {
    const onSelectJob = vi.fn();
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        lateJobs={[]}
        conflicts={[]}
        onSelectJob={onSelectJob}
      />
    );

    fireEvent.click(screen.getByText('12345'));
    expect(onSelectJob).toHaveBeenCalledWith('job-1');
  });

  it('highlights selected job', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        elements={mockElements}
        assignments={mockAssignments}
        lateJobs={[]}
        conflicts={[]}
        selectedJobId="job-1"
      />
    );

    const jobCard = screen.getByText('12345').closest('button');
    expect(jobCard).toHaveClass('bg-white/10');
  });
});

const createTestTask = (id: string, elementId: string): Task => ({
  id,
  elementId,
  type: 'Internal',
  stationId: 'station-1',
  sequenceOrder: 0,
  status: 'Defined',
  duration: { setupMinutes: 10, runMinutes: 20 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createTestAssignment = (taskId: string, isCompleted: boolean): TaskAssignment => ({
  id: `assign-${taskId}`,
  taskId,
  targetId: 'station-1',
  isOutsourced: false,
  scheduledStart: new Date().toISOString(),
  scheduledEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  isCompleted,
  completedAt: isCompleted ? new Date().toISOString() : null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('JobCard', () => {
  it('renders job information with separator', () => {
    const tasks = [
      createTestTask('t1', 'job-1'),
      createTestTask('t2', 'job-1'),
    ];
    const assignments = [createTestAssignment('t1', true)];

    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        tasks={tasks}
        assignments={assignments}
      />
    );

    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByText('·')).toBeInTheDocument();
    expect(screen.getByText('Test Client')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('shows deadline on normal cards', () => {
    const tasks = [createTestTask('t1', 'job-1')];
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        tasks={tasks}
        assignments={[]}
        deadline="17/12"
      />
    );

    expect(screen.getByText('17/12')).toBeInTheDocument();
  });

  it('renders the progress bar', () => {
    const tasks = [createTestTask('t1', 'job-1'), createTestTask('t2', 'job-1')];
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        tasks={tasks}
        assignments={[createTestAssignment('t1', true)]}
      />
    );
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('shows "En retard" badge for late problem type', () => {
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        tasks={[createTestTask('t1', 'job-1')]}
        assignments={[]}
        problemType="late"
      />
    );
    expect(screen.getByText('En retard')).toBeInTheDocument();
  });

  it('shows "Conflit" badge for conflict problem type', () => {
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        tasks={[createTestTask('t1', 'job-1')]}
        assignments={[]}
        problemType="conflict"
      />
    );
    expect(screen.getByText('Conflit')).toBeInTheDocument();
  });

  it('shows "Terminé" badge when isCompleted', () => {
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        tasks={[createTestTask('t1', 'job-1')]}
        assignments={[createTestAssignment('t1', true)]}
        isCompleted
      />
    );
    expect(screen.getByText('Terminé')).toBeInTheDocument();
  });

  it('prioritizes problem type over completed in status', () => {
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        tasks={[createTestTask('t1', 'job-1')]}
        assignments={[createTestAssignment('t1', true)]}
        problemType="late"
        isCompleted
      />
    );
    // Late wins over completed
    expect(screen.getByText('En retard')).toBeInTheDocument();
    expect(screen.queryByText('Terminé')).not.toBeInTheDocument();
  });

  it('applies selected styling', () => {
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        tasks={[createTestTask('t1', 'job-1')]}
        assignments={[]}
        isSelected
      />
    );

    const card = screen.getByRole('button');
    expect(card).toHaveClass('bg-white/10');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        tasks={[createTestTask('t1', 'job-1')]}
        assignments={[]}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('job-1');
  });
});

describe('JobsListHeader', () => {
  it('renders search field', () => {
    render(<JobsListHeader searchQuery="" onSearchChange={() => {}} {...headerStubs} />);
    expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(<JobsListHeader searchQuery="" onSearchChange={onSearchChange} {...headerStubs} />);
    const input = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('renders both tabs with counts', () => {
    render(
      <JobsListHeader
        searchQuery=""
        onSearchChange={() => {}}
        {...headerStubs}
        tabCounts={{ planified: 7, unplanified: 8 }}
      />
    );
    const planifiedTab = screen.getByRole('tab', { name: /Planifiées/ });
    const unplanifiedTab = screen.getByRole('tab', { name: /Non planifiées/ });
    expect(planifiedTab).toHaveTextContent('7');
    expect(unplanifiedTab).toHaveTextContent('8');
  });

  it('calls onTabChange when switching tab', () => {
    const onTabChange = vi.fn();
    render(
      <JobsListHeader
        searchQuery=""
        onSearchChange={() => {}}
        {...headerStubs}
        onTabChange={onTabChange}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /Non planifiées/ }));
    expect(onTabChange).toHaveBeenCalledWith('unplanified');
  });

  it('renders all three chips: Toutes / En retard / Conflits', () => {
    render(
      <JobsListHeader
        searchQuery=""
        onSearchChange={() => {}}
        {...headerStubs}
        chipCounts={{ all: 10, late: 3, conflict: 2 }}
      />
    );
    expect(screen.getByRole('button', { name: /Toutes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /En retard/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Conflits/ })).toBeInTheDocument();
  });

  it('calls onChipChange when clicking a chip', () => {
    const onChipChange = vi.fn();
    render(
      <JobsListHeader
        searchQuery=""
        onSearchChange={() => {}}
        {...headerStubs}
        onChipChange={onChipChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /En retard/ }));
    expect(onChipChange).toHaveBeenCalledWith('late');
  });
});

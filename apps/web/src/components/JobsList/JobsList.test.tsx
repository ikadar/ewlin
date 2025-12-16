import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobsList } from './JobsList';
import { JobCard } from './JobCard';
import { ProgressDots } from './ProgressDots';
import { ProblemsSection } from './ProblemsSection';
import { JobsSection } from './JobsSection';
import { JobsListHeader } from './JobsListHeader';
import type { Job, Task, LateJob, ScheduleConflict } from '@flux/types';

// Mock data
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
    paperPurchaseStatus: 'InStock',
    proofApproval: { sentAt: null, approvedAt: null },
    platesStatus: 'Todo',
    requiredJobIds: [],
    comments: [],
    taskIds: ['task-1', 'task-2'],
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
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
    paperPurchaseStatus: 'InStock',
    proofApproval: { sentAt: null, approvedAt: null },
    platesStatus: 'Todo',
    requiredJobIds: [],
    comments: [],
    taskIds: ['task-3'],
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
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
    paperPurchaseStatus: 'InStock',
    proofApproval: { sentAt: null, approvedAt: null },
    platesStatus: 'Todo',
    requiredJobIds: [],
    comments: [],
    taskIds: [],
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
];

const mockTasks: Task[] = [
  {
    id: 'task-1',
    jobId: 'job-1',
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
    jobId: 'job-1',
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
    jobId: 'job-2',
    sequenceOrder: 0,
    status: 'Ready',
    type: 'Internal',
    stationId: 'station-1',
    duration: { setupMinutes: 20, runMinutes: 30 },
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2025-12-15T10:00:00Z',
  },
];

const mockLateJobs: LateJob[] = [
  {
    jobId: 'job-3',
    deadline: '2025-12-10',
    expectedCompletion: '2025-12-18',
    delayDays: 8,
  },
];

const _mockConflicts: ScheduleConflict[] = [];

describe('JobsList', () => {
  it('renders without crashing', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        lateJobs={[]}
        conflicts={[]}
      />
    );
    expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
  });

  it('displays all jobs', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        lateJobs={[]}
        conflicts={[]}
      />
    );
    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByText('12346')).toBeInTheDocument();
    expect(screen.getByText('12347')).toBeInTheDocument();
  });

  it('shows problems section when there are late jobs', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        lateJobs={mockLateJobs}
        conflicts={[]}
      />
    );
    expect(screen.getByText('Problèmes')).toBeInTheDocument();
    expect(screen.getByText('En retard')).toBeInTheDocument();
  });

  it('filters jobs by search query', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
        lateJobs={[]}
        conflicts={[]}
      />
    );

    const searchInput = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(searchInput, { target: { value: 'Another' } });

    expect(screen.getByText('12346')).toBeInTheDocument();
    expect(screen.queryByText('12345')).not.toBeInTheDocument();
  });

  it('shows empty state when no jobs match search', () => {
    render(
      <JobsList
        jobs={mockJobs}
        tasks={mockTasks}
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
        lateJobs={[]}
        conflicts={[]}
        selectedJobId="job-1"
      />
    );

    const jobCard = screen.getByText('12345').closest('[role="button"]');
    expect(jobCard).toHaveClass('bg-white/10');
  });
});

describe('JobCard', () => {
  it('renders job information with separator', () => {
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        taskCount={3}
        completedTaskCount={1}
      />
    );

    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByText('·')).toBeInTheDocument();
    expect(screen.getByText('Test Client')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('shows deadline on normal cards', () => {
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        taskCount={2}
        completedTaskCount={0}
        deadline="17/12"
      />
    );

    expect(screen.getByText('17/12')).toBeInTheDocument();
  });

  it('shows progress dots on normal cards', () => {
    const { container } = render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        taskCount={3}
        completedTaskCount={2}
      />
    );

    const dots = container.querySelectorAll('.rounded-full');
    expect(dots).toHaveLength(3);
  });

  it('shows late badge AND progress dots when problem type is late', () => {
    const { container } = render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        taskCount={3}
        completedTaskCount={1}
        problemType="late"
      />
    );

    expect(screen.getByText('En retard')).toBeInTheDocument();
    // Progress dots should also be shown for problem cards
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots).toHaveLength(3);
  });

  it('shows conflict badge AND progress dots when problem type is conflict', () => {
    const { container } = render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        taskCount={4}
        completedTaskCount={4}
        problemType="conflict"
      />
    );

    expect(screen.getByText('Conflit')).toBeInTheDocument();
    // Progress dots should also be shown for problem cards
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots).toHaveLength(4);
  });

  it('applies selected styling', () => {
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        taskCount={2}
        completedTaskCount={0}
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
        taskCount={2}
        completedTaskCount={0}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('handles keyboard navigation', () => {
    const onClick = vi.fn();
    render(
      <JobCard
        id="job-1"
        reference="12345"
        client="Test Client"
        description="Test Description"
        taskCount={2}
        completedTaskCount={0}
        onClick={onClick}
      />
    );

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onClick).toHaveBeenCalled();
  });
});

describe('ProgressDots', () => {
  it('renders correct number of dots', () => {
    const { container } = render(<ProgressDots total={5} completed={2} />);
    const dots = container.querySelectorAll('span');
    expect(dots).toHaveLength(5);
  });

  it('renders completed dots with filled style', () => {
    const { container } = render(<ProgressDots total={3} completed={2} />);
    const dots = container.querySelectorAll('span');

    expect(dots[0]).toHaveClass('bg-emerald-500');
    expect(dots[1]).toHaveClass('bg-emerald-500');
    expect(dots[2]).not.toHaveClass('bg-emerald-500');
  });

  it('renders pending dots with outline style', () => {
    const { container } = render(<ProgressDots total={3} completed={1} />);
    const dots = container.querySelectorAll('span');

    expect(dots[1]).toHaveClass('border-zinc-700');
    expect(dots[2]).toHaveClass('border-zinc-700');
  });

  it('returns null when total is 0', () => {
    const { container } = render(<ProgressDots total={0} completed={0} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ProblemsSection', () => {
  it('renders section with count', () => {
    render(
      <ProblemsSection count={2}>
        <div>Problem 1</div>
        <div>Problem 2</div>
      </ProblemsSection>
    );

    expect(screen.getByText('Problèmes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('returns null when count is 0', () => {
    const { container } = render(
      <ProblemsSection count={0}>
        <div>No problems</div>
      </ProblemsSection>
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('JobsSection', () => {
  it('renders section with header', () => {
    render(
      <JobsSection>
        <div>Job 1</div>
      </JobsSection>
    );

    expect(screen.getByText('Travaux')).toBeInTheDocument();
    expect(screen.getByText('Job 1')).toBeInTheDocument();
  });
});

describe('JobsListHeader', () => {
  it('renders search field', () => {
    render(
      <JobsListHeader searchQuery="" onSearchChange={() => {}} />
    );

    expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
  });

  it('renders add job button', () => {
    render(
      <JobsListHeader searchQuery="" onSearchChange={() => {}} />
    );

    expect(screen.getByLabelText('Ajouter un travail')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(
      <JobsListHeader searchQuery="" onSearchChange={onSearchChange} />
    );

    const input = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('disables add button when no handler provided', () => {
    render(
      <JobsListHeader searchQuery="" onSearchChange={() => {}} />
    );

    expect(screen.getByLabelText('Ajouter un travail')).toBeDisabled();
  });

  it('calls onAddJob when add button clicked', () => {
    const onAddJob = vi.fn();
    render(
      <JobsListHeader
        searchQuery=""
        onSearchChange={() => {}}
        onAddJob={onAddJob}
      />
    );

    fireEvent.click(screen.getByLabelText('Ajouter un travail'));
    expect(onAddJob).toHaveBeenCalled();
  });
});

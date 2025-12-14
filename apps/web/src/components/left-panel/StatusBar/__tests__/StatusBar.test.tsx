import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../../test/utils';
import { StatusBar } from '../StatusBar';
import { BatStatusIcon } from '../BatStatusIcon';
import { PlatesStatusIcon } from '../PlatesStatusIcon';
import { PaperStatusIcon } from '../PaperStatusIcon';
import type { Job, ScheduleSnapshot } from '../../../../types';

const createMockJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  reference: '45001',
  client: 'Test Client',
  description: 'Test Job',
  workshopExitDate: new Date().toISOString(),
  status: 'Planned',
  fullyScheduled: false,
  color: '#3B82F6',
  paperType: null,
  paperFormat: null,
  paperPurchaseStatus: 'InStock',
  paperOrderedAt: null,
  proofSentAt: null,
  proofApprovedAt: null,
  platesStatus: 'Todo',
  notes: '',
  comments: [],
  dependencies: [],
  tasks: [],
  ...overrides,
});

const createPreloadedState = (
  job: Job | null,
  selectedJobId: string | null = null
) => ({
  schedule: {
    snapshot: job ? {
      snapshotVersion: 1,
      generatedAt: new Date().toISOString(),
      jobs: [job],
      assignments: [],
      stations: [],
      providers: [],
      categories: [],
      groups: [],
      conflicts: [],
      lateJobs: [],
    } as ScheduleSnapshot : null,
    loading: false,
    error: null,
    lastValidation: null,
  },
  ui: {
    gridView: 'stations' as const,
    selectedTask: null,
    activePanel: 'jobs' as const,
    isDragging: false,
    draggedTaskId: null,
    timeRange: { start: '', end: '' },
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    selectedJobId,
    jobFilter: '',
    scrollToTaskId: null,
    pendingRecallTaskId: null,
    taskOrderOverrides: {},
  },
});

describe('StatusBar', () => {
  it('renders nothing when no job selected', () => {
    render(<StatusBar />);
    expect(screen.queryByTestId('status-bar')).not.toBeInTheDocument();
  });

  it('renders all three status icons when job selected', () => {
    const job = createMockJob();
    render(<StatusBar />, {
      preloadedState: createPreloadedState(job, 'job-1'),
    });

    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('bat-status-icon')).toBeInTheDocument();
    expect(screen.getByTestId('plates-status-icon')).toBeInTheDocument();
    expect(screen.getByTestId('paper-status-icon')).toBeInTheDocument();
  });
});

describe('BatStatusIcon', () => {
  it('shows awaiting status when proofSentAt is null', () => {
    render(<BatStatusIcon proofSentAt={null} proofApprovedAt={null} />);
    const icon = screen.getByTestId('bat-status-icon');
    expect(icon).toHaveAttribute('data-status', 'awaiting');
    expect(icon).toHaveAttribute('title', 'BAT: Awaiting file');
  });

  it('shows awaiting status when proofSentAt is AwaitingFile', () => {
    render(<BatStatusIcon proofSentAt="AwaitingFile" proofApprovedAt={null} />);
    const icon = screen.getByTestId('bat-status-icon');
    expect(icon).toHaveAttribute('data-status', 'awaiting');
  });

  it('shows sent status when proofSentAt is date and proofApprovedAt is null', () => {
    render(<BatStatusIcon proofSentAt="2025-01-01T10:00:00Z" proofApprovedAt={null} />);
    const icon = screen.getByTestId('bat-status-icon');
    expect(icon).toHaveAttribute('data-status', 'sent');
    expect(icon).toHaveAttribute('title', 'BAT: Sent, awaiting approval');
  });

  it('shows approved status when both dates are set', () => {
    render(<BatStatusIcon proofSentAt="2025-01-01T10:00:00Z" proofApprovedAt="2025-01-02T10:00:00Z" />);
    const icon = screen.getByTestId('bat-status-icon');
    expect(icon).toHaveAttribute('data-status', 'approved');
    expect(icon).toHaveAttribute('title', 'BAT: Approved');
  });

  it('shows noProof status when proofSentAt is NoProofRequired', () => {
    render(<BatStatusIcon proofSentAt="NoProofRequired" proofApprovedAt={null} />);
    const icon = screen.getByTestId('bat-status-icon');
    expect(icon).toHaveAttribute('data-status', 'noProof');
    expect(icon).toHaveAttribute('title', 'BAT: No proof required');
  });
});

describe('PlatesStatusIcon', () => {
  it('shows Todo status correctly', () => {
    render(<PlatesStatusIcon status="Todo" />);
    const icon = screen.getByTestId('plates-status-icon');
    expect(icon).toHaveAttribute('data-status', 'Todo');
    expect(icon).toHaveAttribute('title', 'Plates: Todo');
  });

  it('shows Done status correctly', () => {
    render(<PlatesStatusIcon status="Done" />);
    const icon = screen.getByTestId('plates-status-icon');
    expect(icon).toHaveAttribute('data-status', 'Done');
    expect(icon).toHaveAttribute('title', 'Plates: Done');
  });
});

describe('PaperStatusIcon', () => {
  it('shows InStock status correctly', () => {
    render(<PaperStatusIcon status="InStock" />);
    const icon = screen.getByTestId('paper-status-icon');
    expect(icon).toHaveAttribute('data-status', 'InStock');
    expect(icon).toHaveAttribute('title', 'Paper: In stock');
  });

  it('shows ToOrder status correctly', () => {
    render(<PaperStatusIcon status="ToOrder" />);
    const icon = screen.getByTestId('paper-status-icon');
    expect(icon).toHaveAttribute('data-status', 'ToOrder');
    expect(icon).toHaveAttribute('title', 'Paper: To order');
  });

  it('shows Ordered status correctly', () => {
    render(<PaperStatusIcon status="Ordered" />);
    const icon = screen.getByTestId('paper-status-icon');
    expect(icon).toHaveAttribute('data-status', 'Ordered');
    expect(icon).toHaveAttribute('title', 'Paper: Ordered');
  });

  it('shows Received status correctly', () => {
    render(<PaperStatusIcon status="Received" />);
    const icon = screen.getByTestId('paper-status-icon');
    expect(icon).toHaveAttribute('data-status', 'Received');
    expect(icon).toHaveAttribute('title', 'Paper: Received');
  });
});

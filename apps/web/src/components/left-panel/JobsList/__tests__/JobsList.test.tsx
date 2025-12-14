import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../../../../test/utils';
import { JobsList } from '../JobsList';
import type { Job, ScheduleSnapshot } from '../../../../types';

const createMockJob = (id: string, reference: string, client: string): Job => ({
  id,
  reference,
  client,
  description: `Description for ${reference}`,
  workshopExitDate: new Date().toISOString(),
  status: 'Planned',
  fullyScheduled: false,
  color: '#3B82F6',
  paperType: 'Couché Mat 135g',
  paperFormat: '45x64',
  paperPurchaseStatus: 'InStock',
  paperOrderedAt: null,
  proofSentAt: null,
  proofApprovedAt: null,
  platesStatus: 'Todo',
  notes: '',
  comments: [],
  dependencies: [],
  tasks: [],
});

const createMockSnapshot = (jobs: Job[]): Partial<ScheduleSnapshot> => ({
  snapshotVersion: 1,
  generatedAt: new Date().toISOString(),
  jobs,
  lateJobs: [],
  stations: [],
  providers: [],
  categories: [],
  groups: [],
  assignments: [],
  conflicts: [],
});

describe('JobsList', () => {
  it('renders list of jobs', () => {
    const jobs = [
      createMockJob('1', '45001', 'Client A'),
      createMockJob('2', '45002', 'Client B'),
    ];
    const snapshot = createMockSnapshot(jobs);

    render(<JobsList />, {
      preloadedState: {
        schedule: {
          snapshot: snapshot as ScheduleSnapshot,
          loading: false,
          error: null,
          lastValidation: null,
        },
      },
    });

    expect(screen.getByText('45001')).toBeInTheDocument();
    expect(screen.getByText('45002')).toBeInTheDocument();
  });

  it('shows empty message when no jobs', () => {
    const snapshot = createMockSnapshot([]);

    render(<JobsList />, {
      preloadedState: {
        schedule: {
          snapshot: snapshot as ScheduleSnapshot,
          loading: false,
          error: null,
          lastValidation: null,
        },
      },
    });

    expect(screen.getByText('No jobs available')).toBeInTheDocument();
  });

  it('filters jobs by reference', () => {
    const jobs = [
      createMockJob('1', '45001', 'Client A'),
      createMockJob('2', '45002', 'Client B'),
    ];
    const snapshot = createMockSnapshot(jobs);

    const { store } = render(<JobsList />, {
      preloadedState: {
        schedule: {
          snapshot: snapshot as ScheduleSnapshot,
          loading: false,
          error: null,
          lastValidation: null,
        },
      },
    });

    // Type in filter
    fireEvent.change(screen.getByPlaceholderText('Filter jobs...'), {
      target: { value: '45001' },
    });

    // Check store updated
    expect(store.getState().ui.jobFilter).toBe('45001');

    // Only matching job should be visible
    expect(screen.getByText('45001')).toBeInTheDocument();
    expect(screen.queryByText('45002')).not.toBeInTheDocument();
  });

  it('filters jobs by client', () => {
    const jobs = [
      createMockJob('1', '45001', 'Acme Corp'),
      createMockJob('2', '45002', 'Beta Inc'),
    ];
    const snapshot = createMockSnapshot(jobs);

    render(<JobsList />, {
      preloadedState: {
        schedule: {
          snapshot: snapshot as ScheduleSnapshot,
          loading: false,
          error: null,
          lastValidation: null,
        },
      },
    });

    fireEvent.change(screen.getByPlaceholderText('Filter jobs...'), {
      target: { value: 'acme' },
    });

    expect(screen.getByText('45001')).toBeInTheDocument();
    expect(screen.queryByText('45002')).not.toBeInTheDocument();
  });

  it('filters jobs by description', () => {
    const jobs = [
      createMockJob('1', '45001', 'Client A'),
      createMockJob('2', '45002', 'Client B'),
    ];
    jobs[0].description = 'Brochures for event';
    jobs[1].description = 'Business cards';
    const snapshot = createMockSnapshot(jobs);

    render(<JobsList />, {
      preloadedState: {
        schedule: {
          snapshot: snapshot as ScheduleSnapshot,
          loading: false,
          error: null,
          lastValidation: null,
        },
      },
    });

    fireEvent.change(screen.getByPlaceholderText('Filter jobs...'), {
      target: { value: 'brochures' },
    });

    expect(screen.getByText('45001')).toBeInTheDocument();
    expect(screen.queryByText('45002')).not.toBeInTheDocument();
  });

  it('shows "no match" message when filter has no results', () => {
    const jobs = [createMockJob('1', '45001', 'Client A')];
    const snapshot = createMockSnapshot(jobs);

    render(<JobsList />, {
      preloadedState: {
        schedule: {
          snapshot: snapshot as ScheduleSnapshot,
          loading: false,
          error: null,
          lastValidation: null,
        },
      },
    });

    fireEvent.change(screen.getByPlaceholderText('Filter jobs...'), {
      target: { value: 'xyz123' },
    });

    expect(screen.getByText('No jobs match the filter')).toBeInTheDocument();
  });

  it('selects job when clicked', () => {
    const jobs = [createMockJob('job-1', '45001', 'Client A')];
    const snapshot = createMockSnapshot(jobs);

    const { store } = render(<JobsList />, {
      preloadedState: {
        schedule: {
          snapshot: snapshot as ScheduleSnapshot,
          loading: false,
          error: null,
          lastValidation: null,
        },
      },
    });

    fireEvent.click(screen.getByText('45001'));

    expect(store.getState().ui.selectedJobId).toBe('job-1');
  });

  it('shows job count', () => {
    const jobs = [
      createMockJob('1', '45001', 'Client A'),
      createMockJob('2', '45002', 'Client B'),
      createMockJob('3', '45003', 'Client C'),
    ];
    const snapshot = createMockSnapshot(jobs);

    render(<JobsList />, {
      preloadedState: {
        schedule: {
          snapshot: snapshot as ScheduleSnapshot,
          loading: false,
          error: null,
          lastValidation: null,
        },
      },
    });

    expect(screen.getByText('3 of 3 jobs')).toBeInTheDocument();
  });

  it('shows filtered job count', () => {
    const jobs = [
      createMockJob('1', '45001', 'Client A'),
      createMockJob('2', '45002', 'Client B'),
      createMockJob('3', '45003', 'Client C'),
    ];
    const snapshot = createMockSnapshot(jobs);

    render(<JobsList />, {
      preloadedState: {
        schedule: {
          snapshot: snapshot as ScheduleSnapshot,
          loading: false,
          error: null,
          lastValidation: null,
        },
      },
    });

    fireEvent.change(screen.getByPlaceholderText('Filter jobs...'), {
      target: { value: '45001' },
    });

    expect(screen.getByText('1 of 3 jobs')).toBeInTheDocument();
  });

  it('has Jobs header', () => {
    render(<JobsList />);
    expect(screen.getByText('Jobs')).toBeInTheDocument();
  });

  it('has Add Job button', () => {
    render(<JobsList />);
    expect(screen.getByTitle('Add Job')).toBeInTheDocument();
  });
});

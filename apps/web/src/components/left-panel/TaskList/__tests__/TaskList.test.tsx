import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../../../../test/utils';
import { TaskList } from '../TaskList';
import type { Job, Task, ScheduleSnapshot, Assignment } from '../../../../types';

const createMockTask = (id: string, seq: number, station: string): Task => ({
  id,
  jobId: 'job-1',
  sequenceOrder: seq,
  type: 'internal',
  stationId: `station-${seq}`,
  stationName: station,
  setupMinutes: 10,
  runMinutes: 30,
  totalMinutes: 40,
  providerId: null,
  providerName: null,
  actionType: null,
  durationOpenDays: null,
  comment: null,
  status: 'Ready',
  rawInput: `[${station}] 10+30`,
});

const createMockJob = (tasks: Task[]): Job => ({
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
  tasks,
});

const createMockSnapshot = (jobs: Job[], assignments: Assignment[] = []): ScheduleSnapshot => ({
  snapshotVersion: 1,
  generatedAt: new Date().toISOString(),
  jobs,
  assignments,
  stations: [],
  providers: [],
  categories: [],
  groups: [],
  conflicts: [],
  lateJobs: [],
});

const createPreloadedState = (
  snapshot: ScheduleSnapshot | null,
  selectedJobId: string | null = null
) => ({
  schedule: {
    snapshot,
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

describe('TaskList', () => {
  it('renders empty state when no job selected', () => {
    render(<TaskList />);
    expect(screen.getByText('Select a job to see its tasks')).toBeInTheDocument();
  });

  it('renders empty state when job has no tasks', () => {
    const job = createMockJob([]);
    const snapshot = createMockSnapshot([job]);

    render(<TaskList />, {
      preloadedState: createPreloadedState(snapshot, 'job-1'),
    });

    expect(screen.getByText('No tasks defined for this job')).toBeInTheDocument();
  });

  it('renders task list in sequence order', () => {
    const tasks = [
      createMockTask('t3', 3, 'Station C'),
      createMockTask('t1', 1, 'Station A'),
      createMockTask('t2', 2, 'Station B'),
    ];
    const job = createMockJob(tasks);
    const snapshot = createMockSnapshot([job]);

    render(<TaskList />, {
      preloadedState: createPreloadedState(snapshot, 'job-1'),
    });

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Station A');
    expect(items[1]).toHaveTextContent('Station B');
    expect(items[2]).toHaveTextContent('Station C');
  });

  it('shows scheduled count', () => {
    const tasks = [
      createMockTask('t1', 1, 'Station A'),
      createMockTask('t2', 2, 'Station B'),
      createMockTask('t3', 3, 'Station C'),
    ];
    const job = createMockJob(tasks);
    const assignments: Assignment[] = [
      { id: 'a1', taskId: 't1', jobId: 'job-1', stationId: 's1', scheduledStart: '', scheduledEnd: '', isCompleted: false, completedAt: null },
    ];
    const snapshot = createMockSnapshot([job], assignments);

    render(<TaskList />, {
      preloadedState: createPreloadedState(snapshot, 'job-1'),
    });

    expect(screen.getByText('1 of 3 scheduled')).toBeInTheDocument();
  });

  it('dispatches scrollToTask on single click of scheduled task', () => {
    const tasks = [createMockTask('t1', 1, 'Station A')];
    const job = createMockJob(tasks);
    const assignments: Assignment[] = [
      { id: 'a1', taskId: 't1', jobId: 'job-1', stationId: 's1', scheduledStart: '', scheduledEnd: '', isCompleted: false, completedAt: null },
    ];
    const snapshot = createMockSnapshot([job], assignments);

    const { store } = render(<TaskList />, {
      preloadedState: createPreloadedState(snapshot, 'job-1'),
    });

    fireEvent.click(screen.getByRole('listitem'));
    expect(store.getState().ui.scrollToTaskId).toBe('t1');
  });

  it('dispatches recallTask on double click of scheduled task', () => {
    const tasks = [createMockTask('t1', 1, 'Station A')];
    const job = createMockJob(tasks);
    const assignments: Assignment[] = [
      { id: 'a1', taskId: 't1', jobId: 'job-1', stationId: 's1', scheduledStart: '', scheduledEnd: '', isCompleted: false, completedAt: null },
    ];
    const snapshot = createMockSnapshot([job], assignments);

    const { store } = render(<TaskList />, {
      preloadedState: createPreloadedState(snapshot, 'job-1'),
    });

    fireEvent.doubleClick(screen.getByRole('listitem'));
    expect(store.getState().ui.pendingRecallTaskId).toBe('t1');
  });

  it('reorders tasks when move up clicked', () => {
    const tasks = [
      createMockTask('t1', 1, 'Station A'),
      createMockTask('t2', 2, 'Station B'),
    ];
    const job = createMockJob(tasks);
    const snapshot = createMockSnapshot([job]);

    const { store } = render(<TaskList />, {
      preloadedState: createPreloadedState(snapshot, 'job-1'),
    });

    // Click move up on second task
    const moveUpButtons = screen.getAllByLabelText('Move task up');
    fireEvent.click(moveUpButtons[1]); // Second task's move up

    expect(store.getState().ui.taskOrderOverrides['job-1']).toEqual(['t2', 't1']);
  });
});

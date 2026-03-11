import { describe, it, expect } from 'vitest';
import { computeTimeWindows } from './timeWindows';
import type { ScheduleSnapshot, Task, Station, Job, Element, TaskAssignment, StationCategory, StationGroup } from '@flux/types';
import { DRY_TIME_MS, getDeadlineDate } from '@flux/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createSnapshot(overrides: Partial<ScheduleSnapshot> = {}): ScheduleSnapshot {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stations: [],
    categories: [],
    groups: [],
    providers: [],
    jobs: [],
    elements: [],
    tasks: [],
    assignments: [],
    lateJobs: [],
    conflicts: [],
    ...overrides,
  };
}

function createStation(id: string, name: string = id): Station {
  return {
    id,
    name,
    categoryId: 'cat-1',
    groupId: 'grp-1',
    capacity: 1,
    status: 'Available',
    operatingSchedule: {
      monday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
      tuesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
      wednesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
      thursday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
      friday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
      saturday: { isOperating: false, slots: [] },
      sunday: { isOperating: false, slots: [] },
    },
    exceptions: [],
  };
}

function createOffsetStation(id: string, name: string = id): Station {
  return { ...createStation(id, name), categoryId: 'cat-offset' };
}

function createOffsetCategory(): StationCategory {
  return {
    id: 'cat-offset',
    name: 'Presse offset',
    description: '',
    similarityCriteria: [
      { name: 'Papier', fieldPath: 'papier' },
      { name: 'Format', fieldPath: 'format' },
    ],
  };
}

function createDefaultCategory(): StationCategory {
  return { id: 'cat-1', name: 'Finition', description: '', similarityCriteria: [] };
}

function createGroup(): StationGroup {
  return { id: 'grp-1', name: 'Group 1', maxConcurrent: null, isOutsourcedProviderGroup: false };
}

function createJob(id: string, exitDate: string = '2024-01-20'): Job {
  return {
    id,
    reference: id,
    client: 'Client',
    description: 'Job',
    workshopExitDate: exitDate,
    status: 'InProgress',
    color: '#FF0000',
    fullyScheduled: false,
    comments: [],
    elementIds: [],
    taskIds: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function createElement(
  id: string,
  jobId: string,
  taskIds: string[] = [],
  prereqs: string[] = []
): Element {
  return {
    id,
    jobId,
    name: 'ELT',
    prerequisiteElementIds: prereqs,
    taskIds,
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    formeStatus: 'none',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function createTask(
  id: string,
  elementId: string,
  stationId: string,
  sequenceOrder: number,
  durationMinutes: number = 60
): Task {
  return {
    id,
    elementId,
    type: 'Internal',
    stationId,
    sequenceOrder,
    status: 'Assigned',
    duration: { setupMinutes: 0, runMinutes: durationMinutes },
    rawDsl: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  } as Task;
}

function createAssignment(
  id: string,
  taskId: string,
  stationId: string,
  scheduledStart: string,
  scheduledEnd: string
): TaskAssignment {
  return {
    id,
    taskId,
    targetId: stationId,
    isOutsourced: false,
    scheduledStart,
    scheduledEnd,
    isCompleted: false,
    completedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('computeTimeWindows', () => {
  describe('forward pass — earliestStart', () => {
    it('single task with no predecessors → earliestStart = now', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1')],
        elements: [createElement('e1', 'j1', ['t1'])],
        tasks: [createTask('t1', 'e1', 's1', 0)],
        assignments: [createAssignment('a1', 't1', 's1', '2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z')],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      expect(windows.has('t1')).toBe(true);
      expect(windows.get('t1')!.earliestStart).toBe(now.getTime());
    });

    it('linear chain A→B→C: B.earliest = A.end, C.earliest = B.end', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1')],
        elements: [createElement('e1', 'j1', ['tA', 'tB', 'tC'])],
        tasks: [
          createTask('tA', 'e1', 's1', 0, 60),
          createTask('tB', 'e1', 's1', 1, 60),
          createTask('tC', 'e1', 's1', 2, 60),
        ],
        assignments: [
          createAssignment('a1', 'tA', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 'tB', 's1', '2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'),
          createAssignment('a3', 'tC', 's1', '2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z'),
        ],
      });

      const { windows } = computeTimeWindows(snapshot, now);

      const esA = windows.get('tA')!.earliestStart;
      const esB = windows.get('tB')!.earliestStart;
      const esC = windows.get('tC')!.earliestStart;

      // A starts at now
      expect(esA).toBe(now.getTime());
      // B starts after A ends (A starts at now + 60min)
      expect(esB).toBeGreaterThan(esA);
      // C starts after B ends
      expect(esC).toBeGreaterThan(esB);
    });

    it('printing predecessor adds DRY_TIME (240 min) to earliest', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const offsetStation = createOffsetStation('s-press');
      const finishStation = createStation('s-finish');

      const snapshot = createSnapshot({
        stations: [offsetStation, finishStation],
        categories: [createOffsetCategory(), createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1')],
        elements: [createElement('e1', 'j1', ['t-press', 't-finish'])],
        tasks: [
          createTask('t-press', 'e1', 's-press', 0, 60),
          createTask('t-finish', 'e1', 's-finish', 1, 60),
        ],
        assignments: [
          createAssignment('a1', 't-press', 's-press', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 't-finish', 's-finish', '2024-01-15T15:00:00Z', '2024-01-15T16:00:00Z'),
        ],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      const esFinish = windows.get('t-finish')!.earliestStart;
      const esPress = windows.get('t-press')!.earliestStart;

      // Press task at now (10:00), ends 11:00, + 240min dry = 15:00
      // Finish earliest should be at least press.end + DRY_TIME
      const pressEnd = esPress + 60 * 60 * 1000; // 11:00
      expect(esFinish).toBeGreaterThanOrEqual(pressEnd + DRY_TIME_MS);
    });

    it('cross-element predecessor: dependent element waits for prerequisite', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station1 = createStation('s1');
      const station2 = createStation('s2');

      const snapshot = createSnapshot({
        stations: [station1, station2],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1')],
        elements: [
          createElement('e-prereq', 'j1', ['t-prereq']),
          createElement('e-dep', 'j1', ['t-dep'], ['e-prereq']),
        ],
        tasks: [
          createTask('t-prereq', 'e-prereq', 's1', 0, 120),
          createTask('t-dep', 'e-dep', 's2', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 't-prereq', 's1', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z'),
          createAssignment('a2', 't-dep', 's2', '2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z'),
        ],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      const esDep = windows.get('t-dep')!.earliestStart;
      const esPrereq = windows.get('t-prereq')!.earliestStart;

      // Dependent task must wait for prerequisite to end
      const prereqEnd = esPrereq + 120 * 60 * 1000;
      expect(esDep).toBeGreaterThanOrEqual(prereqEnd);
    });

    it('diamond dependency: C.earliest = max(A.end, B.end)', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const s1 = createStation('s1');
      const s2 = createStation('s2');
      const s3 = createStation('s3');

      const snapshot = createSnapshot({
        stations: [s1, s2, s3],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1')],
        elements: [
          createElement('eA', 'j1', ['tA']),
          createElement('eB', 'j1', ['tB']),
          createElement('eC', 'j1', ['tC'], ['eA', 'eB']),
        ],
        tasks: [
          createTask('tA', 'eA', 's1', 0, 60),   // ends 11:00
          createTask('tB', 'eB', 's2', 0, 120),   // ends 12:00
          createTask('tC', 'eC', 's3', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 'tA', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 'tB', 's2', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z'),
          createAssignment('a3', 'tC', 's3', '2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z'),
        ],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      const esC = windows.get('tC')!.earliestStart;

      // C depends on both A (ends 11:00) and B (ends 12:00) → C.earliest >= 12:00
      const bEnd = now.getTime() + 120 * 60 * 1000;
      expect(esC).toBeGreaterThanOrEqual(bEnd);
    });

    it('outsourced predecessor: successor earliest = outsourced.returnDate', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('s1');

      const outsourcedTask = {
        id: 't-out',
        elementId: 'e1',
        type: 'Outsourced' as const,
        providerId: 'prov-1',
        actionType: 'Pelliculage',
        sequenceOrder: 0,
        status: 'Assigned' as const,
        duration: { openDays: 3, latestDepartureTime: '14:00', receptionTime: '10:00' },
        manualReturn: '2024-01-18T10:00:00Z',
        rawDsl: '',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1')],
        elements: [createElement('e1', 'j1', ['t-out', 't-internal'])],
        tasks: [
          outsourcedTask as unknown as Task,
          createTask('t-internal', 'e1', 's1', 1, 60),
        ],
        assignments: [
          { ...createAssignment('a1', 't-out', 'prov-1', '2024-01-15T14:00:00Z', '2024-01-18T10:00:00Z'), isOutsourced: true },
          createAssignment('a2', 't-internal', 's1', '2024-01-18T10:00:00Z', '2024-01-18T11:00:00Z'),
        ],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      const esInternal = windows.get('t-internal')!.earliestStart;

      // Internal task must wait for outsourced manualReturn
      expect(esInternal).toBeGreaterThanOrEqual(new Date('2024-01-18T10:00:00Z').getTime());
    });

    it('ignores unassigned predecessor tasks', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1')],
        elements: [createElement('e1', 'j1', ['t1', 't2'])],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60), // no assignment
          createTask('t2', 'e1', 's1', 1, 60),
        ],
        assignments: [
          // Only t2 is assigned
          createAssignment('a2', 't2', 's1', '2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z'),
        ],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      // t1 has no assignment so no window; t2 should just have now as earliest
      expect(windows.has('t1')).toBe(false);
      expect(windows.get('t2')!.earliestStart).toBe(now.getTime());
    });
  });

  describe('backward pass — latestEnd', () => {
    it('leaf task (no successors) → latestEnd = workshopExitDate', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1', '2024-01-20')],
        elements: [createElement('e1', 'j1', ['t1'])],
        tasks: [createTask('t1', 'e1', 's1', 0, 60)],
        assignments: [createAssignment('a1', 't1', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z')],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      const deadlineMs = getDeadlineDate('2024-01-20').getTime();
      expect(windows.get('t1')!.latestEnd).toBe(deadlineMs);
    });

    it('linear chain: latestEnd propagates backward from deadline', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1', '2024-01-20')],
        elements: [createElement('e1', 'j1', ['t1', 't2'])],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60),
          createTask('t2', 'e1', 's1', 1, 60),
        ],
        assignments: [
          createAssignment('a1', 't1', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 't2', 's1', '2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'),
        ],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      const le1 = windows.get('t1')!.latestEnd;
      const le2 = windows.get('t2')!.latestEnd;

      // t2 latestEnd = deadline
      // t1 latestEnd = t2.latestStart = t2.latestEnd - t2.duration
      expect(le1).toBeLessThan(le2);
    });

    it('printing task: latestEnd reduced by DRY_TIME before successor', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const offsetStation = createOffsetStation('s-press');
      const finishStation = createStation('s-finish');

      const snapshot = createSnapshot({
        stations: [offsetStation, finishStation],
        categories: [createOffsetCategory(), createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1', '2024-01-20')],
        elements: [createElement('e1', 'j1', ['t-press', 't-finish'])],
        tasks: [
          createTask('t-press', 'e1', 's-press', 0, 60),
          createTask('t-finish', 'e1', 's-finish', 1, 60),
        ],
        assignments: [
          createAssignment('a1', 't-press', 's-press', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 't-finish', 's-finish', '2024-01-15T15:00:00Z', '2024-01-15T16:00:00Z'),
        ],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      const lePress = windows.get('t-press')!.latestEnd;
      const leFinish = windows.get('t-finish')!.latestEnd;

      // Press latestEnd should be reduced by DRY_TIME compared to finish latestStart
      const finishLatestStart = leFinish - 60 * 60 * 1000;
      expect(lePress).toBeLessThanOrEqual(finishLatestStart - DRY_TIME_MS);
    });

    it('diamond dependency: feeding two successors → latestEnd = min', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const s1 = createStation('s1');
      const s2 = createStation('s2');
      const s3 = createStation('s3');

      const snapshot = createSnapshot({
        stations: [s1, s2, s3],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [
          createJob('j1', '2024-01-20'),
          createJob('j2', '2024-01-18'), // earlier deadline
        ],
        elements: [
          createElement('eA', 'j1', ['tA']),
          createElement('eB', 'j1', ['tB'], ['eA']),
          createElement('eC', 'j2', ['tC'], ['eA']),
        ],
        tasks: [
          createTask('tA', 'eA', 's1', 0, 60),
          createTask('tB', 'eB', 's2', 0, 120),
          createTask('tC', 'eC', 's3', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 'tA', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 'tB', 's2', '2024-01-15T11:00:00Z', '2024-01-15T13:00:00Z'),
          createAssignment('a3', 'tC', 's3', '2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'),
        ],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      const leA = windows.get('tA')!.latestEnd;
      const leB = windows.get('tB')!.latestEnd;
      const leC = windows.get('tC')!.latestEnd;

      // A feeds both B and C. C has earlier deadline → A.latestEnd is constrained by C
      const bLatestStart = leB - 120 * 60 * 1000;
      const cLatestStart = leC - 60 * 60 * 1000;
      const expectedLatest = Math.min(bLatestStart, cLatestStart);
      expect(leA).toBe(expectedLatest);
    });
  });

  describe('slack computation', () => {
    it('slack = latestStart - earliestStart (positive = flexible)', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1', '2024-01-20')], // plenty of slack
        elements: [createElement('e1', 'j1', ['t1'])],
        tasks: [createTask('t1', 'e1', 's1', 0, 60)],
        assignments: [createAssignment('a1', 't1', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z')],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      const tw = windows.get('t1')!;

      expect(tw.slack).toBeGreaterThan(0);
      const latestStart = tw.latestEnd - 60 * 60 * 1000; // duration
      expect(tw.slack).toBe(latestStart - tw.earliestStart);
    });

    it('critical task: slack ≤ 0 when deadline is tight', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('s1');

      // Deadline barely allows the task to fit
      const snapshot = createSnapshot({
        stations: [station],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1', '2024-01-15T11:00:00Z')], // exact fit
        elements: [createElement('e1', 'j1', ['t1'])],
        tasks: [createTask('t1', 'e1', 's1', 0, 60)],
        assignments: [createAssignment('a1', 't1', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z')],
      });

      const { windows } = computeTimeWindows(snapshot, now);
      const tw = windows.get('t1')!;

      expect(tw.slack).toBeLessThanOrEqual(0);
    });

    it('identifies critical vs flexible tiles in a mixed set', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const s1 = createStation('s1');
      const s2 = createStation('s2');

      const snapshot = createSnapshot({
        stations: [s1, s2],
        categories: [createDefaultCategory()],
        groups: [createGroup()],
        jobs: [
          createJob('j1', '2024-01-15T11:00:00Z'), // tight
          createJob('j2', '2024-01-25'),             // relaxed
        ],
        elements: [
          createElement('e1', 'j1', ['t1']),
          createElement('e2', 'j2', ['t2']),
        ],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60),
          createTask('t2', 'e2', 's2', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 't1', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 't2', 's2', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        ],
      });

      const { windows } = computeTimeWindows(snapshot, now);

      expect(windows.get('t1')!.slack).toBeLessThanOrEqual(0); // critical
      expect(windows.get('t2')!.slack).toBeGreaterThan(0);     // flexible
    });
  });
});

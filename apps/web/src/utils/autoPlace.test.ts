import { describe, it, expect } from 'vitest';
import { autoPlace } from './autoPlace';
import type { ScheduleSnapshot, TaskAssignment, Task, Station, InternalTask, Job, Element, StationCategory } from '@flux/types';

// ============================================================================
// Test helpers (mirrors compactTimeline.test.ts pattern)
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

/** Create a printing (offset) station that requires drying time. */
function createPrintingStation(id: string, name: string = id): Station {
  return { ...createStation(id, name), categoryId: 'cat-offset' };
}

function createJob(id: string, workshopExitDate: string = '2026-03-20'): Job {
  return {
    id,
    reference: id,
    client: 'Test Client',
    description: 'Test Job',
    workshopExitDate,
    status: 'InProgress',
    color: '#FF0000',
    fullyScheduled: false,
    comments: [],
    elementIds: [`elem-${id}`],
    taskIds: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function createElement(
  id: string,
  jobId: string,
  taskIds: string[],
  prerequisiteElementIds: string[] = []
): Element {
  return {
    id,
    jobId,
    name: id,
    prerequisiteElementIds,
    taskIds,
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    formeStatus: 'none',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
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
    status: 'Defined',
    duration: { setupMinutes: 0, runMinutes: durationMinutes },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

const defaultCategory: StationCategory = {
  id: 'cat-1',
  name: 'General',
  displayOrder: 0,
};

const offsetCategory: StationCategory = {
  id: 'cat-offset',
  name: 'Offset',
  displayOrder: 1,
};

function mockCalculateEndTime(task: InternalTask, start: string): string {
  const startDate = new Date(start);
  const durationMs = (task.duration.setupMinutes + task.duration.runMinutes) * 60 * 1000;
  return new Date(startDate.getTime() + durationMs).toISOString();
}

// ============================================================================
// Tests
// ============================================================================

describe('autoPlace', () => {
  describe('empty / no-op cases', () => {
    it('returns unchanged snapshot when no jobs specified', () => {
      const snapshot = createSnapshot();
      const result = autoPlace({
        snapshot,
        jobIds: [],
        calculateEndTime: mockCalculateEndTime,
      });
      expect(result.placedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('returns unchanged snapshot when job has no tasks', () => {
      const snapshot = createSnapshot({
        jobs: [createJob('job-1')],
        elements: [createElement('elem-job-1', 'job-1', [])],
      });
      const result = autoPlace({
        snapshot,
        jobIds: ['job-1'],
        calculateEndTime: mockCalculateEndTime,
      });
      expect(result.placedCount).toBe(0);
    });

    it('skips already-assigned tasks', () => {
      const station = createStation('s1');
      const task = createTask('t1', 'elem-j1', 's1', 0, 60);
      const snapshot = createSnapshot({
        stations: [station],
        categories: [defaultCategory],
        jobs: [createJob('j1')],
        elements: [createElement('elem-j1', 'j1', ['t1'])],
        tasks: [task],
        assignments: [createAssignment('a1', 't1', 's1', '2026-03-18T10:00:00Z', '2026-03-18T11:00:00Z')],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.placedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
    });
  });

  describe('single job, linear chain — ALAP placement', () => {
    it('places a single task as late as possible before deadline', () => {
      // Deadline: 2026-03-20 14:00 (Friday)
      // Task: 60 min on station s1
      // Expected: placed at 13:00-14:00 on March 20
      const station = createStation('s1');
      const task = createTask('t1', 'elem-j1', 's1', 0, 60);
      const snapshot = createSnapshot({
        stations: [station],
        categories: [defaultCategory],
        jobs: [createJob('j1', '2026-03-20')],
        elements: [createElement('elem-j1', 'j1', ['t1'])],
        tasks: [task],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now: new Date('2026-03-16T08:00:00Z'), // Monday
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.placedCount).toBe(1);
      const placed = result.snapshot.assignments.find((a) => a.taskId === 't1');
      expect(placed).toBeDefined();

      // Should end at or before 14:00 on March 20
      const endTime = new Date(placed!.scheduledEnd);
      const deadline = new Date('2026-03-20T14:00:00Z');
      expect(endTime.getTime()).toBeLessThanOrEqual(deadline.getTime());

      // Should be as late as possible
      const startTime = new Date(placed!.scheduledStart);
      expect(startTime.getHours()).toBe(13);
    });

    it('places a two-task chain ALAP with correct precedence', () => {
      // Two tasks: t1 (station s1, 60min) → t2 (station s2, 60min)
      // Deadline: 2026-03-20 14:00
      // Expected: t2 at 13:00-14:00, t1 at 12:00-13:00
      const s1 = createStation('s1');
      const s2 = createStation('s2');
      const t1 = createTask('t1', 'elem-j1', 's1', 0, 60);
      const t2 = createTask('t2', 'elem-j1', 's2', 1, 60);

      const snapshot = createSnapshot({
        stations: [s1, s2],
        categories: [defaultCategory],
        jobs: [createJob('j1', '2026-03-20')],
        elements: [createElement('elem-j1', 'j1', ['t1', 't2'])],
        tasks: [t1, t2],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now: new Date('2026-03-16T08:00:00Z'),
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.placedCount).toBe(2);

      const a1 = result.snapshot.assignments.find((a) => a.taskId === 't1')!;
      const a2 = result.snapshot.assignments.find((a) => a.taskId === 't2')!;

      // t1 must end before t2 starts (precedence)
      expect(new Date(a1.scheduledEnd).getTime()).toBeLessThanOrEqual(
        new Date(a2.scheduledStart).getTime()
      );

      // t2 should end at or before deadline
      expect(new Date(a2.scheduledEnd).getTime()).toBeLessThanOrEqual(
        new Date('2026-03-20T14:00:00Z').getTime()
      );
    });
  });

  describe('multi-element job with cross-element dependencies', () => {
    it('respects prerequisiteElementIds', () => {
      // Element A (t1) → Element B (t2), both on different stations
      const s1 = createStation('s1');
      const s2 = createStation('s2');
      const t1 = createTask('t1', 'elem-a', 's1', 0, 60);
      const t2 = createTask('t2', 'elem-b', 's2', 0, 60);

      const snapshot = createSnapshot({
        stations: [s1, s2],
        categories: [defaultCategory],
        jobs: [{ ...createJob('j1', '2026-03-20'), elementIds: ['elem-a', 'elem-b'] }],
        elements: [
          createElement('elem-a', 'j1', ['t1']),
          createElement('elem-b', 'j1', ['t2'], ['elem-a']), // B depends on A
        ],
        tasks: [t1, t2],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now: new Date('2026-03-16T08:00:00Z'),
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.placedCount).toBe(2);

      const a1 = result.snapshot.assignments.find((a) => a.taskId === 't1')!;
      const a2 = result.snapshot.assignments.find((a) => a.taskId === 't2')!;

      // t1 must end before t2 starts
      expect(new Date(a1.scheduledEnd).getTime()).toBeLessThanOrEqual(
        new Date(a2.scheduledStart).getTime()
      );
    });
  });

  describe('two jobs competing for same station', () => {
    it('places both jobs without overlap', () => {
      const station = createStation('s1');
      const t1 = createTask('t1', 'elem-j1', 's1', 0, 60);
      const t2 = createTask('t2', 'elem-j2', 's1', 0, 60);

      // Job 1 deadline: March 20, Job 2 deadline: March 19 (earlier = higher priority)
      const snapshot = createSnapshot({
        stations: [station],
        categories: [defaultCategory],
        jobs: [createJob('j1', '2026-03-20'), createJob('j2', '2026-03-19')],
        elements: [
          createElement('elem-j1', 'j1', ['t1']),
          createElement('elem-j2', 'j2', ['t2']),
        ],
        tasks: [t1, t2],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1', 'j2'],
        now: new Date('2026-03-16T08:00:00Z'),
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.placedCount).toBe(2);

      const a1 = result.snapshot.assignments.find((a) => a.taskId === 't1')!;
      const a2 = result.snapshot.assignments.find((a) => a.taskId === 't2')!;

      // No overlap
      const s1 = new Date(a1.scheduledStart).getTime();
      const e1 = new Date(a1.scheduledEnd).getTime();
      const s2 = new Date(a2.scheduledStart).getTime();
      const e2 = new Date(a2.scheduledEnd).getTime();

      const noOverlap = e1 <= s2 || e2 <= s1;
      expect(noOverlap).toBe(true);
    });
  });

  describe('drying time', () => {
    it('adds drying time gap after printing station', () => {
      // t1 on printing station → t2 on regular station
      // Drying time = 4h = 240 min
      const s1 = createPrintingStation('s1');
      const s2 = createStation('s2');
      const t1 = createTask('t1', 'elem-j1', 's1', 0, 60);
      const t2 = createTask('t2', 'elem-j1', 's2', 1, 60);

      const snapshot = createSnapshot({
        stations: [s1, s2],
        categories: [defaultCategory, offsetCategory],
        jobs: [createJob('j1', '2026-03-20')],
        elements: [createElement('elem-j1', 'j1', ['t1', 't2'])],
        tasks: [t1, t2],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now: new Date('2026-03-16T08:00:00Z'),
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.placedCount).toBe(2);

      const a1 = result.snapshot.assignments.find((a) => a.taskId === 't1')!;
      const a2 = result.snapshot.assignments.find((a) => a.taskId === 't2')!;

      // Gap between t1 end and t2 start must be at least DRY_TIME_MS (4h)
      const gap = new Date(a2.scheduledStart).getTime() - new Date(a1.scheduledEnd).getTime();
      expect(gap).toBeGreaterThanOrEqual(4 * 60 * 60 * 1000);
    });
  });

  describe('already-assigned tasks as barriers', () => {
    it('respects existing assignments as immovable barriers', () => {
      // Task t1 is unscheduled, t2 is already assigned at 12:00-13:00
      // t1 → t2 precedence, so t1 must end before 12:00
      const s1 = createStation('s1');
      const s2 = createStation('s2');
      const t1 = createTask('t1', 'elem-j1', 's1', 0, 60);
      const t2 = createTask('t2', 'elem-j1', 's2', 1, 60);

      const snapshot = createSnapshot({
        stations: [s1, s2],
        categories: [defaultCategory],
        jobs: [createJob('j1', '2026-03-20')],
        elements: [createElement('elem-j1', 'j1', ['t1', 't2'])],
        tasks: [t1, t2],
        assignments: [
          createAssignment('existing', 't2', 's2', '2026-03-20T12:00:00Z', '2026-03-20T13:00:00Z'),
        ],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now: new Date('2026-03-16T08:00:00Z'),
        calculateEndTime: mockCalculateEndTime,
      });

      // Only t1 should be placed (t2 is already assigned)
      expect(result.placedCount).toBe(1);

      const a1 = result.snapshot.assignments.find((a) => a.taskId === 't1' && a.id.startsWith('auto-'))!;

      // t1 must end before t2 starts at 12:00
      expect(new Date(a1.scheduledEnd).getTime()).toBeLessThanOrEqual(
        new Date('2026-03-20T12:00:00Z').getTime()
      );
    });

    it('does not overlap with existing station assignments', () => {
      // Station s1 has an existing assignment 10:00-12:00
      // New task needs to go on s1 too, should avoid that slot
      const station = createStation('s1');
      const t1 = createTask('t1', 'elem-j1', 's1', 0, 120); // 2 hours
      const tExisting = createTask('t-existing', 'elem-j2', 's1', 0, 120);

      const snapshot = createSnapshot({
        stations: [station],
        categories: [defaultCategory],
        jobs: [createJob('j1', '2026-03-20'), createJob('j2', '2026-03-20')],
        elements: [
          createElement('elem-j1', 'j1', ['t1']),
          createElement('elem-j2', 'j2', ['t-existing']),
        ],
        tasks: [t1, tExisting],
        assignments: [
          createAssignment('existing', 't-existing', 's1', '2026-03-20T12:00:00Z', '2026-03-20T14:00:00Z'),
        ],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now: new Date('2026-03-16T08:00:00Z'),
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.placedCount).toBe(1);

      const a1 = result.snapshot.assignments.find((a) => a.taskId === 't1' && a.id.startsWith('auto-'))!;
      const newStart = new Date(a1.scheduledStart).getTime();
      const newEnd = new Date(a1.scheduledEnd).getTime();

      // Must not overlap with 12:00-14:00
      const existingStart = new Date('2026-03-20T12:00:00Z').getTime();
      const existingEnd = new Date('2026-03-20T14:00:00Z').getTime();

      const noOverlap = newEnd <= existingStart || newStart >= existingEnd;
      expect(noOverlap).toBe(true);
    });
  });

  describe('infeasible schedule detection', () => {
    it('flags warning when deadline is too tight', () => {
      // Task needs 120 min but deadline is in 60 min from now
      const station = createStation('s1');
      const task = createTask('t1', 'elem-j1', 's1', 0, 120);

      const now = new Date('2026-03-20T13:00:00Z'); // 1h before deadline
      const snapshot = createSnapshot({
        stations: [station],
        categories: [defaultCategory],
        jobs: [createJob('j1', '2026-03-20')], // deadline 14:00
        elements: [createElement('elem-j1', 'j1', ['t1'])],
        tasks: [task],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Should still place (ASAP fallback) but with warning
      expect(result.placedCount).toBe(1);
      // The task will either be placed with delay warning or infeasible warning
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('quarter-hour grid snapping', () => {
    it('snaps start time down to 15-minute boundary', () => {
      const station = createStation('s1');
      const task = createTask('t1', 'elem-j1', 's1', 0, 60);

      const snapshot = createSnapshot({
        stations: [station],
        categories: [defaultCategory],
        jobs: [createJob('j1', '2026-03-20')],
        elements: [createElement('elem-j1', 'j1', ['t1'])],
        tasks: [task],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now: new Date('2026-03-16T08:00:00Z'),
        calculateEndTime: mockCalculateEndTime,
      });

      const placed = result.snapshot.assignments.find((a) => a.taskId === 't1')!;
      const startMinutes = new Date(placed.scheduledStart).getMinutes();
      expect(startMinutes % 15).toBe(0);
    });
  });

  describe('station with operating hours gaps', () => {
    it('handles lunch break in operating hours', () => {
      // Station has a lunch break: 06:00-12:00, 13:00-18:00
      const station: Station = {
        ...createStation('s1'),
        operatingSchedule: {
          monday: { isOperating: true, slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '18:00' }] },
          tuesday: { isOperating: true, slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '18:00' }] },
          wednesday: { isOperating: true, slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '18:00' }] },
          thursday: { isOperating: true, slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '18:00' }] },
          friday: { isOperating: true, slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '18:00' }] },
          saturday: { isOperating: false, slots: [] },
          sunday: { isOperating: false, slots: [] },
        },
      };

      const task = createTask('t1', 'elem-j1', 's1', 0, 60);

      // Deadline: Friday March 20 at 14:00
      const snapshot = createSnapshot({
        stations: [station],
        categories: [defaultCategory],
        jobs: [createJob('j1', '2026-03-20')],
        elements: [createElement('elem-j1', 'j1', ['t1'])],
        tasks: [task],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now: new Date('2026-03-16T08:00:00Z'),
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.placedCount).toBe(1);

      const placed = result.snapshot.assignments.find((a) => a.taskId === 't1')!;
      const startTime = new Date(placed.scheduledStart);

      // Task should be placed within operating hours (not during lunch)
      const startHour = startTime.getHours();
      const startMin = startTime.getMinutes();
      const startTimeStr = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;

      const inSlot1 = startTimeStr >= '06:00' && startTimeStr < '12:00';
      const inSlot2 = startTimeStr >= '13:00' && startTimeStr < '18:00';
      expect(inSlot1 || inSlot2).toBe(true);
    });
  });

  describe('weekend handling', () => {
    it('does not place tasks on non-operating days', () => {
      const station = createStation('s1'); // Sat/Sun are non-operating
      const task = createTask('t1', 'elem-j1', 's1', 0, 60);

      // Deadline is Monday March 23 (Saturday=21, Sunday=22 are non-operating)
      const snapshot = createSnapshot({
        stations: [station],
        categories: [defaultCategory],
        jobs: [createJob('j1', '2026-03-23')], // Monday
        elements: [createElement('elem-j1', 'j1', ['t1'])],
        tasks: [task],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now: new Date('2026-03-16T08:00:00Z'),
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.placedCount).toBe(1);

      const placed = result.snapshot.assignments.find((a) => a.taskId === 't1')!;
      const startDay = new Date(placed.scheduledStart).getDay();

      // Should not be on Saturday (6) or Sunday (0)
      expect(startDay).not.toBe(0);
      expect(startDay).not.toBe(6);
    });
  });

  describe('multiple tasks across chain', () => {
    it('places a 3-task chain in correct order ALAP', () => {
      const s1 = createStation('s1');
      const s2 = createStation('s2');
      const s3 = createStation('s3');
      const t1 = createTask('t1', 'elem-j1', 's1', 0, 60);
      const t2 = createTask('t2', 'elem-j1', 's2', 1, 60);
      const t3 = createTask('t3', 'elem-j1', 's3', 2, 60);

      const snapshot = createSnapshot({
        stations: [s1, s2, s3],
        categories: [defaultCategory],
        jobs: [createJob('j1', '2026-03-20')],
        elements: [createElement('elem-j1', 'j1', ['t1', 't2', 't3'])],
        tasks: [t1, t2, t3],
      });

      const result = autoPlace({
        snapshot,
        jobIds: ['j1'],
        now: new Date('2026-03-16T08:00:00Z'),
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.placedCount).toBe(3);

      const a1 = result.snapshot.assignments.find((a) => a.taskId === 't1')!;
      const a2 = result.snapshot.assignments.find((a) => a.taskId === 't2')!;
      const a3 = result.snapshot.assignments.find((a) => a.taskId === 't3')!;

      // Precedence: t1 ends ≤ t2 starts ≤ t2 ends ≤ t3 starts
      expect(new Date(a1.scheduledEnd).getTime()).toBeLessThanOrEqual(
        new Date(a2.scheduledStart).getTime()
      );
      expect(new Date(a2.scheduledEnd).getTime()).toBeLessThanOrEqual(
        new Date(a3.scheduledStart).getTime()
      );

      // t3 should end at deadline or before
      expect(new Date(a3.scheduledEnd).getTime()).toBeLessThanOrEqual(
        new Date('2026-03-20T14:00:00Z').getTime()
      );
    });
  });
});

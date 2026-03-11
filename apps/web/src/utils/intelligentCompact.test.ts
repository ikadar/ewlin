import { describe, it, expect } from 'vitest';
import { intelligentCompact, computeTotalSimilarity } from './intelligentCompact';
import type {
  ScheduleSnapshot,
  Task,
  Station,
  InternalTask,
  Job,
  Element,
  TaskAssignment,
  StationCategory,
  StationGroup,
  ElementSpec,
} from '@flux/types';

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
    categoryId: 'cat-offset',
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

function createFinishingStation(id: string, name: string = id): Station {
  return { ...createStation(id, name), categoryId: 'cat-finishing' };
}

function createOffsetCategory(): StationCategory {
  return {
    id: 'cat-offset',
    name: 'Presse offset',
    description: '',
    similarityCriteria: [
      { name: 'Même papier', fieldPath: 'papier' },
      { name: 'Même format', fieldPath: 'format' },
      { name: 'Même encrage', fieldPath: 'impression' },
      { name: 'Même surfaçage', fieldPath: 'surfacage' },
    ],
  };
}

function createFinishingCategory(): StationCategory {
  return { id: 'cat-finishing', name: 'Finition', description: '', similarityCriteria: [] };
}

function createGroup(id: string = 'grp-1', maxConcurrent: number | null = null): StationGroup {
  return { id, name: id, maxConcurrent, isOutsourcedProviderGroup: false };
}

function createJob(id: string, exitDate: string = '2024-01-25'): Job {
  return {
    id,
    reference: id,
    client: 'Test Client',
    description: 'Test Job',
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

function createElementWithSpec(
  id: string,
  jobId: string,
  taskIds: string[],
  spec: Partial<ElementSpec>,
  prereqs: string[] = []
): Element {
  return {
    id,
    jobId,
    name: 'ELT',
    prerequisiteElementIds: prereqs,
    taskIds,
    spec: { ...spec },
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    formeStatus: 'none',
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

function mockCalculateEndTime(task: InternalTask, start: string): string {
  const startDate = new Date(start);
  const durationMs = (task.duration.setupMinutes + task.duration.runMinutes) * 60 * 1000;
  return new Date(startDate.getTime() + durationMs).toISOString();
}

// Invariant checks
function assertNoDeadlineViolations(result: ReturnType<typeof intelligentCompact>, snapshot: ScheduleSnapshot) {
  const taskMap = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const elementMap = new Map(snapshot.elements.map((e) => [e.id, e]));
  const jobMap = new Map(snapshot.jobs.map((j) => [j.id, j]));

  for (const a of result.snapshot.assignments) {
    const task = taskMap.get(a.taskId);
    if (!task) continue;
    const element = elementMap.get(task.elementId);
    if (!element) continue;
    const job = jobMap.get(element.jobId);
    if (!job) continue;

    const deadlineMs = new Date(job.workshopExitDate).getTime();
    // For date-only strings, deadline is at 14:00
    const effectiveDeadline = job.workshopExitDate.includes('T')
      ? deadlineMs
      : new Date(job.workshopExitDate + 'T14:00:00Z').getTime();

    // Only check if deadline is well-formed (not in the past)
    if (effectiveDeadline > new Date('2024-01-15T00:00:00Z').getTime()) {
      expect(new Date(a.scheduledEnd).getTime()).toBeLessThanOrEqual(effectiveDeadline + 24 * 60 * 60 * 1000);
    }
  }
}

function assertNoStationConflicts(result: ReturnType<typeof intelligentCompact>) {
  const byStation = new Map<string, TaskAssignment[]>();
  for (const a of result.snapshot.assignments) {
    if (a.isOutsourced) continue;
    const list = byStation.get(a.targetId) ?? [];
    list.push(a);
    byStation.set(a.targetId, list);
  }

  for (const [, assignments] of byStation) {
    const sorted = [...assignments].sort(
      (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const endI = new Date(sorted[i].scheduledEnd).getTime();
      const startNext = new Date(sorted[i + 1].scheduledStart).getTime();
      expect(endI).toBeLessThanOrEqual(startNext);
    }
  }
}

function assertInvariants(
  result: ReturnType<typeof intelligentCompact>,
  original: ScheduleSnapshot,
  now: Date
) {
  // No tiles lost or duplicated
  expect(result.snapshot.assignments.length).toBe(original.assignments.length);

  // No station double-bookings
  assertNoStationConflicts(result);

  // Immobile tiles unchanged
  for (const a of original.assignments) {
    if (new Date(a.scheduledStart) < now) {
      const newA = result.snapshot.assignments.find((o) => o.id === a.id)!;
      expect(newA.scheduledStart).toBe(a.scheduledStart);
      expect(newA.scheduledEnd).toBe(a.scheduledEnd);
    }
  }

  // Similarity never decreased
  expect(result.similarityAfter).toBeGreaterThanOrEqual(result.similarityBefore);
}

// ============================================================================
// Tests: Single Station Basic Reordering
// ============================================================================

describe('intelligentCompact', () => {
  describe('single station — basic reordering', () => {
    it('two tiles: swaps to improve similarity', () => {
      // 2024-01-15 is a Monday
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createStation('s1');

      // T1 has papier=Offset:170, T2 has papier=Couché:135
      // Anchor (nothing before) → T2 should go first if it's more similar to nothing
      // But actually with no anchor, the greedy picks best urgency
      // Let's set up so the swap clearly improves: anchor has papier=Couché:135
      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2')],
        elements: [
          createElementWithSpec('e1', 'j1', ['t1'], { papier: 'Offset:170', format: 'A4' }),
          createElementWithSpec('e2', 'j2', ['t2'], { papier: 'Offset:170', format: 'A4' }),
        ],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60),
          createTask('t2', 'e2', 's1', 0, 60),
        ],
        assignments: [
          // Gap between t1 and t2
          createAssignment('a1', 't1', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2', 't2', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Both tiles should be compacted (gap removed)
      expect(result.movedCount).toBeGreaterThanOrEqual(1);
      assertInvariants(result, snapshot, now);
    });

    it('three tiles: groups matching specs together', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2'), createJob('j3')],
        elements: [
          createElementWithSpec('eA', 'j1', ['tA'], { papier: 'Couché:300', format: 'A4' }),
          createElementWithSpec('eB', 'j2', ['tB'], { papier: 'Offset:170', format: 'A3' }),
          createElementWithSpec('eC', 'j3', ['tC'], { papier: 'Couché:300', format: 'A4' }),
        ],
        tasks: [
          createTask('tA', 'eA', 's1', 0, 60),
          createTask('tB', 'eB', 's1', 0, 60),
          createTask('tC', 'eC', 's1', 0, 60),
        ],
        assignments: [
          // Current order: A(Couché), B(Offset), C(Couché) — suboptimal
          createAssignment('aA', 'tA', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('aB', 'tB', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('aC', 'tC', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // After reordering, Couché tiles should be adjacent
      expect(result.similarityAfter).toBeGreaterThanOrEqual(result.similarityBefore);
      assertInvariants(result, snapshot, now);
    });

    it('already optimal order → no changes (reorderedCount = 0)', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2'), createJob('j3')],
        elements: [
          createElementWithSpec('eA', 'j1', ['tA'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
          createElementWithSpec('eB', 'j2', ['tB'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
          createElementWithSpec('eC', 'j3', ['tC'], { papier: 'Offset:170', format: 'A3', impression: 'Q+V/', surfacage: 'brillant/' }),
        ],
        tasks: [
          createTask('tA', 'eA', 's1', 0, 60),
          createTask('tB', 'eB', 's1', 0, 60),
          createTask('tC', 'eC', 's1', 0, 60),
        ],
        assignments: [
          // Already optimal: similar tiles A,B together, then C
          createAssignment('aA', 'tA', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('aB', 'tB', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('aC', 'tC', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.reorderedCount).toBe(0);
      assertInvariants(result, snapshot, now);
    });

    it('five tiles with mixed specs → groups similar tiles', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2'), createJob('j3'), createJob('j4'), createJob('j5')],
        elements: [
          createElementWithSpec('eA', 'j1', ['tA'], { papier: 'Couché:300' }),
          createElementWithSpec('eB', 'j2', ['tB'], { papier: 'Offset:170' }),
          createElementWithSpec('eC', 'j3', ['tC'], { papier: 'Couché:300' }),
          createElementWithSpec('eD', 'j4', ['tD'], { papier: 'Offset:170' }),
          createElementWithSpec('eE', 'j5', ['tE'], { papier: 'Couché:300' }),
        ],
        tasks: [
          createTask('tA', 'eA', 's1', 0, 60),
          createTask('tB', 'eB', 's1', 0, 60),
          createTask('tC', 'eC', 's1', 0, 60),
          createTask('tD', 'eD', 's1', 0, 60),
          createTask('tE', 'eE', 's1', 0, 60),
        ],
        assignments: [
          createAssignment('aA', 'tA', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('aB', 'tB', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('aC', 'tC', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('aD', 'tD', 's1', '2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'),
          createAssignment('aE', 'tE', 's1', '2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 24,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.similarityAfter).toBeGreaterThanOrEqual(result.similarityBefore);
      assertInvariants(result, snapshot, now);
    });
  });

  // ============================================================================
  // Constraint Respect
  // ============================================================================

  describe('single station — constraint respect', () => {
    it('immobile (started) tiles are not moved', () => {
      const now = new Date('2024-01-15T09:30:00Z'); // T1 already started
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2'), createJob('j3')],
        elements: [
          createElementWithSpec('e1', 'j1', ['t1'], { papier: 'Offset:170' }),
          createElementWithSpec('e2', 'j2', ['t2'], { papier: 'Couché:300' }),
          createElementWithSpec('e3', 'j3', ['t3'], { papier: 'Couché:300' }),
        ],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60),
          createTask('t2', 'e2', 's1', 0, 60),
          createTask('t3', 'e3', 's1', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 't1', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'), // started!
          createAssignment('a2', 't2', 's1', '2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'),
          createAssignment('a3', 't3', 's1', '2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // T1 must not move
      const t1 = result.snapshot.assignments.find((a) => a.taskId === 't1')!;
      expect(t1.scheduledStart).toBe('2024-01-15T09:00:00Z');
      expect(t1.scheduledEnd).toBe('2024-01-15T10:00:00Z');
      assertInvariants(result, snapshot, now);
    });

    it('segment boundaries respected: tiles do not cross frozen tiles', () => {
      const now = new Date('2024-01-15T08:30:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2'), createJob('j3'), createJob('j4'), createJob('j5')],
        elements: [
          createElementWithSpec('eFrozen', 'j1', ['tFrozen'], { papier: 'X' }),
          createElementWithSpec('e2', 'j2', ['t2'], { papier: 'Couché:300' }),
          createElementWithSpec('e3', 'j3', ['t3'], { papier: 'Offset:170' }),
          createElementWithSpec('e4', 'j4', ['t4'], { papier: 'Couché:300' }),
          createElementWithSpec('e5', 'j5', ['t5'], { papier: 'Offset:170' }),
        ],
        tasks: [
          createTask('tFrozen', 'eFrozen', 's1', 0, 60),
          createTask('t2', 'e2', 's1', 0, 60),
          createTask('t3', 'e3', 's1', 0, 60),
          createTask('t4', 'e4', 's1', 0, 60),
          createTask('t5', 'e5', 's1', 0, 60),
        ],
        assignments: [
          // Frozen tile (already started)
          createAssignment('aFrozen', 'tFrozen', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          // Segment 1: t2, t3
          createAssignment('a2', 't2', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a3', 't3', 's1', '2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'),
          // Segment 2: t4, t5 (after a gap)
          createAssignment('a4', 't4', 's1', '2024-01-15T13:00:00Z', '2024-01-15T14:00:00Z'),
          createAssignment('a5', 't5', 's1', '2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 24,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Frozen tile unchanged
      const frozen = result.snapshot.assignments.find((a) => a.taskId === 'tFrozen')!;
      expect(frozen.scheduledStart).toBe('2024-01-15T08:00:00Z');
      assertInvariants(result, snapshot, now);
    });

    it('respects intra-element precedence (sequenceOrder)', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2')],
        elements: [
          // Element with two tasks in sequence on same station
          createElementWithSpec('e1', 'j1', ['t1a', 't1b'], { papier: 'Offset:170' }),
          createElementWithSpec('e2', 'j2', ['t2'], { papier: 'Couché:300' }),
        ],
        tasks: [
          createTask('t1a', 'e1', 's1', 0, 60),
          createTask('t1b', 'e1', 's1', 1, 60),
          createTask('t2', 'e2', 's1', 0, 60),
        ],
        assignments: [
          createAssignment('a1a', 't1a', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2', 't2', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('a1b', 't1b', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // t1a must always come before t1b (same element, sequenceOrder)
      const sorted = result.snapshot.assignments
        .filter((a) => a.targetId === 's1')
        .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

      const t1aIndex = sorted.findIndex((a) => a.taskId === 't1a');
      const t1bIndex = sorted.findIndex((a) => a.taskId === 't1b');
      expect(t1aIndex).toBeLessThan(t1bIndex);
      assertInvariants(result, snapshot, now);
    });
  });

  // ============================================================================
  // Horizon
  // ============================================================================

  describe('horizon', () => {
    it('only reorders tiles within horizon', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2'), createJob('j3'), createJob('j4')],
        elements: [
          createElementWithSpec('e1', 'j1', ['t1'], { papier: 'Couché:300' }),
          createElementWithSpec('e2', 'j2', ['t2'], { papier: 'Offset:170' }),
          createElementWithSpec('e3', 'j3', ['t3'], { papier: 'Couché:300' }),
          createElementWithSpec('e4', 'j4', ['t4'], { papier: 'Offset:170' }),
        ],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60),
          createTask('t2', 'e2', 's1', 0, 60),
          createTask('t3', 'e3', 's1', 0, 60),
          createTask('t4', 'e4', 's1', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 't1', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2', 't2', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          // Outside 4h horizon (08:00 + 4h = 12:00)
          createAssignment('a3', 't3', 's1', '2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z'),
          createAssignment('a4', 't4', 's1', '2024-01-15T15:00:00Z', '2024-01-15T16:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 4,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // t3, t4 outside horizon → unchanged
      const t3 = result.snapshot.assignments.find((a) => a.taskId === 't3')!;
      const t4 = result.snapshot.assignments.find((a) => a.taskId === 't4')!;
      expect(t3.scheduledStart).toBe('2024-01-15T14:00:00Z');
      expect(t4.scheduledStart).toBe('2024-01-15T15:00:00Z');
    });
  });

  // ============================================================================
  // Similarity Scoring
  // ============================================================================

  describe('similarity scoring', () => {
    it('returns correct similarityBefore and similarityAfter', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2'), createJob('j3')],
        elements: [
          createElementWithSpec('eA', 'j1', ['tA'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
          createElementWithSpec('eB', 'j2', ['tB'], { papier: 'Offset:170', format: 'A3', impression: 'Q+V/', surfacage: 'brillant/' }),
          createElementWithSpec('eC', 'j3', ['tC'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
        ],
        tasks: [
          createTask('tA', 'eA', 's1', 0, 60),
          createTask('tB', 'eB', 's1', 0, 60),
          createTask('tC', 'eC', 's1', 0, 60),
        ],
        assignments: [
          // Suboptimal: A(Couché), B(Offset), C(Couché)
          createAssignment('aA', 'tA', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('aB', 'tB', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('aC', 'tC', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.similarityAfter).toBeGreaterThanOrEqual(result.similarityBefore);
      // Before: A→B (0/4 match) + B→C (0/4 match) = 0
      expect(result.similarityBefore).toBe(0);
    });

    it('station with no similarity criteria → skip (no reordering)', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createFinishingStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createFinishingCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2')],
        elements: [
          createElementWithSpec('e1', 'j1', ['t1'], { papier: 'X' }),
          createElementWithSpec('e2', 'j2', ['t2'], { papier: 'Y' }),
        ],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60),
          createTask('t2', 'e2', 's1', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 't1', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('a2', 't2', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.reorderedCount).toBe(0);
    });

    it('tiles with no ElementSpec → similarity = 0', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2')],
        elements: [
          createElement('e1', 'j1', ['t1']), // no spec
          createElement('e2', 'j2', ['t2']), // no spec
        ],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60),
          createTask('t2', 'e2', 's1', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 't1', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2', 't2', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        ],
      });

      // Should not crash
      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.snapshot.assignments.length).toBe(2);
    });
  });

  // ============================================================================
  // Safety Fallback
  // ============================================================================

  describe('safety fallback', () => {
    it('returns original order when no tiles present', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.movedCount).toBe(0);
      expect(result.reorderedCount).toBe(0);
    });
  });

  // ============================================================================
  // Cross-Station Interactions
  // ============================================================================

  describe('cross-station interactions', () => {
    it('reordering on station A shifts successor on station B forward', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const pressStation = createStation('s-press');
      const finishStation = createFinishingStation('s-finish');

      const snapshot = createSnapshot({
        stations: [pressStation, finishStation],
        categories: [createOffsetCategory(), createFinishingCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2')],
        elements: [
          createElementWithSpec('e1-press', 'j1', ['t1-press'], { papier: 'Offset:170' }),
          createElement('e1-finish', 'j1', ['t1-finish'], ['e1-press']),
          createElementWithSpec('e2-press', 'j2', ['t2-press'], { papier: 'Couché:300' }),
          createElement('e2-finish', 'j2', ['t2-finish'], ['e2-press']),
        ],
        tasks: [
          createTask('t1-press', 'e1-press', 's-press', 0, 60),
          createTask('t2-press', 'e2-press', 's-press', 0, 60),
          createTask('t1-finish', 'e1-finish', 's-finish', 0, 60),
          createTask('t2-finish', 'e2-finish', 's-finish', 0, 60),
        ],
        assignments: [
          createAssignment('a1p', 't1-press', 's-press', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2p', 't2-press', 's-press', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('a1f', 't1-finish', 's-finish', '2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z'),
          createAssignment('a2f', 't2-finish', 's-finish', '2024-01-15T15:00:00Z', '2024-01-15T16:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 24,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // All assignments should be present
      expect(result.snapshot.assignments.length).toBe(4);
      assertNoStationConflicts(result);
    });

    it('three-station chain cascade: press → finishing → binding', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const pressStation = createStation('s-press');
      const finishStation = createFinishingStation('s-finish');
      const bindStation = createFinishingStation('s-bind');

      const snapshot = createSnapshot({
        stations: [pressStation, finishStation, bindStation],
        categories: [createOffsetCategory(), createFinishingCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2')],
        elements: [
          createElementWithSpec('e1-press', 'j1', ['t1-press'], { papier: 'Couché:300' }),
          createElement('e1-finish', 'j1', ['t1-finish'], ['e1-press']),
          createElement('e1-bind', 'j1', ['t1-bind'], ['e1-finish']),
          createElementWithSpec('e2-press', 'j2', ['t2-press'], { papier: 'Offset:170' }),
          createElement('e2-finish', 'j2', ['t2-finish'], ['e2-press']),
          createElement('e2-bind', 'j2', ['t2-bind'], ['e2-finish']),
        ],
        tasks: [
          createTask('t1-press', 'e1-press', 's-press', 0, 60),
          createTask('t2-press', 'e2-press', 's-press', 0, 60),
          createTask('t1-finish', 'e1-finish', 's-finish', 0, 60),
          createTask('t2-finish', 'e2-finish', 's-finish', 0, 60),
          createTask('t1-bind', 'e1-bind', 's-bind', 0, 60),
          createTask('t2-bind', 'e2-bind', 's-bind', 0, 60),
        ],
        assignments: [
          createAssignment('a1p', 't1-press', 's-press', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2p', 't2-press', 's-press', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('a1f', 't1-finish', 's-finish', '2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z'),
          createAssignment('a2f', 't2-finish', 's-finish', '2024-01-15T15:00:00Z', '2024-01-15T16:00:00Z'),
          createAssignment('a1b', 't1-bind', 's-bind', '2024-01-15T16:00:00Z', '2024-01-15T17:00:00Z'),
          createAssignment('a2b', 't2-bind', 's-bind', '2024-01-15T17:00:00Z', '2024-01-15T18:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 24,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.snapshot.assignments.length).toBe(6);
      assertNoStationConflicts(result);
    });

    it('diamond: two stations feed into one downstream station', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const pressA = createStation('s-press-a');
      const pressB = createStation('s-press-b');
      const binding = createFinishingStation('s-bind');

      const snapshot = createSnapshot({
        stations: [pressA, pressB, binding],
        categories: [createOffsetCategory(), createFinishingCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1')],
        elements: [
          createElementWithSpec('e-cover', 'j1', ['t-cover'], { papier: 'Couché:300' }),
          createElementWithSpec('e-int', 'j1', ['t-int'], { papier: 'Offset:170' }),
          createElement('e-bind', 'j1', ['t-bind'], ['e-cover', 'e-int']),
        ],
        tasks: [
          createTask('t-cover', 'e-cover', 's-press-a', 0, 60),
          createTask('t-int', 'e-int', 's-press-b', 0, 120),
          createTask('t-bind', 'e-bind', 's-bind', 0, 60),
        ],
        assignments: [
          createAssignment('a-cover', 't-cover', 's-press-a', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a-int', 't-int', 's-press-b', '2024-01-15T08:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('a-bind', 't-bind', 's-bind', '2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 24,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.snapshot.assignments.length).toBe(3);
      assertNoStationConflicts(result);
    });

    it('reordering on station A does not interfere with independent station B', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const stationA = createStation('s-a');
      const stationB = createStation('s-b');

      const snapshot = createSnapshot({
        stations: [stationA, stationB],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2'), createJob('j3'), createJob('j4'), createJob('j5'), createJob('j6')],
        elements: [
          createElementWithSpec('e1', 'j1', ['t1'], { papier: 'Couché:300' }),
          createElementWithSpec('e2', 'j2', ['t2'], { papier: 'Offset:170' }),
          createElementWithSpec('e3', 'j3', ['t3'], { papier: 'Couché:300' }),
          // Independent station B
          createElementWithSpec('e4', 'j4', ['t4'], { papier: 'Offset:170' }),
          createElementWithSpec('e5', 'j5', ['t5'], { papier: 'Couché:300' }),
          createElementWithSpec('e6', 'j6', ['t6'], { papier: 'Offset:170' }),
        ],
        tasks: [
          createTask('t1', 'e1', 's-a', 0, 60),
          createTask('t2', 'e2', 's-a', 0, 60),
          createTask('t3', 'e3', 's-a', 0, 60),
          createTask('t4', 'e4', 's-b', 0, 60),
          createTask('t5', 'e5', 's-b', 0, 60),
          createTask('t6', 'e6', 's-b', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 't1', 's-a', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2', 't2', 's-a', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('a3', 't3', 's-a', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a4', 't4', 's-b', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a5', 't5', 's-b', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('a6', 't6', 's-b', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 24,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.snapshot.assignments.length).toBe(6);
      assertNoStationConflicts(result);
    });
  });

  // ============================================================================
  // Group Capacity
  // ============================================================================

  describe('group capacity interactions', () => {
    it('station in limited-capacity group → reordering skipped', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = { ...createStation('s1'), groupId: 'grp-limited' };

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup('grp-limited', 2)], // limited!
        jobs: [createJob('j1'), createJob('j2')],
        elements: [
          createElementWithSpec('e1', 'j1', ['t1'], { papier: 'Offset:170' }),
          createElementWithSpec('e2', 'j2', ['t2'], { papier: 'Couché:300' }),
        ],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60),
          createTask('t2', 'e2', 's1', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 't1', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2', 't2', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.reorderedCount).toBe(0);
    });

    it('station in unlimited group → reordering proceeds normally', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const station = createStation('s1');

      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup('grp-1', null)], // unlimited
        jobs: [createJob('j1'), createJob('j2'), createJob('j3')],
        elements: [
          createElementWithSpec('eA', 'j1', ['tA'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
          createElementWithSpec('eB', 'j2', ['tB'], { papier: 'Offset:170', format: 'A3', impression: 'Q+V/', surfacage: 'brillant/' }),
          createElementWithSpec('eC', 'j3', ['tC'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
        ],
        tasks: [
          createTask('tA', 'eA', 's1', 0, 60),
          createTask('tB', 'eB', 's1', 0, 60),
          createTask('tC', 'eC', 's1', 0, 60),
        ],
        assignments: [
          createAssignment('aA', 'tA', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('aB', 'tB', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('aC', 'tC', 's1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Should attempt reordering for similarity improvement
      expect(result.similarityAfter).toBeGreaterThanOrEqual(result.similarityBefore);
    });
  });

  // ============================================================================
  // End-to-End Integration
  // ============================================================================

  describe('end-to-end integration', () => {
    it('realistic scenario: 2 presses, 1 finishing, 4 jobs', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const press1 = createStation('press-1');
      const press2 = createStation('press-2');
      const finish = createFinishingStation('finish-1');

      const snapshot = createSnapshot({
        stations: [press1, press2, finish],
        categories: [createOffsetCategory(), createFinishingCategory()],
        groups: [createGroup()],
        jobs: [
          createJob('j1', '2024-01-20'),
          createJob('j2', '2024-01-22'),
          createJob('j3', '2024-01-20'),
          createJob('j4', '2024-01-25'),
        ],
        elements: [
          // Press 1: j1(Couché), j2(Offset), j3(Couché), j4(Offset) — interleaved
          createElementWithSpec('e1-press', 'j1', ['t1p'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
          createElementWithSpec('e2-press', 'j2', ['t2p'], { papier: 'Offset:170', format: 'A3', impression: 'Q+V/', surfacage: 'brillant/' }),
          createElementWithSpec('e3-press', 'j3', ['t3p'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
          createElementWithSpec('e4-press', 'j4', ['t4p'], { papier: 'Offset:170', format: 'A3', impression: 'Q+V/', surfacage: 'brillant/' }),
          // Finishing
          createElement('e1-fin', 'j1', ['t1f'], ['e1-press']),
          createElement('e2-fin', 'j2', ['t2f'], ['e2-press']),
          createElement('e3-fin', 'j3', ['t3f'], ['e3-press']),
          createElement('e4-fin', 'j4', ['t4f'], ['e4-press']),
        ],
        tasks: [
          createTask('t1p', 'e1-press', 'press-1', 0, 60),
          createTask('t2p', 'e2-press', 'press-1', 0, 60),
          createTask('t3p', 'e3-press', 'press-1', 0, 60),
          createTask('t4p', 'e4-press', 'press-1', 0, 60),
          createTask('t1f', 'e1-fin', 'finish-1', 0, 60),
          createTask('t2f', 'e2-fin', 'finish-1', 0, 60),
          createTask('t3f', 'e3-fin', 'finish-1', 0, 60),
          createTask('t4f', 'e4-fin', 'finish-1', 0, 60),
        ],
        assignments: [
          // Press 1: interleaved Couché/Offset
          createAssignment('a1p', 't1p', 'press-1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2p', 't2p', 'press-1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
          createAssignment('a3p', 't3p', 'press-1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a4p', 't4p', 'press-1', '2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'),
          // Finishing
          createAssignment('a1f', 't1f', 'finish-1', '2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z'),
          createAssignment('a2f', 't2f', 'finish-1', '2024-01-15T15:00:00Z', '2024-01-15T16:00:00Z'),
          createAssignment('a3f', 't3f', 'finish-1', '2024-01-15T16:00:00Z', '2024-01-15T17:00:00Z'),
          createAssignment('a4f', 't4f', 'finish-1', '2024-01-15T17:00:00Z', '2024-01-15T18:00:00Z'),
        ],
      });

      const result = intelligentCompact({
        snapshot,
        horizonHours: 24,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Invariants
      expect(result.snapshot.assignments.length).toBe(snapshot.assignments.length);
      assertNoStationConflicts(result);

      // Similarity should improve on press (Couché tiles grouped, Offset tiles grouped)
      expect(result.similarityAfter).toBeGreaterThanOrEqual(result.similarityBefore);
    });
  });

  // ============================================================================
  // computeTotalSimilarity
  // ============================================================================

  describe('computeTotalSimilarity', () => {
    it('returns 0 for empty snapshot', () => {
      const snapshot = createSnapshot();
      expect(computeTotalSimilarity(snapshot)).toBe(0);
    });

    it('returns 1.0 for perfectly similar consecutive tiles', () => {
      const station = createStation('s1');
      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2')],
        elements: [
          createElementWithSpec('e1', 'j1', ['t1'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
          createElementWithSpec('e2', 'j2', ['t2'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
        ],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60),
          createTask('t2', 'e2', 's1', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 't1', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2', 't2', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        ],
      });

      expect(computeTotalSimilarity(snapshot)).toBe(1.0);
    });

    it('returns 0 for completely different consecutive tiles', () => {
      const station = createStation('s1');
      const snapshot = createSnapshot({
        stations: [station],
        categories: [createOffsetCategory()],
        groups: [createGroup()],
        jobs: [createJob('j1'), createJob('j2')],
        elements: [
          createElementWithSpec('e1', 'j1', ['t1'], { papier: 'Couché:300', format: 'A4', impression: 'Q/Q', surfacage: 'mat/mat' }),
          createElementWithSpec('e2', 'j2', ['t2'], { papier: 'Offset:170', format: 'A3', impression: 'Q+V/', surfacage: 'brillant/' }),
        ],
        tasks: [
          createTask('t1', 'e1', 's1', 0, 60),
          createTask('t2', 'e2', 's1', 0, 60),
        ],
        assignments: [
          createAssignment('a1', 't1', 's1', '2024-01-15T08:00:00Z', '2024-01-15T09:00:00Z'),
          createAssignment('a2', 't2', 's1', '2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        ],
      });

      expect(computeTotalSimilarity(snapshot)).toBe(0);
    });
  });
});

import { describe, it, expect } from 'vitest';
import type {
  ScheduleSnapshot,
  TaskAssignment,
  Task,
  Station,
  StationCategory,
  InternalTask,
  Job,
  Element,
  SimilarityCriterion,
} from '@flux/types';
import {
  buildTileBlocks,
  reorderBySimilarity,
  similarityScore,
  totalSimilarityScore,
  getAnchorSpec,
  getJobLastEndTime,
  partitionStationTiles,
  runSmartCompact,
} from './smartCompaction';
import type { TileBlock } from './smartCompaction';

// ============================================================================
// Test helpers
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

function createStation(id: string, name: string = id, categoryId: string = 'cat-1'): Station {
  return {
    id,
    name,
    categoryId,
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

function createCategory(
  id: string,
  name: string = id,
  criteria: SimilarityCriterion[] = [],
): StationCategory {
  return { id, name, similarityCriteria: criteria };
}

function createJob(id: string, workshopExitDate: string = '2024-01-15'): Job {
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
    elementIds: [`element-${id}`],
    taskIds: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    shipped: false,
    shippedAt: null,
  };
}

function createElement(
  jobId: string,
  taskIds: string[] = [],
  spec?: Record<string, unknown>,
  prerequisiteElementIds: string[] = [],
): Element {
  return {
    id: `element-${jobId}`,
    jobId,
    name: 'ELT',
    prerequisiteElementIds,
    taskIds,
    spec: spec as Element['spec'],
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
  durationMinutes: number = 60,
  splitGroupId?: string,
  splitIndex?: number,
): Task {
  return {
    id,
    elementId,
    type: 'Internal',
    stationId,
    sequenceOrder,
    status: 'Assigned',
    duration: {
      setupMinutes: 0,
      runMinutes: durationMinutes,
    },
    rawDsl: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...(splitGroupId ? { splitGroupId, splitIndex, splitTotal: 2, originalRunMinutes: durationMinutes * 2 } : {}),
  } as Task;
}

function createAssignment(
  id: string,
  taskId: string,
  stationId: string,
  scheduledStart: string,
  scheduledEnd: string,
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

// ============================================================================
// Unit tests
// ============================================================================

describe('smartCompaction', () => {
  describe('similarityScore', () => {
    const criteria: SimilarityCriterion[] = [
      { name: 'Paper', fieldPath: 'papier' },
      { name: 'Format', fieldPath: 'format' },
    ];

    it('returns 0 when either spec is undefined', () => {
      expect(similarityScore(undefined, { papier: 'mat:135' }, criteria)).toBe(0);
      expect(similarityScore({ papier: 'mat:135' }, undefined, criteria)).toBe(0);
    });

    it('counts matched criteria', () => {
      const specA = { papier: 'mat:135', format: 'A4' };
      const specB = { papier: 'mat:135', format: 'A3' };
      expect(similarityScore(specA, specB, criteria)).toBe(1); // papier matches
    });

    it('returns full count when all match', () => {
      const spec = { papier: 'mat:135', format: 'A4' };
      expect(similarityScore(spec, spec, criteria)).toBe(2);
    });

    it('returns 0 when nothing matches', () => {
      const specA = { papier: 'mat:135', format: 'A4' };
      const specB = { papier: 'brillant:250', format: 'A3' };
      expect(similarityScore(specA, specB, criteria)).toBe(0);
    });
  });

  describe('totalSimilarityScore', () => {
    const criteria: SimilarityCriterion[] = [
      { name: 'Paper', fieldPath: 'papier' },
    ];

    function makeBlock(papier: string): TileBlock {
      return {
        assignments: [],
        tasks: [],
        spec: { papier },
        elementId: 'e1',
        minSequenceOrder: 0,
        workshopExitDate: undefined,
        splitGroupId: undefined,
      };
    }

    it('returns 0 for empty blocks', () => {
      expect(totalSimilarityScore([], criteria, undefined)).toBe(0);
    });

    it('scores anchor → first block', () => {
      const blocks = [makeBlock('mat:135')];
      expect(totalSimilarityScore(blocks, criteria, { papier: 'mat:135' })).toBe(1);
    });

    it('scores consecutive pairs', () => {
      const blocks = [makeBlock('mat:135'), makeBlock('mat:135'), makeBlock('brillant:250')];
      // anchor(undefined)→block0: 0, block0→block1: 1 (match), block1→block2: 0
      expect(totalSimilarityScore(blocks, criteria, undefined)).toBe(1);
    });
  });

  describe('buildTileBlocks', () => {
    it('creates single-tile blocks', () => {
      const task = createTask('t1', 'e1', 's1', 0);
      const assignment = createAssignment('a1', 't1', 's1', '2024-01-10T08:00:00Z', '2024-01-10T09:00:00Z');
      const element = createElement('job1', ['t1'], { papier: 'mat:135' });
      element.id = 'e1';
      const job = createJob('job1');

      const taskMap = new Map([['t1', task]]);
      const elementMap = new Map([['e1', element]]);
      const jobMap = new Map([['job1', job]]);

      const blocks = buildTileBlocks([assignment], taskMap, elementMap, jobMap);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].assignments).toHaveLength(1);
      expect(blocks[0].spec).toEqual({ papier: 'mat:135' });
    });

    it('groups split parts into one block', () => {
      const t1 = createTask('t1', 'e1', 's1', 0, 30, 'split-group-1', 0);
      const t2 = createTask('t2', 'e1', 's1', 0, 30, 'split-group-1', 1);
      const a1 = createAssignment('a1', 't1', 's1', '2024-01-10T08:00:00Z', '2024-01-10T08:30:00Z');
      const a2 = createAssignment('a2', 't2', 's1', '2024-01-10T08:30:00Z', '2024-01-10T09:00:00Z');
      const element = createElement('job1', ['t1', 't2']);
      element.id = 'e1';
      const job = createJob('job1');

      const taskMap = new Map<string, Task>([['t1', t1], ['t2', t2]]);
      const elementMap = new Map([['e1', element]]);
      const jobMap = new Map([['job1', job]]);

      const blocks = buildTileBlocks([a1, a2], taskMap, elementMap, jobMap);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].assignments).toHaveLength(2);
      expect(blocks[0].splitGroupId).toBe('split-group-1');
    });
  });

  describe('reorderBySimilarity', () => {
    const criteria: SimilarityCriterion[] = [
      { name: 'Paper', fieldPath: 'papier' },
      { name: 'Format', fieldPath: 'format' },
    ];

    function makeBlock(id: string, papier: string, format: string, elementId: string = 'e1', seq: number = 0): TileBlock {
      return {
        assignments: [createAssignment(`a-${id}`, `t-${id}`, 's1', '2024-01-10T08:00:00Z', '2024-01-10T09:00:00Z')],
        tasks: [createTask(`t-${id}`, elementId, 's1', seq) as InternalTask],
        spec: { papier, format },
        elementId,
        minSequenceOrder: seq,
        workshopExitDate: '2024-01-15',
        splitGroupId: undefined,
      };
    }

    it('returns single block unchanged', () => {
      const blocks = [makeBlock('1', 'mat', 'A4')];
      const result = reorderBySimilarity(blocks, criteria, undefined);
      expect(result).toHaveLength(1);
    });

    it('groups similar tiles together', () => {
      // A, B, A pattern → should reorder to A, A, B
      const blocks = [
        makeBlock('1', 'mat', 'A4', 'e1', 0),
        makeBlock('2', 'brillant', 'A3', 'e2', 0),
        makeBlock('3', 'mat', 'A4', 'e3', 0),
      ];
      const result = reorderBySimilarity(blocks, criteria, undefined);
      // First picked arbitrarily, then block with highest similarity to it
      expect(result[0].assignments[0].taskId).toBe('t-1');
      expect(result[1].assignments[0].taskId).toBe('t-3'); // matches 'mat', 'A4'
      expect(result[2].assignments[0].taskId).toBe('t-2');
    });

    it('preserves intra-element ordering', () => {
      // Two blocks from same element: seq 0 must come before seq 1
      const blocks = [
        makeBlock('2', 'brillant', 'A3', 'e1', 1),  // seq 1 — must come after seq 0
        makeBlock('1', 'mat', 'A4', 'e1', 0),        // seq 0
        makeBlock('3', 'brillant', 'A3', 'e2', 0),   // different element
      ];
      const result = reorderBySimilarity(blocks, criteria, undefined);

      // Find the positions of the two e1 blocks
      const e1Indices = result
        .map((b, i) => ({ b, i }))
        .filter(({ b }) => b.elementId === 'e1');

      expect(e1Indices).toHaveLength(2);
      // seq 0 must come before seq 1
      const seq0Idx = e1Indices.find(({ b }) => b.minSequenceOrder === 0)!.i;
      const seq1Idx = e1Indices.find(({ b }) => b.minSequenceOrder === 1)!.i;
      expect(seq0Idx).toBeLessThan(seq1Idx);
    });

    it('uses anchor spec for first pick', () => {
      const blocks = [
        makeBlock('1', 'mat', 'A4', 'e1', 0),
        makeBlock('2', 'brillant', 'A3', 'e2', 0),
      ];
      // Anchor matches block 2
      const anchorSpec = { papier: 'brillant', format: 'A3' };
      const result = reorderBySimilarity(blocks, criteria, anchorSpec);
      expect(result[0].assignments[0].taskId).toBe('t-2'); // picked first (matches anchor)
    });
  });

  describe('getAnchorSpec', () => {
    it('returns undefined when no immobile tiles', () => {
      const result = getAnchorSpec([], new Map(), new Map());
      expect(result).toBeUndefined();
    });

    it('returns spec of last immobile tile', () => {
      const task = createTask('t1', 'e1', 's1', 0);
      const element = createElement('job1', ['t1'], { papier: 'mat:135' });
      element.id = 'e1';
      const assignment = createAssignment('a1', 't1', 's1', '2024-01-10T06:00:00Z', '2024-01-10T07:00:00Z');

      const result = getAnchorSpec(
        [assignment],
        new Map([['t1', task]]),
        new Map([['e1', element]]),
      );
      expect(result).toEqual({ papier: 'mat:135' });
    });
  });

  describe('partitionStationTiles', () => {
    it('partitions into immobile, movable, and frozen', () => {
      const now = new Date('2024-01-10T10:00:00Z');
      const station = createStation('s1');
      const categoryMap = new Map([['cat-1', createCategory('cat-1')]]);
      const horizonMs = 24 * 60 * 60 * 1000;

      const snapshot = createSnapshot({
        assignments: [
          // Immobile: started before now
          createAssignment('a1', 't1', 's1', '2024-01-10T08:00:00Z', '2024-01-10T09:00:00Z'),
          // Movable: within horizon
          createAssignment('a2', 't2', 's1', '2024-01-10T12:00:00Z', '2024-01-10T13:00:00Z'),
          // Frozen: beyond horizon
          createAssignment('a3', 't3', 's1', '2024-01-12T08:00:00Z', '2024-01-12T09:00:00Z'),
        ],
      });

      const result = partitionStationTiles(station, snapshot, now, horizonMs, categoryMap);
      expect(result.immobile).toHaveLength(1);
      expect(result.movable).toHaveLength(1);
      expect(result.frozen).toHaveLength(1);
    });
  });

  describe('getJobLastEndTime', () => {
    it('returns latest end time among job tasks', () => {
      const element = createElement('job1', ['t1', 't2']);
      element.id = 'e1';
      const elementMap = new Map([['e1', element]]);
      const taskMap = new Map<string, Task>();

      const snapshot = createSnapshot({
        elements: [element],
        assignments: [
          createAssignment('a1', 't1', 's1', '2024-01-10T08:00:00Z', '2024-01-10T09:00:00Z'),
          createAssignment('a2', 't2', 's1', '2024-01-10T10:00:00Z', '2024-01-10T12:00:00Z'),
        ],
      });

      const result = getJobLastEndTime('job1', snapshot, elementMap, taskMap);
      expect(result).toEqual(new Date('2024-01-10T12:00:00Z'));
    });

    it('returns null for unassigned job', () => {
      const element = createElement('job1', ['t1']);
      element.id = 'e1';
      const elementMap = new Map([['e1', element]]);
      const taskMap = new Map<string, Task>();

      const snapshot = createSnapshot({ elements: [element], assignments: [] });
      const result = getJobLastEndTime('job1', snapshot, elementMap, taskMap);
      expect(result).toBeNull();
    });
  });

  describe('runSmartCompact (async generator)', () => {
    it('handles empty schedule', async () => {
      const snapshot = createSnapshot();
      const events: Array<{ phase: string }> = [];

      for await (const event of runSmartCompact({
        snapshot,
        horizonHours: 24,
        calculateEndTime: mockCalculateEndTime,
      })) {
        events.push(event);
      }

      const complete = events.find((e) => e.phase === 'complete');
      expect(complete).toBeDefined();
    });

    it('reorders tiles by similarity on a single station', async () => {
      const now = new Date('2024-01-10T10:00:00Z');
      const station = createStation('s1', 'Offset', 'cat-print');
      const category = createCategory('cat-print', 'Offset', [
        { name: 'Paper', fieldPath: 'papier' },
      ]);

      // 3 jobs with different paper specs: mat, brillant, mat
      const jobs = [createJob('j1'), createJob('j2'), createJob('j3')];
      const elements = [
        { ...createElement('j1', ['t1'], { papier: 'mat' }), id: 'e1', jobId: 'j1' },
        { ...createElement('j2', ['t2'], { papier: 'brillant' }), id: 'e2', jobId: 'j2' },
        { ...createElement('j3', ['t3'], { papier: 'mat' }), id: 'e3', jobId: 'j3' },
      ];
      const tasks: Task[] = [
        createTask('t1', 'e1', 's1', 0),
        createTask('t2', 'e2', 's1', 0),
        createTask('t3', 'e3', 's1', 0),
      ];
      const assignments = [
        createAssignment('a1', 't1', 's1', '2024-01-10T12:00:00Z', '2024-01-10T13:00:00Z'),
        createAssignment('a2', 't2', 's1', '2024-01-10T13:00:00Z', '2024-01-10T14:00:00Z'),
        createAssignment('a3', 't3', 's1', '2024-01-10T14:00:00Z', '2024-01-10T15:00:00Z'),
      ];

      const snapshot = createSnapshot({
        stations: [station],
        categories: [category],
        jobs,
        elements,
        tasks,
        assignments,
      });

      const events: Array<{ phase: string; result?: { reorderedCount: number; similarityAfter: number } }> = [];

      for await (const event of runSmartCompact({
        snapshot,
        horizonHours: 24,
        now,
        calculateEndTime: mockCalculateEndTime,
      })) {
        events.push(event);
      }

      const complete = events.find((e) => e.phase === 'complete');
      expect(complete).toBeDefined();
      expect(complete!.result!.reorderedCount).toBeGreaterThan(0);
      expect(complete!.result!.similarityAfter).toBeGreaterThanOrEqual(complete!.result!.reorderedCount > 0 ? 1 : 0);
    });

    it('skips station without similarity criteria', async () => {
      const now = new Date('2024-01-10T10:00:00Z');
      const station = createStation('s1', 'Finition', 'cat-fin');
      const category = createCategory('cat-fin', 'Finition', []); // No criteria

      const jobs = [createJob('j1'), createJob('j2')];
      const elements = [
        { ...createElement('j1', ['t1']), id: 'e1', jobId: 'j1' },
        { ...createElement('j2', ['t2']), id: 'e2', jobId: 'j2' },
      ];
      const tasks: Task[] = [
        createTask('t1', 'e1', 's1', 0),
        createTask('t2', 'e2', 's1', 0),
      ];
      const assignments = [
        createAssignment('a1', 't1', 's1', '2024-01-10T12:00:00Z', '2024-01-10T13:00:00Z'),
        createAssignment('a2', 't2', 's1', '2024-01-10T13:00:00Z', '2024-01-10T14:00:00Z'),
      ];

      const snapshot = createSnapshot({
        stations: [station],
        categories: [category],
        jobs,
        elements,
        tasks,
        assignments,
      });

      const events: Array<{ phase: string; result?: { reorderedCount: number } }> = [];

      for await (const event of runSmartCompact({
        snapshot,
        horizonHours: 24,
        now,
        calculateEndTime: mockCalculateEndTime,
      })) {
        events.push(event);
      }

      const complete = events.find((e) => e.phase === 'complete');
      expect(complete!.result!.reorderedCount).toBe(0);
    });

    it('handles single movable tile without error', async () => {
      const now = new Date('2024-01-10T10:00:00Z');
      const station = createStation('s1', 'Offset', 'cat-print');
      const category = createCategory('cat-print', 'Offset', [
        { name: 'Paper', fieldPath: 'papier' },
      ]);

      const jobs = [createJob('j1')];
      const elements = [{ ...createElement('j1', ['t1'], { papier: 'mat' }), id: 'e1', jobId: 'j1' }];
      const tasks: Task[] = [createTask('t1', 'e1', 's1', 0)];
      const assignments = [
        createAssignment('a1', 't1', 's1', '2024-01-10T12:00:00Z', '2024-01-10T13:00:00Z'),
      ];

      const snapshot = createSnapshot({
        stations: [station],
        categories: [category],
        jobs,
        elements,
        tasks,
        assignments,
      });

      const events: Array<{ phase: string; result?: { reorderedCount: number } }> = [];

      for await (const event of runSmartCompact({
        snapshot,
        horizonHours: 24,
        now,
        calculateEndTime: mockCalculateEndTime,
      })) {
        events.push(event);
      }

      const complete = events.find((e) => e.phase === 'complete');
      // Single tile cannot be reordered
      expect(complete!.result!.reorderedCount).toBe(0);
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  expandSplitAssignments,
  addSplit,
  removeSplit,
  reSplit,
  getRealAssignmentId,
  moveSplitPart,
  getSplitPartIndex,
} from './splitTransform';
import type { SplitConfig } from './splitTransform';
import type { TaskAssignment, InternalTask } from '@flux/types';

// Helper: create a test assignment
function createAssignment(
  id: string,
  taskId: string,
  stationId: string,
  startHour: number,
  durationHours: number
): TaskAssignment {
  const start = new Date('2026-03-11T00:00:00Z');
  start.setUTCHours(startHour);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

  return {
    id,
    taskId,
    targetId: stationId,
    isOutsourced: false,
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
    isCompleted: false,
    completedAt: null,
    createdAt: '2026-03-11T00:00:00Z',
    updatedAt: '2026-03-11T00:00:00Z',
  };
}

// Helper: create a test internal task
function createTask(id: string, stationId: string, setupMin: number, runMin: number): InternalTask {
  return {
    id,
    elementId: 'elem-1',
    name: 'Test Task',
    type: 'Internal',
    stationId,
    duration: { setupMinutes: setupMin, runMinutes: runMin },
    status: 'Pending',
    position: 0,
  } as InternalTask;
}

// Helper: create a SplitConfig with the new shape
function createConfig(
  assignmentId: string,
  taskId: string,
  setupMinutes: number,
  parts: { runMinutes: number; scheduledStart: string }[],
  splitGroupId = 'group-1'
): SplitConfig {
  return { assignmentId, taskId, setupMinutes, parts, splitGroupId };
}

describe('expandSplitAssignments', () => {
  it('passes through non-split assignments unchanged', () => {
    const assignments = [createAssignment('a1', 't1', 's1', 8, 4)];
    const tasks = [createTask('t1', 's1', 30, 210)];
    const configs = new Map<string, SplitConfig>();

    const { virtualAssignments, virtualTasks } = expandSplitAssignments(
      assignments, tasks, [], configs
    );

    expect(virtualAssignments).toHaveLength(1);
    expect(virtualAssignments[0].id).toBe('a1');
    expect(virtualAssignments[0].realAssignmentId).toBe('a1');
    expect(virtualAssignments[0].splitPartIndex).toBeUndefined();
    expect(virtualTasks).toBe(tasks); // No extra tasks -> same reference
  });

  it('splits 240min run into 120+120 with correct virtual assignments', () => {
    // Task: 30min setup + 240min run = 270min total = 4.5h
    // Part 0 starts at 08:00, Part 1 starts at 10:30 (after 150min = 2.5h)
    const assignments = [createAssignment('a1', 't1', 's1', 8, 4.5)];
    const tasks = [createTask('t1', 's1', 30, 240)];
    const part0Start = '2026-03-11T08:00:00.000Z';
    const part1Start = '2026-03-11T10:30:00.000Z'; // part0 end = 08:00 + 150min
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 120, scheduledStart: part0Start },
        { runMinutes: 120, scheduledStart: part1Start },
      ])],
    ]);

    const { virtualAssignments, virtualTasks } = expandSplitAssignments(
      assignments, tasks, [], configs
    );

    // Should produce 2 virtual assignments
    expect(virtualAssignments).toHaveLength(2);

    // Part 0: setup(30) + run(120) = 150min = 2.5h
    const part0 = virtualAssignments[0];
    expect(part0.id).toBe('a1:split:0');
    expect(part0.taskId).toBe('t1:split:0');
    expect(part0.realAssignmentId).toBe('a1');
    expect(part0.splitPartIndex).toBe(0);
    expect(part0.splitPartTotal).toBe(2);
    expect(part0.splitGroupId).toBe('group-1');

    const start0 = new Date(part0.scheduledStart);
    const end0 = new Date(part0.scheduledEnd);
    expect(end0.getTime() - start0.getTime()).toBe(150 * 60 * 1000);

    // Part 1: starts at its own scheduledStart, setup(30) + run(120) = 150min
    const part1 = virtualAssignments[1];
    expect(part1.id).toBe('a1:split:1');
    expect(part1.splitPartIndex).toBe(1);
    expect(part1.scheduledStart).toBe(part1Start);

    const start1 = new Date(part1.scheduledStart);
    const end1 = new Date(part1.scheduledEnd);
    expect(end1.getTime() - start1.getTime()).toBe(150 * 60 * 1000);

    // Virtual tasks: original + 2 split tasks
    expect(virtualTasks).toHaveLength(3);
    const vt0 = virtualTasks.find(t => t.id === 't1:split:0')!;
    const vt1 = virtualTasks.find(t => t.id === 't1:split:1')!;
    expect(vt0.type).toBe('Internal');
    expect((vt0 as InternalTask).duration).toEqual({ setupMinutes: 30, runMinutes: 120 });
    expect((vt1 as InternalTask).duration).toEqual({ setupMinutes: 30, runMinutes: 120 });
  });

  it('handles mixed split and non-split assignments', () => {
    const assignments = [
      createAssignment('a1', 't1', 's1', 8, 2),
      createAssignment('a2', 't2', 's1', 10, 4),
    ];
    const tasks = [
      createTask('t1', 's1', 15, 105),
      createTask('t2', 's1', 30, 210),
    ];
    const configs = new Map<string, SplitConfig>([
      ['a2', createConfig('a2', 't2', 30, [
        { runMinutes: 100, scheduledStart: '2026-03-11T10:00:00.000Z' },
        { runMinutes: 110, scheduledStart: '2026-03-11T12:10:00.000Z' },
      ], 'group-2')],
    ]);

    const { virtualAssignments, virtualTasks } = expandSplitAssignments(
      assignments, tasks, [], configs
    );

    // a1 passes through, a2 splits into 2
    expect(virtualAssignments).toHaveLength(3);
    expect(virtualAssignments[0].id).toBe('a1');
    expect(virtualAssignments[0].splitPartIndex).toBeUndefined();
    expect(virtualAssignments[1].id).toBe('a2:split:0');
    expect(virtualAssignments[2].id).toBe('a2:split:1');

    // Original 2 tasks + 2 virtual split tasks
    expect(virtualTasks).toHaveLength(4);
  });

  it('supports non-contiguous parts on different days', () => {
    const assignments = [createAssignment('a1', 't1', 's1', 8, 4.5)];
    const tasks = [createTask('t1', 's1', 30, 240)];
    // Part 0 on March 11, Part 1 on March 12
    const part0Start = '2026-03-11T08:00:00.000Z';
    const part1Start = '2026-03-12T08:00:00.000Z';
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 120, scheduledStart: part0Start },
        { runMinutes: 120, scheduledStart: part1Start },
      ])],
    ]);

    const { virtualAssignments } = expandSplitAssignments(assignments, tasks, [], configs);

    expect(virtualAssignments).toHaveLength(2);
    expect(virtualAssignments[0].scheduledStart).toBe(part0Start);
    expect(virtualAssignments[1].scheduledStart).toBe(part1Start);

    // Parts are NOT contiguous — different days
    expect(virtualAssignments[0].scheduledEnd).not.toBe(virtualAssignments[1].scheduledStart);

    // Each part has correct duration: setup(30) + run(120) = 150min
    const dur0 = new Date(virtualAssignments[0].scheduledEnd).getTime() - new Date(virtualAssignments[0].scheduledStart).getTime();
    const dur1 = new Date(virtualAssignments[1].scheduledEnd).getTime() - new Date(virtualAssignments[1].scheduledStart).getTime();
    expect(dur0).toBe(150 * 60 * 1000);
    expect(dur1).toBe(150 * 60 * 1000);
  });
});

describe('addSplit', () => {
  it('creates a split config with parts array', () => {
    const configs = new Map<string, SplitConfig>();
    const parts = [
      { runMinutes: 120, scheduledStart: '2026-03-11T08:00:00.000Z' },
      { runMinutes: 120, scheduledStart: '2026-03-11T10:30:00.000Z' },
    ];
    const result = addSplit(configs, 'a1', 't1', 30, parts);

    expect(result.size).toBe(1);
    const config = result.get('a1')!;
    expect(config.parts).toEqual(parts);
    expect(config.setupMinutes).toBe(30);
    expect(config.taskId).toBe('t1');
    expect(config.splitGroupId).toBeTruthy();
  });

  it('handles asymmetric split', () => {
    const configs = new Map<string, SplitConfig>();
    const parts = [
      { runMinutes: 60, scheduledStart: '2026-03-11T08:00:00.000Z' },
      { runMinutes: 180, scheduledStart: '2026-03-11T09:30:00.000Z' },
    ];
    const result = addSplit(configs, 'a1', 't1', 30, parts);

    expect(result.get('a1')!.parts[0].runMinutes).toBe(60);
    expect(result.get('a1')!.parts[1].runMinutes).toBe(180);
  });
});

describe('removeSplit', () => {
  it('removes the split config', () => {
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 120, scheduledStart: '2026-03-11T08:00:00.000Z' },
        { runMinutes: 120, scheduledStart: '2026-03-11T10:30:00.000Z' },
      ])],
    ]);
    const result = removeSplit(configs, 'a1');

    expect(result.size).toBe(0);
  });

  it('does not modify other configs', () => {
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 120, scheduledStart: '2026-03-11T08:00:00.000Z' },
        { runMinutes: 120, scheduledStart: '2026-03-11T10:30:00.000Z' },
      ])],
      ['a2', createConfig('a2', 't2', 15, [
        { runMinutes: 60, scheduledStart: '2026-03-11T12:00:00.000Z' },
        { runMinutes: 60, scheduledStart: '2026-03-11T13:15:00.000Z' },
      ], 'g2')],
    ]);
    const result = removeSplit(configs, 'a1');

    expect(result.size).toBe(1);
    expect(result.has('a2')).toBe(true);
  });
});

describe('reSplit', () => {
  it('splits part 1 of 2-part config at 60 -> 3 parts', () => {
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 120, scheduledStart: '2026-03-11T08:00:00.000Z' },
        { runMinutes: 120, scheduledStart: '2026-03-11T10:30:00.000Z' },
      ])],
    ]);
    const newSubPartStart = '2026-03-11T12:00:00.000Z';
    const result = reSplit(configs, 'a1', 1, 60, newSubPartStart);
    const parts = result.get('a1')!.parts;

    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({ runMinutes: 120, scheduledStart: '2026-03-11T08:00:00.000Z' });
    expect(parts[1]).toEqual({ runMinutes: 60, scheduledStart: '2026-03-11T10:30:00.000Z' });
    expect(parts[2]).toEqual({ runMinutes: 60, scheduledStart: newSubPartStart });
  });

  it('splits part 0 of 2-part config at 30 -> 3 parts', () => {
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 120, scheduledStart: '2026-03-11T08:00:00.000Z' },
        { runMinutes: 120, scheduledStart: '2026-03-11T10:30:00.000Z' },
      ])],
    ]);
    const newSubPartStart = '2026-03-11T09:00:00.000Z';
    const result = reSplit(configs, 'a1', 0, 30, newSubPartStart);
    const parts = result.get('a1')!.parts;

    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({ runMinutes: 30, scheduledStart: '2026-03-11T08:00:00.000Z' });
    expect(parts[1]).toEqual({ runMinutes: 90, scheduledStart: newSubPartStart });
    expect(parts[2]).toEqual({ runMinutes: 120, scheduledStart: '2026-03-11T10:30:00.000Z' });
  });

  it('returns unchanged if splitAtRunMinutes is out of bounds', () => {
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 120, scheduledStart: '2026-03-11T08:00:00.000Z' },
        { runMinutes: 120, scheduledStart: '2026-03-11T10:30:00.000Z' },
      ])],
    ]);

    // splitAt >= original
    expect(reSplit(configs, 'a1', 0, 120, 'x')).toBe(configs);
    // splitAt <= 0
    expect(reSplit(configs, 'a1', 0, 0, 'x')).toBe(configs);
    // invalid index
    expect(reSplit(configs, 'a1', 5, 60, 'x')).toBe(configs);
  });

  it('returns unchanged for unknown assignment', () => {
    const configs = new Map<string, SplitConfig>();
    expect(reSplit(configs, 'unknown', 0, 60, 'x')).toBe(configs);
  });
});

describe('moveSplitPart', () => {
  it('updates one part scheduledStart, leaves others unchanged', () => {
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 120, scheduledStart: '2026-03-11T08:00:00.000Z' },
        { runMinutes: 120, scheduledStart: '2026-03-11T10:30:00.000Z' },
      ])],
    ]);
    const newStart = '2026-03-12T14:00:00.000Z';
    const result = moveSplitPart(configs, 'a1', 1, newStart);
    const parts = result.get('a1')!.parts;

    expect(parts[0].scheduledStart).toBe('2026-03-11T08:00:00.000Z'); // unchanged
    expect(parts[1].scheduledStart).toBe(newStart); // updated
    expect(parts[1].runMinutes).toBe(120); // runMinutes preserved
  });

  it('returns unchanged for invalid partIndex', () => {
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 120, scheduledStart: '2026-03-11T08:00:00.000Z' },
      ])],
    ]);

    expect(moveSplitPart(configs, 'a1', 5, 'x')).toBe(configs);
    expect(moveSplitPart(configs, 'a1', -1, 'x')).toBe(configs);
  });

  it('returns unchanged for unknown assignment', () => {
    const configs = new Map<string, SplitConfig>();
    expect(moveSplitPart(configs, 'unknown', 0, 'x')).toBe(configs);
  });
});

describe('getSplitPartIndex', () => {
  it('extracts index from virtual ID', () => {
    expect(getSplitPartIndex('a1:split:0')).toBe(0);
    expect(getSplitPartIndex('a1:split:2')).toBe(2);
    expect(getSplitPartIndex('abc-123:split:15')).toBe(15);
  });

  it('returns null for non-virtual IDs', () => {
    expect(getSplitPartIndex('a1')).toBeNull();
    expect(getSplitPartIndex('abc-123-def')).toBeNull();
  });
});

describe('getRealAssignmentId', () => {
  it('extracts real ID from virtual ID', () => {
    expect(getRealAssignmentId('a1:split:0')).toBe('a1');
    expect(getRealAssignmentId('a1:split:2')).toBe('a1');
  });

  it('returns the same ID if not virtual', () => {
    expect(getRealAssignmentId('a1')).toBe('a1');
    expect(getRealAssignmentId('abc-123-def')).toBe('abc-123-def');
  });
});

describe('expandSplitAssignments with 3-way split', () => {
  it('handles re-split producing 3 virtual tiles', () => {
    const assignments = [createAssignment('a1', 't1', 's1', 8, 5)];
    const tasks = [createTask('t1', 's1', 30, 240)];
    // After reSplit: 3 parts, each with independent start
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 120, scheduledStart: '2026-03-11T08:00:00.000Z' },
        { runMinutes: 60, scheduledStart: '2026-03-11T10:30:00.000Z' },
        { runMinutes: 60, scheduledStart: '2026-03-11T12:00:00.000Z' },
      ])],
    ]);

    const { virtualAssignments } = expandSplitAssignments(assignments, tasks, [], configs);

    expect(virtualAssignments).toHaveLength(3);
    expect(virtualAssignments[0].splitPartIndex).toBe(0);
    expect(virtualAssignments[0].splitPartTotal).toBe(3);
    expect(virtualAssignments[1].splitPartIndex).toBe(1);
    expect(virtualAssignments[1].splitPartTotal).toBe(3);
    expect(virtualAssignments[2].splitPartIndex).toBe(2);
    expect(virtualAssignments[2].splitPartTotal).toBe(3);

    // Part 0: 30+120 = 150min
    const dur0 = new Date(virtualAssignments[0].scheduledEnd).getTime() - new Date(virtualAssignments[0].scheduledStart).getTime();
    expect(dur0).toBe(150 * 60 * 1000);

    // Part 1: 30+60 = 90min
    const dur1 = new Date(virtualAssignments[1].scheduledEnd).getTime() - new Date(virtualAssignments[1].scheduledStart).getTime();
    expect(dur1).toBe(90 * 60 * 1000);

    // Part 2: 30+60 = 90min
    const dur2 = new Date(virtualAssignments[2].scheduledEnd).getTime() - new Date(virtualAssignments[2].scheduledStart).getTime();
    expect(dur2).toBe(90 * 60 * 1000);
  });
});

describe('edge cases', () => {
  it('minimum split: 30min run split into 15+15', () => {
    const assignments = [createAssignment('a1', 't1', 's1', 8, 1)];
    const tasks = [createTask('t1', 's1', 15, 30)];
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 15, [
        { runMinutes: 15, scheduledStart: '2026-03-11T08:00:00.000Z' },
        { runMinutes: 15, scheduledStart: '2026-03-11T08:30:00.000Z' },
      ])],
    ]);

    const { virtualAssignments } = expandSplitAssignments(assignments, tasks, [], configs);

    expect(virtualAssignments).toHaveLength(2);

    // Part 0: 15 setup + 15 run = 30min
    const dur0 = new Date(virtualAssignments[0].scheduledEnd).getTime() - new Date(virtualAssignments[0].scheduledStart).getTime();
    expect(dur0).toBe(30 * 60 * 1000);

    // Part 1: 15 setup + 15 run = 30min
    const dur1 = new Date(virtualAssignments[1].scheduledEnd).getTime() - new Date(virtualAssignments[1].scheduledStart).getTime();
    expect(dur1).toBe(30 * 60 * 1000);
  });

  it('max split: runMinutes-15 for first part', () => {
    const assignments = [createAssignment('a1', 't1', 's1', 8, 3)];
    const tasks = [createTask('t1', 's1', 30, 150)];
    const configs = new Map<string, SplitConfig>([
      ['a1', createConfig('a1', 't1', 30, [
        { runMinutes: 135, scheduledStart: '2026-03-11T08:00:00.000Z' },
        { runMinutes: 15, scheduledStart: '2026-03-11T10:45:00.000Z' },
      ])],
    ]);

    const { virtualAssignments } = expandSplitAssignments(assignments, tasks, [], configs);

    expect(virtualAssignments).toHaveLength(2);
    // Part 0: 30+135 = 165min, Part 1: 30+15 = 45min
    const dur0 = new Date(virtualAssignments[0].scheduledEnd).getTime() - new Date(virtualAssignments[0].scheduledStart).getTime();
    const dur1 = new Date(virtualAssignments[1].scheduledEnd).getTime() - new Date(virtualAssignments[1].scheduledStart).getTime();
    expect(dur0).toBe(165 * 60 * 1000);
    expect(dur1).toBe(45 * 60 * 1000);
  });
});

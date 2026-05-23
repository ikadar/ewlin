import { describe, expect, it } from 'vitest';
import {
  computeRemainingDsl,
  type TaskForRemainingDsl,
} from './computeRemainingDsl';

const baseInternal: Partial<TaskForRemainingDsl> = {
  taskType: 'internal',
  durationOpenDays: null,
  actionType: null,
  comment: null,
  recordedProgressPct: null,
  lastSetupAt: null,
};

function task(overrides: Partial<TaskForRemainingDsl>): TaskForRemainingDsl {
  return {
    id: overrides.id ?? 't',
    sequenceOrder: overrides.sequenceOrder ?? 0,
    taskType: overrides.taskType ?? 'internal',
    status: overrides.status ?? 'defined',
    stationName: overrides.stationName ?? null,
    providerName: overrides.providerName ?? null,
    setupMinutes: overrides.setupMinutes ?? null,
    runMinutes: overrides.runMinutes ?? null,
    durationOpenDays: overrides.durationOpenDays ?? null,
    actionType: overrides.actionType ?? null,
    comment: overrides.comment ?? null,
    recordedProgressPct: overrides.recordedProgressPct ?? null,
    lastSetupAt: overrides.lastSetupAt ?? null,
  };
}

describe('computeRemainingDsl', () => {
  it('returns empty when no tasks', () => {
    const r = computeRemainingDsl([]);
    expect(r.dsl).toBe('');
    expect(r.completedTasks).toEqual([]);
    expect(r.inProgressTask).toBeNull();
  });

  it('all-future returns full DSL untouched', () => {
    const r = computeRemainingDsl([
      task({ id: '1', sequenceOrder: 0, status: 'defined', stationName: 'Komori', setupMinutes: 20, runMinutes: 40 }),
      task({ id: '2', sequenceOrder: 1, status: 'defined', stationName: 'Massicot', setupMinutes: 0, runMinutes: 15 }),
    ]);
    expect(r.dsl).toBe('Komori(20+40)\nMassicot(0+15)');
    expect(r.inProgressTask).toBeNull();
    expect(r.completedTasks).toEqual([]);
  });

  it('completed tasks excluded from DSL, surfaced in completedTasks', () => {
    const r = computeRemainingDsl([
      task({ id: '1', sequenceOrder: 0, status: 'completed', stationName: 'Komori', setupMinutes: 20, runMinutes: 40 }),
      task({ id: '2', sequenceOrder: 1, status: 'defined', stationName: 'G37', setupMinutes: 20, runMinutes: 40 }),
    ]);
    expect(r.dsl).toBe('G37(20+40)');
    expect(r.completedTasks).toHaveLength(1);
    expect(r.completedTasks[0].id).toBe('1');
  });

  it('in-progress task shows remaining run (reduced by progress)', () => {
    const r = computeRemainingDsl([
      task({
        id: '1', sequenceOrder: 0, status: 'assigned',
        stationName: 'G37', setupMinutes: 20, runMinutes: 40,
        recordedProgressPct: 40, lastSetupAt: '2026-05-06T11:08:00Z',
      }),
      task({ id: '2', sequenceOrder: 1, status: 'defined', stationName: 'Pliage', setupMinutes: 0, runMinutes: 10 }),
    ]);
    // 40min × (1 - 0.40) = 24min remaining
    expect(r.dsl).toBe('G37(20+24)\nPliage(0+10)');
    expect(r.inProgressTask?.id).toBe('1');
    expect(r.completedTasks).toEqual([]);
  });

  it('in-progress detected via lastSetupAt even with 0% progress', () => {
    const r = computeRemainingDsl([
      task({
        id: '1', sequenceOrder: 0, status: 'assigned',
        stationName: 'G37', setupMinutes: 20, runMinutes: 40,
        recordedProgressPct: 0, lastSetupAt: '2026-05-06T11:08:00Z',
      }),
    ]);
    expect(r.dsl).toBe('G37(20+40)'); // Run unchanged because pct = 0
    expect(r.inProgressTask?.id).toBe('1');
  });

  it('cancelled tasks are silently dropped', () => {
    const r = computeRemainingDsl([
      task({ id: '1', sequenceOrder: 0, status: 'cancelled', stationName: 'Old', setupMinutes: 20, runMinutes: 40 }),
      task({ id: '2', sequenceOrder: 1, status: 'defined', stationName: 'New', setupMinutes: 25, runMinutes: 50 }),
    ]);
    expect(r.dsl).toBe('New(25+50)');
    expect(r.completedTasks).toEqual([]);
    expect(r.inProgressTask).toBeNull();
  });

  it('outsourced task appears as ST:Provider(Nj):action', () => {
    const r = computeRemainingDsl([
      task({
        id: '1', sequenceOrder: 0, status: 'defined',
        taskType: 'outsourced',
        providerName: 'Clement', durationOpenDays: 2, actionType: 'Pelliculage',
      }),
    ]);
    expect(r.dsl).toBe('ST:Clement(2j):Pelliculage');
  });

  it('task at 100% progress treated as completed, excluded from DSL', () => {
    const r = computeRemainingDsl([
      task({
        id: '1', sequenceOrder: 0, status: 'assigned',
        stationName: 'G37', setupMinutes: 10, runMinutes: 60,
        recordedProgressPct: 100, lastSetupAt: '2026-05-06T07:55:00Z',
      }),
      task({ id: '2', sequenceOrder: 1, status: 'defined', stationName: 'P137', setupMinutes: 0, runMinutes: 10 }),
      task({ id: '3', sequenceOrder: 2, status: 'defined', stationName: 'MBO', setupMinutes: 30, runMinutes: 240 }),
    ]);
    expect(r.dsl).toBe('P137(0+10)\nMBO(30+240)');
    expect(r.completedTasks).toHaveLength(1);
    expect(r.completedTasks[0].id).toBe('1');
    expect(r.inProgressTask).toBeNull();
  });

  it('orders by sequenceOrder regardless of input order', () => {
    const r = computeRemainingDsl([
      task({ id: 'b', sequenceOrder: 2, status: 'defined', stationName: 'B', setupMinutes: 0, runMinutes: 5 }),
      task({ id: 'a', sequenceOrder: 1, status: 'defined', stationName: 'A', setupMinutes: 0, runMinutes: 10 }),
    ]);
    expect(r.dsl).toBe('A(0+10)\nB(0+5)');
  });
});

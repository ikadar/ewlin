/**
 * Playwright test — Concurrent groups end-to-end through the Rust engine.
 *
 * Posts a minimal ComputeRequest directly to the Rust scheduling engine
 * (port 3003), bypassing the PHP layer entirely. Two scenarios:
 *
 *   1. Ludovic: 1 operator with concurrent group {SBG, MBO XL} → expected
 *      to run both jobs in parallel (assignments overlap in time).
 *   2. Frédéric: same skills but no group → expected to serialize
 *      (assignments do NOT overlap, total makespan ~2× single duration).
 *
 * The test prints both timelines to the terminal so the verdict is visible
 * even without a browser. No `page` is used — only Playwright's `request`
 * context. Run:
 *
 *   pnpm playwright test concurrent-groups-compute --reporter=list --workers=1
 */

import { test, expect, request } from '@playwright/test';

const ENGINE_URL = 'http://localhost:3003/compute';

const SBG_ID = '11111111-aaaa-aaaa-aaaa-000000000001';
const MBO_ID = '22222222-bbbb-bbbb-bbbb-000000000002';
const JOB_A = 'job-sbg';
const JOB_B = 'job-mbo';

interface OperatorAssignment {
  operatorId: string;
  from: string;
  to: string;
  attention: number;
}

interface ComputedAssignment {
  taskId: string;
  stationId: string;
  scheduledStart: string;
  scheduledEnd: string;
  operators: OperatorAssignment[];
  setupEnd?: string | null;
  isDegraded: boolean;
  effectiveProductivity: number;
  isMaskedTime: boolean;
}

interface Warning {
  taskId: string | null;
  message: string;
}

interface ScheduleResult {
  assignments: ComputedAssignment[];
  stats: { makespanMinutes: number; totalTasks: number; scheduledTasks: number };
  warnings: Warning[];
  fbiIterations: number;
  computeTimeMs: number;
}

interface ConcurrentGroupInput {
  stationIds: [string, string];
  effectiveProductivity: Record<string, number>;
}

/**
 * Build a minimal compute request with 2 stations, 1 operator, and 2
 * one-hour jobs (one per station). The operator gets either an empty
 * concurrent_groups list (Frédéric) or one declared pair (Ludovic).
 */
function buildRequest(operatorName: string, concurrentGroups: ConcurrentGroupInput[]) {
  return {
    stations: [
      {
        id: SBG_ID,
        name: 'SBG',
        attentionFull: 1.0,
        attentionRun: 1.0,
        maxRunAttention: 1.0,
        maskedTimeEnabled: true,
        tickMinutes: 60,
        maxOperators: 1,
        capacity: 1,
        isPress: false,
        dryingTimeMinutes: 0,
      },
      {
        id: MBO_ID,
        name: 'MBO XL',
        attentionFull: 1.0,
        attentionRun: 1.0,
        maxRunAttention: 1.0,
        maskedTimeEnabled: true,
        tickMinutes: 60,
        maxOperators: 1,
        capacity: 1,
        isPress: false,
        dryingTimeMinutes: 0,
      },
    ],
    operators: [
      {
        id: 'op-test-1',
        firstName: operatorName,
        lastName: 'Test',
        role: 'operator',
        skills: [
          { stationId: SBG_ID, proficiency: 1.0 },
          { stationId: MBO_ID, proficiency: 1.0 },
        ],
        concurrentGroups,
      },
    ],
    jobs: [
      {
        id: 'job-a-id',
        deadlinePriority: 2,
        elements: [
          {
            id: 'elem-a',
            tasks: [
              {
                id: JOB_A,
                stationId: SBG_ID,
                setupMinutes: 0,
                runMinutes: 60,
                sequenceOrder: 0,
              },
            ],
          },
        ],
      },
      {
        id: 'job-b-id',
        deadlinePriority: 2,
        elements: [
          {
            id: 'elem-b',
            tasks: [
              {
                id: JOB_B,
                stationId: MBO_ID,
                setupMinutes: 0,
                runMinutes: 60,
                sequenceOrder: 0,
              },
            ],
          },
        ],
      },
    ],
    options: {
      horizonDays: 2,
      tickMinutes: 60,
      fbiMaxIterations: 1,
      multiStart: false,
    },
  };
}

async function postCompute(payload: object): Promise<ScheduleResult> {
  const ctx = await request.newContext();
  const res = await ctx.post(ENGINE_URL, { data: payload });
  if (!res.ok()) {
    throw new Error(`Engine responded ${res.status()}: ${await res.text()}`);
  }
  const result = (await res.json()) as ScheduleResult;
  await ctx.dispose();
  return result;
}

/** Parse "YYYY-MM-DDTHH:MM:00" into absolute minutes. */
function isoToMinutes(s: string): number {
  // chrono::NaiveDateTime serializes with 'T' separator and seconds.
  return Math.floor(new Date(s).getTime() / 60000);
}

function summarize(label: string, result: ScheduleResult): {
  taskA?: ComputedAssignment;
  taskB?: ComputedAssignment;
  startA: number;
  endA: number;
  startB: number;
  endB: number;
  overlap: boolean;
  makespan: number;
} {
  const taskA = result.assignments.find((a) => a.taskId === JOB_A);
  const taskB = result.assignments.find((a) => a.taskId === JOB_B);
  if (!taskA || !taskB) {
    console.log(`[${label}] missing assignments:`, result.assignments);
    throw new Error(`${label}: expected both task assignments`);
  }
  const startA = isoToMinutes(taskA.scheduledStart);
  const endA = isoToMinutes(taskA.scheduledEnd);
  const startB = isoToMinutes(taskB.scheduledStart);
  const endB = isoToMinutes(taskB.scheduledEnd);
  const overlap = startA < endB && startB < endA;
  const makespan = Math.max(endA, endB) - Math.min(startA, startB);

  console.log(`[${label}]`);
  console.log(`  ${JOB_A} on SBG    : ${taskA.scheduledStart} → ${taskA.scheduledEnd}`);
  console.log(`  ${JOB_B} on MBO XL : ${taskB.scheduledStart} → ${taskB.scheduledEnd}`);
  console.log(`  overlap   : ${overlap ? 'YES (parallel)' : 'NO (serialized)'}`);
  console.log(`  makespan  : ${makespan} min`);
  if (result.warnings.length > 0) {
    console.log(`  warnings  :`, result.warnings.map((w) => w.message));
  }
  return { taskA, taskB, startA, endA, startB, endB, overlap, makespan };
}

test.describe('Concurrent groups — algorithmic pairing through Rust engine', () => {
  test('Ludovic with declared group runs both jobs in parallel', async () => {
    const ludovicReq = buildRequest('Ludovic', [
      {
        stationIds: [SBG_ID, MBO_ID],
        effectiveProductivity: {
          [SBG_ID]: 0.85,
          [MBO_ID]: 0.9,
        },
      },
    ]);

    const result = await postCompute(ludovicReq);
    const summary = summarize('LUDOVIC (paired)', result);

    expect(summary.overlap).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  test('Frédéric without group must serialize the two jobs', async () => {
    const fredReq = buildRequest('Frederic', []); // no groups → no pairing

    const result = await postCompute(fredReq);
    const summary = summarize('FREDERIC (unpaired)', result);

    expect(summary.overlap).toBe(false);
    // Total wall-clock should be at least 2× one job (~120 min). Allow some
    // FBI placement slack.
    expect(summary.makespan).toBeGreaterThanOrEqual(120);
  });

  test('side-by-side comparison: paired makespan < unpaired makespan', async () => {
    const ludovicReq = buildRequest('Ludovic', [
      {
        stationIds: [SBG_ID, MBO_ID],
        effectiveProductivity: {
          [SBG_ID]: 1.0,
          [MBO_ID]: 1.0,
        },
      },
    ]);
    const fredReq = buildRequest('Frederic', []);

    const ludovicResult = await postCompute(ludovicReq);
    const fredResult = await postCompute(fredReq);

    const ludovicSummary = summarize('LUDOVIC 1.0/1.0', ludovicResult);
    const fredSummary = summarize('FREDERIC no-group', fredResult);

    console.log(`\n=== VERDICT ===`);
    console.log(`Paired makespan   : ${ludovicSummary.makespan} min`);
    console.log(`Unpaired makespan : ${fredSummary.makespan} min`);
    console.log(`Speedup           : ${(fredSummary.makespan / ludovicSummary.makespan).toFixed(2)}×`);
    console.log(`================\n`);

    expect(ludovicSummary.makespan).toBeLessThan(fredSummary.makespan);
  });
});

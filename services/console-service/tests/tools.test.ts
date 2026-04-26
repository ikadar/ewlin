/**
 * Unit tests for the tool registry — handlers in isolation, no LLM,
 * no live HTTP. The PHP client is replaced by a fake that captures the
 * calls so we can verify each tool hits the right endpoint with the
 * right shape.
 *
 * These cover the dry-run path (which is what the propose-then-confirm
 * flow uses) and the wet path (what /console/apply runs).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { ToolContext } from '../src/tools/types.js';
import { addOperatorAbsenceTool, addStationMaintenanceTool, listActiveConstraintsTool } from '../src/tools/constraints.js';
import { updateJobDeadlineTool } from '../src/tools/jobs.js';
import { resolveOperatorTool, resolveStationTool } from '../src/tools/resolve.js';
import { proposePlanTool, askUserTool } from '../src/tools/system.js';
import {
  checkStationOperatorAvailability,
  checkStationOperatorAvailabilityTool,
  pinTaskAtTimeTool,
} from '../src/tools/tasks.js';
import { allTools, mcpExposedTools, findTool } from '../src/tools/registry.js';
import type { PhpClient } from '../src/phpClient.js';

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

function makeFakePhp(responses: Record<string, unknown> = {}): { php: PhpClient; calls: Call[] } {
  const calls: Call[] = [];
  const fake = {
    async get<T>(path: string): Promise<T> {
      calls.push({ method: 'GET', path });
      return (responses[`GET ${path}`] ?? []) as T;
    },
    async post<T>(path: string, body: unknown): Promise<T> {
      calls.push({ method: 'POST', path, body });
      return (responses[`POST ${path}`] ?? { id: 'fake-id' }) as T;
    },
    async put<T>(path: string, body: unknown): Promise<T> {
      calls.push({ method: 'PUT', path, body });
      return (responses[`PUT ${path}`] ?? {}) as T;
    },
    async patch<T>(path: string, body: unknown): Promise<T> {
      calls.push({ method: 'PATCH', path, body });
      return (responses[`PATCH ${path}`] ?? {}) as T;
    },
    async delete<T>(path: string): Promise<T> {
      calls.push({ method: 'DELETE', path });
      return (responses[`DELETE ${path}`] ?? undefined) as T;
    },
  };
  return { php: fake as unknown as PhpClient, calls };
}

function makeCtx(php: PhpClient, dryRun = false): ToolContext {
  return { php, dryRun, todayIso: '2026-04-08' };
}

describe('tool registry', () => {
  it('exposes all expected tools by name', () => {
    const names = allTools.map((t) => t.name).sort();
    expect(names).toContain('resolve_operator');
    expect(names).toContain('add_operator_absence');
    expect(names).toContain('update_job_deadline');
    expect(names).toContain('propose_plan');
  });

  it('mcpExposedTools excludes internal tools', () => {
    const mcpNames = mcpExposedTools().map((t) => t.name);
    expect(mcpNames).not.toContain('propose_plan');
    expect(mcpNames).not.toContain('ask_user');
    expect(mcpNames).toContain('resolve_operator');
  });

  it('findTool returns the right definition or undefined', () => {
    expect(findTool('add_operator_absence')?.name).toBe('add_operator_absence');
    expect(findTool('does_not_exist')).toBeUndefined();
  });
});

describe('resolve_operator', () => {
  it('finds operators by first name (case-insensitive, accent-insensitive)', async () => {
    const { php, calls } = makeFakePhp({
      'GET /api/v1/operators': [
        { id: 'op-1', firstName: 'Frédéric', lastName: 'Dupont', role: 'Conducteur' },
        { id: 'op-2', firstName: 'Frederic', lastName: 'Martin', role: 'Facadier' },
        { id: 'op-3', firstName: 'Ludovic', lastName: 'Test', role: 'Conducteur' },
      ],
    });

    const result = await resolveOperatorTool.handler({ name: 'frederic' }, makeCtx(php));
    expect(calls[0]?.path).toBe('/api/v1/operators');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { candidates: unknown[] };
    expect(data.candidates).toHaveLength(2);
  });
});

describe('resolve_station', () => {
  it('finds stations by name or abbreviation', async () => {
    const { php } = makeFakePhp({
      'GET /api/v1/stations': [
        { id: 's-1', name: 'MBO XL', abbreviation: 'MBOXL' },
        { id: 's-2', name: 'MBO L', abbreviation: 'MBOL' },
        { id: 's-3', name: 'Press', abbreviation: 'P' },
      ],
    });

    const result = await resolveStationTool.handler({ name: 'mbo' }, makeCtx(php));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { candidates: { id: string }[] };
    expect(data.candidates.map((c) => c.id).sort()).toEqual(['s-1', 's-2']);
  });
});

describe('add_operator_absence', () => {
  it('rejects malformed dates', async () => {
    const { php } = makeFakePhp();
    const result = await addOperatorAbsenceTool.handler(
      { operatorId: 'op-1', operatorLabel: 'Frédéric', fromDate: '13/04/2026', toDate: '15/04/2026' },
      makeCtx(php),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects toDate before fromDate', async () => {
    const { php } = makeFakePhp();
    const result = await addOperatorAbsenceTool.handler(
      { operatorId: 'op-1', operatorLabel: 'Frédéric', fromDate: '2026-04-15', toDate: '2026-04-13' },
      makeCtx(php),
    );
    expect(result.ok).toBe(false);
  });

  it('dry-run does NOT call the PHP API', async () => {
    const { php, calls } = makeFakePhp();
    const result = await addOperatorAbsenceTool.handler(
      { operatorId: 'op-1', operatorLabel: 'Frédéric', fromDate: '2026-04-13', toDate: '2026-04-15' },
      makeCtx(php, true),
    );
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(0);
    if (!result.ok) return;
    expect(result.preview).toContain('Frédéric');
  });

  it('wet mode reads then PUTs Operator.absences', async () => {
    const { php, calls } = makeFakePhp({
      'GET /api/v1/operators/op-1': {
        id: 'op-1',
        firstName: 'Frédéric',
        lastName: 'Dupont',
        absences: [{ startAt: '2026-03-01T00:00:00', endAt: '2026-03-03T23:59:00', reason: 'passé' }],
      },
    });
    const result = await addOperatorAbsenceTool.handler(
      { operatorId: 'op-1', operatorLabel: 'Frédéric', fromDate: '2026-04-13', toDate: '2026-04-15', reason: 'congés' },
      makeCtx(php),
    );
    expect(result.ok).toBe(true);
    // First call = GET to read current absences; second = PUT with the full array.
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.path).toBe('/api/v1/operators/op-1');
    const body = put?.body as { absences: { startAt: string; endAt: string; reason: string | null }[] };
    expect(body.absences).toHaveLength(2);
    expect(body.absences[1].startAt).toMatch(/^2026-04-13T00:00:00/);
    expect(body.absences[1].endAt).toMatch(/^2026-04-15T23:59:00/);
    expect(body.absences[1].reason).toBe('congés');
  });
});

describe('add_station_maintenance', () => {
  it('rejects malformed date', async () => {
    const { php } = makeFakePhp();
    const result = await addStationMaintenanceTool.handler(
      { stationId: 's-1', stationLabel: 'MBO XL', fromDate: '14/04/2026', toDate: '14/04/2026' },
      makeCtx(php),
    );
    expect(result.ok).toBe(false);
  });

  it('without explicit times writes a full-day period', async () => {
    const { php, calls } = makeFakePhp({
      'GET /api/v1/stations/s-1': { id: 's-1', name: 'MBO XL', scheduleExceptions: [] },
    });
    const result = await addStationMaintenanceTool.handler(
      {
        stationId: 's-1',
        stationLabel: 'MBO XL',
        fromDate: '2026-04-14',
        toDate: '2026-04-14',
        reason: 'vidange',
      },
      makeCtx(php),
    );
    expect(result.ok).toBe(true);
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.path).toBe('/api/v1/stations/s-1');
    const body = put?.body as { scheduleExceptions: { startAt: string; endAt: string; reason: string | null }[] };
    expect(body.scheduleExceptions).toHaveLength(1);
    expect(body.scheduleExceptions[0].startAt).toMatch(/^2026-04-14T00:00:00/);
    expect(body.scheduleExceptions[0].endAt).toMatch(/^2026-04-14T23:59:00/);
    expect(body.scheduleExceptions[0].reason).toBe('vidange');
  });

  it('with explicit times writes the supplied sub-day period', async () => {
    const { php, calls } = makeFakePhp({
      'GET /api/v1/stations/s-1': { id: 's-1', name: 'MBO XL', scheduleExceptions: [] },
    });
    const result = await addStationMaintenanceTool.handler(
      {
        stationId: 's-1',
        stationLabel: 'MBO XL',
        fromDate: '2026-04-14',
        toDate: '2026-04-14',
        startTime: '12:00',
        endTime: '18:00',
      },
      makeCtx(php),
    );
    expect(result.ok).toBe(true);
    const put = calls.find((c) => c.method === 'PUT');
    const body = put?.body as { scheduleExceptions: { startAt: string; endAt: string }[] };
    expect(body.scheduleExceptions[0].startAt).toMatch(/^2026-04-14T12:00:00/);
    expect(body.scheduleExceptions[0].endAt).toMatch(/^2026-04-14T18:00:00/);
  });
});

describe('update_job_deadline', () => {
  it('rejects when neither newDeadline nor shiftDays is given', async () => {
    const { php } = makeFakePhp();
    const result = await updateJobDeadlineTool.handler(
      { jobId: 'j-1', jobLabel: '35202' },
      makeCtx(php),
    );
    expect(result.ok).toBe(false);
  });

  it('shiftDays mode reads current deadline and PUTs the new one', async () => {
    const { php, calls } = makeFakePhp({
      'GET /api/v1/jobs/j-1': { id: 'j-1', batDeadline: '2026-04-15T17:00:00' },
    });
    const result = await updateJobDeadlineTool.handler(
      { jobId: 'j-1', jobLabel: '35202', shiftDays: 4 },
      makeCtx(php),
    );
    expect(result.ok).toBe(true);
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.path).toBe('/api/v1/jobs/j-1');
    const body = put?.body as Record<string, unknown>;
    expect(typeof body.batDeadline).toBe('string');
    expect((body.batDeadline as string).slice(0, 10)).toBe('2026-04-19');
  });
});

describe('list_active_constraints', () => {
  it('aggregates operator absences and station exceptions, filtering past ones', async () => {
    const { php } = makeFakePhp({
      'GET /api/v1/operators': [
        {
          id: 'op-1',
          firstName: 'Frédéric',
          lastName: 'Dupont',
          absences: [
            { startAt: '2026-04-01T00:00:00', endAt: '2026-04-02T23:59:00', reason: 'past' },
            { startAt: '2026-04-13T00:00:00', endAt: '2026-04-15T23:59:00', reason: 'future' },
          ],
        },
      ],
      'GET /api/v1/stations': [
        {
          id: 's-1',
          name: 'MBO XL',
          scheduleExceptions: [
            { startAt: '2026-04-08T00:00:00', endAt: '2026-04-08T23:59:00', reason: 'vidange' },
            { startAt: '2026-04-01T00:00:00', endAt: '2026-04-01T23:59:00', reason: 'past' },
          ],
        },
      ],
    });
    const result = await listActiveConstraintsTool.handler({}, makeCtx(php));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { count: number; constraints: { id: string; kind: string }[] };
    // todayIso in makeCtx is expected to be 2026-04-10 (see fixture); future
    // absence + future station exception kept; past ones filtered.
    expect(data.count).toBe(2);
    const kinds = data.constraints.map((c) => c.kind).sort();
    expect(kinds).toEqual(['operator-absence', 'station-exception']);
  });
});

describe('system tools (propose_plan, ask_user)', () => {
  let calls: Call[];
  beforeEach(() => {
    calls = makeFakePhp().calls;
  });

  it('propose_plan returns its input verbatim and never calls PHP', async () => {
    const { php } = makeFakePhp();
    const result = await proposePlanTool.handler(
      {
        narration: 'Je vais ajouter une absence',
        actions: [{ tool: 'add_operator_absence', args: { operatorId: 'op-1' } }],
      },
      makeCtx(php),
    );
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(0);
    expect(proposePlanTool.internal).toBe(true);
  });

  it('ask_user returns its question/options and never calls PHP', async () => {
    const { php } = makeFakePhp();
    const result = await askUserTool.handler(
      { question: 'Quel Frédéric ?', options: ['Dupont', 'Martin'] },
      makeCtx(php),
    );
    expect(result.ok).toBe(true);
    expect(askUserTool.internal).toBe(true);
  });
});

// 2026-04-13 is a Monday; 2026-04-18 is a Saturday. Tests use 12:00 to
// stay safely inside the same local day regardless of runner TZ.
const RYOBI_STATION = {
  id: 'sta-ryobi',
  name: 'Ryobi',
  abbreviation: 'RYO',
  operatingSchedule: {
    monday:    { isOperating: true,  slots: [{ start: '08:00', end: '18:00' }] },
    tuesday:   { isOperating: true,  slots: [{ start: '08:00', end: '18:00' }] },
    wednesday: { isOperating: true,  slots: [{ start: '08:00', end: '18:00' }] },
    thursday:  { isOperating: true,  slots: [{ start: '08:00', end: '18:00' }] },
    friday:    { isOperating: true,  slots: [{ start: '08:00', end: '18:00' }] },
    saturday:  { isOperating: false, slots: [] },
    sunday:    { isOperating: false, slots: [] },
  },
  exceptions: [],
};

describe('checkStationOperatorAvailability (helper)', () => {
  it('returns available=true when the day is operating and time is in slot', () => {
    const result = checkStationOperatorAvailability(
      { stations: [RYOBI_STATION] },
      'sta-ryobi',
      '2026-04-13T12:00:00',
    );
    expect(result.available).toBe(true);
  });

  it('returns available=false on a non-operating day', () => {
    const result = checkStationOperatorAvailability(
      { stations: [RYOBI_STATION] },
      'sta-ryobi',
      '2026-04-18T12:00:00',
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain('samedi');
  });

  it('returns available=false outside the operating slots', () => {
    const result = checkStationOperatorAvailability(
      { stations: [RYOBI_STATION] },
      'sta-ryobi',
      '2026-04-13T19:00:00',
    );
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/hors des plages/);
  });

  it('returns available=false when an exception masks the slot', () => {
    const masked = {
      ...RYOBI_STATION,
      exceptions: [
        { startAt: '2026-04-13T09:00:00', endAt: '2026-04-13T15:00:00', reason: 'maintenance' },
      ],
    };
    const result = checkStationOperatorAvailability(
      { stations: [masked] },
      'sta-ryobi',
      '2026-04-13T12:00:00',
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain('maintenance');
  });

  it('returns available=false when station not found', () => {
    const result = checkStationOperatorAvailability(
      { stations: [RYOBI_STATION] },
      'sta-other',
      '2026-04-13T12:00:00',
    );
    expect(result.available).toBe(false);
  });

  it('returns available=false when operatingSchedule is missing entirely', () => {
    const noSched = { id: 'sta-x', name: 'X', operatingSchedule: null, exceptions: [] };
    const result = checkStationOperatorAvailability(
      { stations: [noSched] },
      'sta-x',
      '2026-04-13T12:00:00',
    );
    expect(result.available).toBe(false);
  });
});

describe('check_station_operator_availability (tool)', () => {
  it('reports available=true through the snapshot endpoint', async () => {
    const { php, calls } = makeFakePhp({
      'GET /api/v1/schedule/snapshot': { stations: [RYOBI_STATION], assignments: [] },
    });
    const result = await checkStationOperatorAvailabilityTool.handler(
      { stationId: 'sta-ryobi', stationLabel: 'Ryobi', date: '2026-04-13', time: '12:00' },
      makeCtx(php),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(calls.find((c) => c.path === '/api/v1/schedule/snapshot')).toBeTruthy();
    const data = result.data as { available: boolean; stationLabel: string };
    expect(data.available).toBe(true);
    expect(data.stationLabel).toBe('Ryobi');
  });

  it('reports available=false with reason when station closed', async () => {
    const { php } = makeFakePhp({
      'GET /api/v1/schedule/snapshot': { stations: [RYOBI_STATION], assignments: [] },
    });
    const result = await checkStationOperatorAvailabilityTool.handler(
      { stationId: 'sta-ryobi', stationLabel: 'Ryobi', date: '2026-04-18', time: '12:00' },
      makeCtx(php),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { available: boolean; reason?: string };
    expect(data.available).toBe(false);
    expect(typeof data.reason).toBe('string');
  });

  it('is registered as readOnly and exposed via MCP', () => {
    expect(checkStationOperatorAvailabilityTool.readOnly).toBe(true);
    expect(checkStationOperatorAvailabilityTool.internal).toBeFalsy();
  });
});

describe('pin_task_at_time (operator-availability safety net)', () => {
  it('returns no warning when an operator is scheduled at the pinned slot', async () => {
    const { php } = makeFakePhp({
      'GET /api/v1/schedule/snapshot': {
        stations: [RYOBI_STATION],
        assignments: [{ id: 'as-1', taskId: 'task-1', targetId: 'sta-ryobi', scheduledStart: '', scheduledEnd: '', isPinned: false }],
      },
    });
    const result = await pinTaskAtTimeTool.handler(
      {
        taskId: 'task-1',
        taskLabel: 'MBO XL',
        stationId: 'sta-ryobi',
        stationLabel: 'Ryobi',
        date: '2026-04-13',
        time: '12:00',
      },
      makeCtx(php),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { warning?: string };
    expect(data.warning).toBeUndefined();
  });

  it('attaches a warning when no operator is scheduled at the pinned slot', async () => {
    const { php, calls } = makeFakePhp({
      'GET /api/v1/schedule/snapshot': {
        stations: [RYOBI_STATION],
        assignments: [{ id: 'as-1', taskId: 'task-1', targetId: 'sta-ryobi', scheduledStart: '', scheduledEnd: '', isPinned: false }],
      },
    });
    const result = await pinTaskAtTimeTool.handler(
      {
        taskId: 'task-1',
        taskLabel: 'MBO XL',
        stationId: 'sta-ryobi',
        stationLabel: 'Ryobi',
        date: '2026-04-18', // Saturday → non-operating
        time: '12:00',
      },
      makeCtx(php),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { warning?: string };
    expect(typeof data.warning).toBe('string');
    expect(data.warning).toContain('samedi');
    // The pin still went through despite the warning.
    expect(calls.some((c) => c.method === 'PUT' && c.path === '/api/v1/tasks/task-1/assign')).toBe(true);
    expect(calls.some((c) => c.method === 'PUT' && c.path === '/api/v1/tasks/task-1/pin')).toBe(true);
  });
});

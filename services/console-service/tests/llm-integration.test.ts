/**
 * Live integration test against the Anthropic Messages API.
 *
 * Skipped automatically when ANTHROPIC_API_KEY is not set.
 *
 * To run:
 *   ANTHROPIC_API_KEY=sk-ant-... npm test -- llm-integration
 */
import { describe, it, expect } from 'vitest';
import { runExecuteLoop } from '../src/llm/loop.js';
import type { PhpClient } from '../src/phpClient.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig();
const apiKeyAvailable = config.anthropicApiKey.length > 0;

/**
 * Fake PhpClient that pretends Frédéric and the MBO XL exist. The LLM
 * will call resolve_operator / resolve_station — we return the canonical
 * shapes so it can pick a UUID and proceed to propose_plan.
 */
function makeFakePhp(): PhpClient {
  const fake = {
    async get<T>(path: string): Promise<T> {
      if (path === '/api/v1/operators') {
        return [
          { id: '11111111-1111-1111-1111-111111111111', firstName: 'Frédéric', lastName: 'Dupont', role: 'Conducteur' },
          { id: '22222222-2222-2222-2222-222222222222', firstName: 'Ludovic', lastName: 'Martin', role: 'Conducteur' },
        ] as T;
      }
      if (path === '/api/v1/stations') {
        return [
          { id: '33333333-3333-3333-3333-333333333333', name: 'MBO XL', abbreviation: 'MBOXL' },
          { id: '44444444-4444-4444-4444-444444444444', name: 'Press', abbreviation: 'P' },
        ] as T;
      }
      if (path === '/api/v1/jobs/search-by-references?refs=35202') {
        return [{ id: '55555555-5555-5555-5555-555555555555', reference: '35202', batDeadline: '2026-04-15T17:00:00' }] as T;
      }
      if (path === '/api/v1/jobs/55555555-5555-5555-5555-555555555555') {
        return { id: '55555555-5555-5555-5555-555555555555', reference: '35202', batDeadline: '2026-04-15T17:00:00' } as T;
      }
      return [] as T;
    },
    async post<T>(): Promise<T> {
      return { id: 'fake' } as T;
    },
    async put<T>(): Promise<T> {
      return {} as T;
    },
    async patch<T>(): Promise<T> {
      return {} as T;
    },
    async delete<T>(): Promise<T> {
      return undefined as T;
    },
  };
  return fake as unknown as PhpClient;
}

describe.skipIf(!apiKeyAvailable)('LLM integration (live Anthropic Haiku)', () => {
  it(
    'plans an operator absence from a French prompt',
    async () => {
      const result = await runExecuteLoop({
        prompt: 'Frédéric absent du 13 au 15 avril',
        conversation: [],
        jwt: 'fake-jwt',
        config,
        dryRun: true,
        php: makeFakePhp(),
      });

      expect(result.kind).toBe('plan');
      if (result.kind !== 'plan') return;

      const toolNames = result.actions.map((a) => a.tool);
      expect(toolNames).toContain('add_operator_absence');

      const absenceAction = result.actions.find((a) => a.tool === 'add_operator_absence');
      expect(absenceAction?.args.fromDate).toMatch(/^\d{4}-04-13$/);
      expect(absenceAction?.args.toDate).toMatch(/^\d{4}-04-15$/);
      // The model must have resolved Frédéric to a real UUID, not passed
      // the prénom directly — that's the whole point of resolve_operator.
      expect(absenceAction?.args.operatorId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    },
    60_000,
  );

  it(
    'plans a job deadline shift from a French prompt',
    async () => {
      const result = await runExecuteLoop({
        prompt: 'Décale la deadline du dossier 35202 de 4 jours',
        conversation: [],
        jwt: 'fake-jwt',
        config,
        dryRun: true,
        php: makeFakePhp(),
      });

      expect(result.kind).toBe('plan');
      if (result.kind !== 'plan') return;

      const tools = result.actions.map((a) => a.tool);
      expect(tools).toContain('update_job_deadline');
      const action = result.actions.find((a) => a.tool === 'update_job_deadline');
      expect(action?.args.shiftDays).toBe(4);
      expect(action?.args.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    },
    60_000,
  );
});

describe('LLM integration (skip notice)', () => {
  it('reports whether ANTHROPIC_API_KEY was provided', () => {
    if (!apiKeyAvailable) {
      // eslint-disable-next-line no-console
      console.log('[llm-integration] SKIPPED — ANTHROPIC_API_KEY not set in env');
    }
    expect(typeof apiKeyAvailable).toBe('boolean');
  });
});

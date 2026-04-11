/**
 * Live integration test against Ollama.
 *
 * This test does NOT use mocks for the LLM — that's the whole point. It
 * exercises the full execute loop end-to-end against a real Ollama with
 * the configured Gemma model. The PHP API client is faked because the
 * goal here is to validate the LLM-driven planning, not the database.
 *
 * Skipped automatically when:
 *   - OLLAMA_BASE_URL is unreachable, or
 *   - the configured model isn't pulled.
 *
 * To run:
 *   ollama serve &
 *   ollama pull gemma3:12b
 *   npm test -- llm-integration
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { runExecuteLoop } from '../src/llm/loop.js';
import type { PhpClient } from '../src/phpClient.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig();

let ollamaAvailable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${config.ollamaBaseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    const want = config.llmModel.split(':')[0];
    ollamaAvailable = !!data.models?.some((m) => m.name?.startsWith(want ?? ''));
  } catch {
    ollamaAvailable = false;
  }
});

/**
 * Fake PhpClient that pretends Frédéric and the MBO XL exist. The LLM
 * will call resolve_operator / resolve_station — we return the canonical
 * shapes so it can pick an ID and proceed to propose_plan.
 */
function makeFakePhp(): PhpClient {
  const fake = {
    async get<T>(path: string): Promise<T> {
      if (path === '/api/v1/operators') {
        return [
          { id: 'op-fred', firstName: 'Frédéric', lastName: 'Dupont', role: 'Conducteur' },
          { id: 'op-lud', firstName: 'Ludovic', lastName: 'Martin', role: 'Conducteur' },
        ] as T;
      }
      if (path === '/api/v1/stations') {
        return [
          { id: 'st-mbo-xl', name: 'MBO XL', abbreviation: 'MBOXL' },
          { id: 'st-press', name: 'Press', abbreviation: 'P' },
        ] as T;
      }
      if (path === '/api/v1/jobs/search-by-references?refs=35202') {
        return [{ id: 'job-35202', reference: '35202', batDeadline: '2026-04-15T17:00:00' }] as T;
      }
      if (path === '/api/v1/jobs/job-35202') {
        return { id: 'job-35202', reference: '35202', batDeadline: '2026-04-15T17:00:00' } as T;
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

describe.skipIf(!ollamaAvailable)('LLM integration (live Ollama)', () => {
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
    },
    60_000,
  );
});

describe('LLM integration (skip notice)', () => {
  it('reports whether Ollama was reachable', () => {
    if (!ollamaAvailable) {
      // eslint-disable-next-line no-console
      console.log(
        `[llm-integration] SKIPPED — no Ollama at ${config.ollamaBaseUrl} or model ${config.llmModel} not pulled`,
      );
    }
    expect(typeof ollamaAvailable).toBe('boolean');
  });
});


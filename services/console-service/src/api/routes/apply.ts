/**
 * POST /console/apply
 *
 * Executes a plan that was previously proposed by /console/execute.
 * The frontend sends the actions array from the proposed plan; the
 * server replays each action in WET mode (actually calling the PHP API)
 * and returns the per-action result.
 *
 * After the apply, the audit log entry is written via the PHP API.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { applyPlan } from '../../llm/apply.js';
import { extractScenario, requireJwt } from '../auth.js';

const actionSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.unknown()),
});

const applyRequestSchema = z.object({
  rawPrompt: z.string().min(1),
  narration: z.string().default(''),
  actions: z.array(actionSchema).min(1),
});

export async function registerApplyRoute(app: FastifyInstance, config: Config): Promise<void> {
  app.post('/console/apply', async (request, reply) => {
    const jwt = requireJwt(request, reply);
    if (!jwt) return;

    const parsed = applyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Invalid apply request body',
        issues: parsed.error.issues,
      });
    }

    try {
      const result = await applyPlan({
        rawPrompt: parsed.data.rawPrompt,
        narration: parsed.data.narration,
        actions: parsed.data.actions,
        jwt,
        scenarioId: extractScenario(request),
        config,
      });
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'apply failed');
      return reply.status(500).send({
        kind: 'error',
        error: 'APPLY_FAILED',
        message,
      });
    }
  });
}

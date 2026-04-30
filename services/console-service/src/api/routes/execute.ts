/**
 * POST /console/execute
 *
 * Receives a natural language prompt + optional conversation history.
 * Runs a multi-turn LLM loop with function calling against the tool
 * registry in DRY-RUN mode and returns either:
 *   - a "plan" (Gemma called propose_plan)
 *   - a "question" (Gemma called ask_user)
 *   - an "error" (max turns / timeout / LLM failure)
 *
 * The frontend then either calls /console/apply to commit the plan,
 * or sends another /execute with the answer to the question.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { runExecuteLoop } from '../../llm/loop.js';
import { extractScenario, requireJwt } from '../auth.js';

// The conversation is opaque to us — it's whatever the previous /execute
// returned in conversationAfter. We just round-trip it back to Anthropic.
// Validate only the outer shape so a malformed FE can't crash us.
const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.unknown(),
});

const executeRequestSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  conversation: z.array(messageSchema).default([]),
});

export async function registerExecuteRoute(app: FastifyInstance, config: Config): Promise<void> {
  app.post('/console/execute', async (request, reply) => {
    const jwt = requireJwt(request, reply);
    if (!jwt) return;

    const parsed = executeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Invalid execute request body',
        issues: parsed.error.issues,
      });
    }

    try {
      // Cast: the conversation came from a previous /execute response and
      // is opaque to us. We trust its shape was valid when we sent it.
      const result = await runExecuteLoop({
        prompt: parsed.data.prompt,
        conversation: parsed.data.conversation as Parameters<typeof runExecuteLoop>[0]['conversation'],
        jwt,
        scenarioId: extractScenario(request),
        config,
        dryRun: true,
      });
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'execute loop failed');
      return reply.status(500).send({
        kind: 'error',
        error: 'EXECUTE_FAILED',
        message,
      });
    }
  });
}

/**
 * GET /console/history?limit=N
 *
 * Thin pass-through to the PHP API's GET /api/v1/console/audit endpoint.
 * The PHP API enforces that the user can only see their own history.
 */
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config.js';
import { PhpClient } from '../../phpClient.js';
import { requireJwt } from '../auth.js';

export async function registerHistoryRoute(app: FastifyInstance, config: Config): Promise<void> {
  app.get<{ Querystring: { limit?: string } }>('/console/history', async (request, reply) => {
    const jwt = requireJwt(request, reply);
    if (!jwt) return;

    const limit = parseInt(request.query.limit ?? '20', 10);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(1, limit), 100) : 20;

    const php = new PhpClient(config.phpApiUrl, jwt);
    try {
      const entries = await php.get<unknown[]>(`/api/v1/console/audit?limit=${safeLimit}`);
      return reply.send({ entries });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'history fetch failed');
      return reply.status(500).send({
        error: 'HISTORY_FAILED',
        message,
      });
    }
  });
}

/**
 * Fastify HTTP server for the console-service.
 *
 * Routes:
 *   GET  /health             — health check (no auth)
 *   POST /console/execute    — natural language → proposed plan (dry-run)
 *   POST /console/apply      — execute a previously proposed plan (wet)
 *   GET  /console/history    — fetch the user's recent audit log entries
 *   POST /mcp                — streamable HTTP MCP transport for MCP clients
 *
 * All /console/* and /mcp routes require an Authorization: Bearer <jwt>
 * header. The JWT is forwarded to the PHP API verbatim — auth and
 * permission enforcement happen there.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Config } from '../config.js';
import { registerExecuteRoute } from './routes/execute.js';
import { registerApplyRoute } from './routes/apply.js';
import { registerHistoryRoute } from './routes/history.js';
import { registerMcpHttpRoute } from '../mcp/http.js';

export async function startHttpServer(config: Config): Promise<void> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'console-service',
    version: '0.1.0',
    config: {
      llmModel: config.llmModel,
      anthropicConfigured: config.anthropicApiKey.length > 0,
      phpApiUrl: config.phpApiUrl,
    },
  }));

  await registerExecuteRoute(app, config);
  await registerApplyRoute(app, config);
  await registerHistoryRoute(app, config);
  await registerMcpHttpRoute(app, config);

  const address = await app.listen({
    port: config.httpPort,
    host: '0.0.0.0',
  });

  app.log.info(`console-service listening on ${address}`);
}

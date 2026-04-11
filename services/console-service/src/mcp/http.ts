/**
 * MCP streamable-HTTP transport, mounted on the Fastify HTTP server at /mcp.
 *
 * Each POST /mcp request is handled by a fresh StreamableHTTPServerTransport
 * instance bound to a fresh McpServer that captures the request's JWT.
 * This is the simplest stateless model and works for our use case (each
 * client tool call is independent of the others).
 *
 * For external HTTP-based MCP clients, the wire protocol is the streamable-
 * HTTP variant defined by the MCP spec. Clients negotiate via SSE.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Config } from '../config.js';
import { createMcpServer } from './server.js';
import { extractJwt } from '../api/auth.js';

export async function registerMcpHttpRoute(app: FastifyInstance, config: Config): Promise<void> {
  app.all('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
    const jwt = extractJwt(request);
    if (!jwt) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'MCP HTTP requires Authorization: Bearer <jwt>',
      });
    }

    // Create a fresh server bound to this request's JWT.
    const server = createMcpServer({
      phpApiUrl: config.phpApiUrl,
      getJwt: () => jwt,
    });

    // Stateless mode: no session ID generator means each request is
    // self-contained.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Connect the server to the transport before handling the request
    await server.connect(transport);

    try {
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (err) {
      app.log.error({ err }, 'MCP HTTP request failed');
      if (!reply.sent) {
        reply.status(500).send({
          error: 'MCP_REQUEST_FAILED',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      // The streamable HTTP transport closes itself when the request ends,
      // but we explicitly tell Fastify the response is owned by us.
    }
  });
}

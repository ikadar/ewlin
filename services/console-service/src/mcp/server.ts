/**
 * MCP server factory.
 *
 * Builds a fresh McpServer instance with all the non-internal tools from
 * the registry. Used by both the stdio and HTTP transports.
 *
 * Each tool's handler runs in WET mode (the MCP server is meant for
 * external automation, not the propose-then-confirm flow). External
 * clients are expected to know what they want.
 *
 * Authentication: the MCP server itself doesn't validate JWTs. The HTTP
 * transport extracts the JWT from the request's Authorization header and
 * forwards it to the PHP API via the per-request PhpClient. The stdio
 * transport reads the JWT from the MCP_JWT environment variable (or a
 * file path in MCP_JWT_FILE) at startup time.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodTypeAny, ZodRawShape, ZodObject } from 'zod';
import { mcpExposedTools } from '../tools/registry.js';
import { PhpClient } from '../phpClient.js';
import { todayIsoUtc } from '../tools/dates.js';
import type { ToolContext } from '../tools/types.js';

export interface McpServerOptions {
  phpApiUrl: string;
  /** Function that returns the JWT for the current request — varies per transport. */
  getJwt: () => string | null;
}

export function createMcpServer(opts: McpServerOptions): McpServer {
  const server = new McpServer(
    {
      name: 'flux-scheduler',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  for (const tool of mcpExposedTools()) {
    // Extract the raw shape from the top-level z.object schema. Tools are
    // authored with z.object({...}); the MCP SDK wants a raw shape (object
    // of zod schemas) for inputSchema.
    const inputObject = tool.inputSchema as unknown as ZodObject<ZodRawShape>;
    const shape = inputObject.shape as ZodRawShape;

    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: shape as Record<string, ZodTypeAny>,
      },
      async (args: Record<string, unknown>) => {
        const jwt = opts.getJwt();
        if (!jwt) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  ok: false,
                  error:
                    'No JWT available — set MCP_JWT environment variable for stdio mode, or send Authorization header for HTTP mode.',
                }),
              },
            ],
            isError: true,
          };
        }
        const ctx: ToolContext = {
          php: new PhpClient(opts.phpApiUrl, jwt),
          dryRun: false,
          todayIso: todayIsoUtc(),
        };
        try {
          const result = await tool.handler(args, ctx);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result),
              },
            ],
            isError: !result.ok,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ ok: false, error: message }),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}

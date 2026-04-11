/**
 * MCP stdio transport entry point.
 *
 * Run via `node dist/main.js mcp-stdio`. The process speaks MCP over
 * stdin/stdout per the @modelcontextprotocol/sdk standard, suitable for
 * Claude Code / Claude Desktop to connect via:
 *
 *   claude code mcp add scheduler -- node services/console-service/dist/main.js mcp-stdio
 *
 * Authentication: stdio mode reads the JWT from the MCP_JWT environment
 * variable. Configure it once when registering the MCP server in your
 * client. Production users should put it in a secret manager and inject
 * it via env at launch time.
 */
import fs from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Config } from '../config.js';
import { createMcpServer } from './server.js';

export async function startMcpStdio(config: Config): Promise<void> {
  // Resolve the JWT once at startup. stdio transports are long-lived and
  // can't easily refresh per-request, so the user is expected to provide
  // a token with sufficient TTL (or a refresh mechanism we'll add later).
  const jwt = resolveJwt();
  if (!jwt) {
    console.error(
      'No JWT available for MCP stdio mode. Set MCP_JWT (raw token) or MCP_JWT_FILE (path to a file containing the token).',
    );
    process.exit(2);
  }

  const server = createMcpServer({
    phpApiUrl: config.phpApiUrl,
    getJwt: () => jwt,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The transport keeps the process alive via stdin. Nothing else to do
  // here — the SDK handles the message loop.
}

function resolveJwt(): string | null {
  const direct = process.env['MCP_JWT'];
  if (direct && direct.length > 0) return direct.trim();
  const filePath = process.env['MCP_JWT_FILE'];
  if (filePath && filePath.length > 0) {
    try {
      return fs.readFileSync(filePath, 'utf8').trim();
    } catch (err) {
      console.error(`Failed to read MCP_JWT_FILE=${filePath}:`, err);
      return null;
    }
  }
  return null;
}

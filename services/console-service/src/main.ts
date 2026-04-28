/**
 * Entry point for the console-service.
 *
 * Two run modes selected by argv[2]:
 *   - "http"      → start the Fastify HTTP server (the default)
 *   - "mcp-stdio" → run the MCP server over stdio (for external Claude Code clients)
 *
 * The HTTP mode also exposes a streamable HTTP MCP transport at /mcp,
 * so external HTTP-based MCP clients can connect to the same instance.
 */
import { loadConfig } from './config.js';
import { startHttpServer } from './api/server.js';
import { startMcpStdio } from './mcp/stdio.js';

const mode = process.argv[2] ?? 'http';
const config = loadConfig();

if (config.llmProvider === 'anthropic' && !config.anthropicApiKey) {
  console.error('LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty.');
  process.exit(1);
}
if (config.llmProvider === 'groq' && !config.groqApiKey) {
  console.error('LLM_PROVIDER=groq but GROQ_API_KEY is empty.');
  process.exit(1);
}

async function main(): Promise<void> {
  switch (mode) {
    case 'http':
      await startHttpServer(config);
      break;
    case 'mcp-stdio':
      await startMcpStdio(config);
      break;
    default:
      console.error(`Unknown mode: ${mode}. Expected 'http' or 'mcp-stdio'.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in console-service:', err);
  process.exit(1);
});

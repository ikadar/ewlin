/**
 * Centralized configuration loaded from environment variables.
 *
 * Two LLM providers supported:
 *   - 'anthropic' (default) — Claude Messages API. Reliable tool use,
 *     French quality, prompt caching available.
 *   - 'groq' — OpenAI-compatible endpoint with GPT OSS 20B by default.
 *     Cheaper, much faster (LPU), reasoning model with tool_calls.
 *
 * Switch is `LLM_PROVIDER`. When 'groq', `GROQ_API_KEY` is required and
 * `GROQ_MODEL` overrides the default model id. The Anthropic vars stay
 * available so we can flip back without rebuilding.
 *
 * The HTTP_PORT default is 3004 to avoid colliding with the existing
 * services (php-fpm 9000, scheduling-engine 3003, mariadb 3306, mercure 3000).
 */
export type LlmProvider = 'anthropic' | 'groq';

export interface Config {
  httpPort: number;
  phpApiUrl: string;
  llmProvider: LlmProvider;
  anthropicApiKey: string;
  anthropicBaseUrl: string;
  groqApiKey: string;
  groqBaseUrl: string;
  groqModel: string;
  llmModel: string;
  llmTemperature: number;
  llmMaxTurns: number;
  llmTotalTimeoutMs: number;
  /**
   * Output budget per LLM turn. GPT OSS is a reasoning model whose
   * `reasoning_tokens` count toward this limit, so a value tuned for
   * Anthropic (~512) is too tight on Groq. Default scales by provider.
   */
  llmMaxTokensPerTurn: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

function envOr(name: string, fallback: string): string {
  const v = process.env[name];
  return v !== undefined && v.length > 0 ? v : fallback;
}

function envIntOr(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envFloatOr(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function envProvider(): LlmProvider {
  const raw = (process.env['LLM_PROVIDER'] ?? 'anthropic').toLowerCase();
  return raw === 'groq' ? 'groq' : 'anthropic';
}

export function loadConfig(): Config {
  const provider = envProvider();
  // Reasoning models (Groq GPT OSS) need a wider per-turn budget because
  // their `reasoning_tokens` are billed against max_tokens. 2048 is a
  // safe default for tool-chain turns; raise via LLM_MAX_TOKENS_PER_TURN.
  const defaultMaxTokens = provider === 'groq' ? 2048 : 512;
  return {
    httpPort: envIntOr('HTTP_PORT', 3004),
    phpApiUrl: envOr('PHP_API_URL', 'http://localhost:8080'),
    llmProvider: provider,
    anthropicApiKey: envOr('ANTHROPIC_API_KEY', ''),
    anthropicBaseUrl: envOr('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
    groqApiKey: envOr('GROQ_API_KEY', ''),
    groqBaseUrl: envOr('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
    groqModel: envOr('GROQ_MODEL', 'openai/gpt-oss-20b'),
    llmModel: envOr('LLM_MODEL', 'claude-haiku-4-5-20251001'),
    llmTemperature: envFloatOr('LLM_TEMPERATURE', 0),
    llmMaxTurns: envIntOr('LLM_MAX_TURNS', 8),
    llmTotalTimeoutMs: envIntOr('LLM_TOTAL_TIMEOUT_MS', 60000),
    llmMaxTokensPerTurn: envIntOr('LLM_MAX_TOKENS_PER_TURN', defaultMaxTokens),
    logLevel: (envOr('LOG_LEVEL', 'info') as Config['logLevel']),
  };
}

/**
 * Centralized configuration loaded from environment variables.
 *
 * Two LLM provider families supported:
 *   - 'anthropic' (default) — Claude Messages API. Reliable tool use,
 *     French quality, prompt caching available.
 *   - 'openai-compat' — any OpenAI-compatible endpoint (Groq, OpenRouter,
 *     Together, Fireworks, Cerebras, …). Selected via the OPENAI_COMPAT_*
 *     env vars; switch the underlying host by changing OPENAI_COMPAT_BASE_URL
 *     and OPENAI_COMPAT_MODEL without touching code.
 *
 * Switch is `LLM_PROVIDER`. When 'openai-compat', `OPENAI_COMPAT_API_KEY`
 * is required. The Anthropic vars stay available so we can flip back
 * without rebuilding.
 *
 * The HTTP_PORT default is 3004 to avoid colliding with the existing
 * services (php-fpm 9000, scheduling-engine 3003, mariadb 3306, mercure 3000).
 */
export type LlmProvider = 'anthropic' | 'openai-compat';

export interface Config {
  httpPort: number;
  phpApiUrl: string;
  llmProvider: LlmProvider;
  anthropicApiKey: string;
  anthropicBaseUrl: string;
  openaiCompatApiKey: string;
  openaiCompatBaseUrl: string;
  openaiCompatModel: string;
  /**
   * OpenRouter-only: when true and the base URL points to OpenRouter,
   * the model id is suffixed with `:nitro` at request time, sorting
   * providers by throughput (highest tokens/sec first). Equivalent to
   * setting `provider.sort = "throughput"` in the request body.
   * No-op when targeting other openai-compat hosts.
   */
  openaiCompatNitro: boolean;
  llmModel: string;
  llmTemperature: number;
  llmMaxTurns: number;
  llmTotalTimeoutMs: number;
  /**
   * Output budget per LLM turn. Reasoning models (e.g. GPT OSS via
   * OpenRouter) emit `reasoning_tokens` that count toward this limit,
   * so a value tuned for Anthropic (~512) is too tight there. Default
   * scales by provider; override with LLM_MAX_TOKENS_PER_TURN.
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

function envBoolOr(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

function envProvider(): LlmProvider {
  const raw = (process.env['LLM_PROVIDER'] ?? 'anthropic').toLowerCase();
  // Accept legacy 'groq' alias for the openai-compat family.
  if (raw === 'openai-compat' || raw === 'groq') return 'openai-compat';
  return 'anthropic';
}

export function loadConfig(): Config {
  const provider = envProvider();
  // Reasoning models (GPT OSS, o1-style) emit reasoning_tokens billed
  // against max_tokens, so the per-turn budget must be larger than for
  // Anthropic. 2048 is safe for tool-chain turns; raise via env.
  const defaultMaxTokens = provider === 'openai-compat' ? 2048 : 512;
  return {
    httpPort: envIntOr('HTTP_PORT', 3004),
    phpApiUrl: envOr('PHP_API_URL', 'http://localhost:8080'),
    llmProvider: provider,
    anthropicApiKey: envOr('ANTHROPIC_API_KEY', ''),
    anthropicBaseUrl: envOr('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
    openaiCompatApiKey: envOr('OPENAI_COMPAT_API_KEY', ''),
    openaiCompatBaseUrl: envOr('OPENAI_COMPAT_BASE_URL', 'https://api.groq.com/openai/v1'),
    openaiCompatModel: envOr('OPENAI_COMPAT_MODEL', 'openai/gpt-oss-20b'),
    openaiCompatNitro: envBoolOr('OPENAI_COMPAT_NITRO', false),
    llmModel: envOr('LLM_MODEL', 'claude-haiku-4-5-20251001'),
    llmTemperature: envFloatOr('LLM_TEMPERATURE', 0),
    // 12 not 8: smaller openai-compat models (gpt-oss-20b, llama-3) burn
    // a few "(none)" empty turns even after the IMPÉRATIVEMENT prompt
    // nudge, plus the propose_plan args-validation gate adds 1-2 corrective
    // round-trips before terminating. 8 turns hit MAX_TURNS_REACHED on
    // benign cancel/move requests with those models. Override via env.
    llmMaxTurns: envIntOr('LLM_MAX_TURNS', 12),
    llmTotalTimeoutMs: envIntOr('LLM_TOTAL_TIMEOUT_MS', 60000),
    llmMaxTokensPerTurn: envIntOr('LLM_MAX_TOKENS_PER_TURN', defaultMaxTokens),
    logLevel: (envOr('LOG_LEVEL', 'info') as Config['logLevel']),
  };
}

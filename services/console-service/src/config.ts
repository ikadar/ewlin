/**
 * Centralized configuration loaded from environment variables.
 *
 * Defaults are tuned for local development:
 *   - PHP API on http://nginx inside docker, http://localhost:8080 outside
 *   - Anthropic API at the official endpoint (https://api.anthropic.com)
 *   - claude-haiku-4-5 as the default model (fast + cheap + tool-use friendly)
 *
 * The HTTP_PORT default is 3004 to avoid colliding with the existing
 * services (php-fpm 9000, scheduling-engine 3003, mariadb 3306, mercure 3000).
 *
 * NOTE: ANTHROPIC_API_KEY is REQUIRED. The /execute and /apply routes
 * will return 500 if it's missing — set it in .env (or compose env).
 */
export interface Config {
  httpPort: number;
  phpApiUrl: string;
  anthropicApiKey: string;
  anthropicBaseUrl: string;
  llmModel: string;
  llmTemperature: number;
  llmMaxTurns: number;
  llmTotalTimeoutMs: number;
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

export function loadConfig(): Config {
  return {
    httpPort: envIntOr('HTTP_PORT', 3004),
    phpApiUrl: envOr('PHP_API_URL', 'http://localhost:8080'),
    anthropicApiKey: envOr('ANTHROPIC_API_KEY', ''),
    anthropicBaseUrl: envOr('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
    llmModel: envOr('LLM_MODEL', 'claude-haiku-4-5-20251001'),
    llmTemperature: envFloatOr('LLM_TEMPERATURE', 0),
    llmMaxTurns: envIntOr('LLM_MAX_TURNS', 8),
    llmTotalTimeoutMs: envIntOr('LLM_TOTAL_TIMEOUT_MS', 60000),
    logLevel: (envOr('LOG_LEVEL', 'info') as Config['logLevel']),
  };
}

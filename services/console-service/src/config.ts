/**
 * Centralized configuration loaded from environment variables.
 *
 * Defaults are tuned for local development:
 *   - PHP API on http://php:9000 inside docker, http://localhost:8080 outside
 *   - Ollama on http://host.docker.internal:11434 inside docker, http://localhost:11434 outside
 *   - Gemma 3 12b as the default model (Gemma 4 will be auto-picked when set via LLM_MODEL)
 *
 * The HTTP_PORT default is 3004 to avoid colliding with the existing
 * services (php-fpm 9000, scheduling-engine 3003, mariadb 3306, mercure 3000).
 */
export interface Config {
  httpPort: number;
  phpApiUrl: string;
  ollamaBaseUrl: string;
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
    ollamaBaseUrl: envOr('OLLAMA_BASE_URL', 'http://localhost:11434'),
    llmModel: envOr('LLM_MODEL', 'gemma3:12b'),
    llmTemperature: envFloatOr('LLM_TEMPERATURE', 0.1),
    llmMaxTurns: envIntOr('LLM_MAX_TURNS', 8),
    llmTotalTimeoutMs: envIntOr('LLM_TOTAL_TIMEOUT_MS', 30000),
    logLevel: (envOr('LOG_LEVEL', 'info') as Config['logLevel']),
  };
}

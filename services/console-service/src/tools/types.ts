/**
 * Tool registry contracts.
 *
 * A Tool is a single capability that the LLM can call. It has:
 * - a unique name (snake_case)
 * - a human-readable description (used in the system prompt + MCP listing)
 * - a zod schema for input validation (also serialized to JSON Schema for
 *   the LLM function calling protocol)
 * - a handler function that does the work
 *
 * Tools support a `dryRun` flag. In dry-run mode the handler must NOT
 * mutate state — it returns a JSON description of what it would do.
 * In wet mode it actually calls the PHP API. The dual mode is what
 * powers the propose-then-confirm flow.
 *
 * Tool errors are returned as { ok: false, error } so the LLM can read
 * them and reformulate. Throwing exceptions also works (the loop catches
 * and converts).
 */
import type { ZodTypeAny, z } from 'zod';
import type { PhpClient } from '../phpClient.js';

export interface ToolContext {
  php: PhpClient;
  dryRun: boolean;
  /** Today as YYYY-MM-DD in the system timezone, injected for date arithmetic. */
  todayIso: string;
}

export interface ToolHandlerResult {
  ok: true;
  /** Free-form result the LLM (or the apply pipeline) can read. */
  data: unknown;
  /** Optional human-readable preview line for the propose UI. */
  preview?: string;
}

export interface ToolHandlerError {
  ok: false;
  error: string;
}

export type ToolResult = ToolHandlerResult | ToolHandlerError;

export interface ToolDefinition<TSchema extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  /** zod schema for input validation. */
  inputSchema: TSchema;
  /** Handler — receives validated input + context. */
  handler: (input: z.infer<TSchema>, ctx: ToolContext) => Promise<ToolResult>;
  /** True if this tool is read-only (skips the dry/wet distinction). */
  readOnly?: boolean;
  /** Internal tools are not exposed via the MCP server (only available to the LLM loop). */
  internal?: boolean;
}

/**
 * Convert a zod schema to a JSON Schema object suitable for LLM function
 * calling. We use zod's built-in describe + a minimal walker rather than
 * pulling in a full JSON Schema converter — Ollama / OpenAI-compatible
 * APIs accept JSON Schema, and the subset we need is small.
 *
 * Real implementation in tools/jsonSchema.ts (Phase 3).
 */

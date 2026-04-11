/**
 * Apply a plan in WET mode.
 *
 * Each action in the plan is dispatched to its tool handler with
 * dryRun=false. Per-action results are collected. The full apply is
 * sent to the audit log endpoint, regardless of success/failure, so
 * the user can review and undo later.
 *
 * Apply policy: stop at the first failure (don't half-execute the rest).
 * The frontend can re-prompt the user to fix the issue and retry.
 */
import type { Config } from '../config.js';
import { PhpClient, PhpClientError } from '../phpClient.js';
import { findTool } from '../tools/registry.js';
import { todayIsoUtc } from '../tools/dates.js';
import type { ToolContext, ToolResult } from '../tools/types.js';

export interface ApplyAction {
  tool: string;
  args: Record<string, unknown>;
}

export interface ApplyActionResult {
  tool: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface ApplyResult {
  /** True iff every action returned ok. The frontend reads this directly. */
  success: boolean;
  results: ApplyActionResult[];
  /** Null if the audit endpoint was unreachable — apply still succeeded. */
  auditId: string | null;
}

export interface ApplyPlanArgs {
  rawPrompt: string;
  narration: string;
  actions: ApplyAction[];
  jwt: string;
  config: Config;
}

export async function applyPlan(args: ApplyPlanArgs): Promise<ApplyResult> {
  const todayIso = todayIsoUtc();
  const php = new PhpClient(args.config.phpApiUrl, args.jwt);
  const ctx: ToolContext = { php, dryRun: false, todayIso };

  const results: ApplyActionResult[] = [];
  let allOk = true;

  for (const action of args.actions) {
    const def = findTool(action.tool);
    if (!def) {
      results.push({ tool: action.tool, ok: false, error: `Unknown tool: ${action.tool}` });
      allOk = false;
      break; // stop at first failure
    }
    const validation = def.inputSchema.safeParse(action.args);
    if (!validation.success) {
      results.push({
        tool: action.tool,
        ok: false,
        error: `Validation failed: ${validation.error.message}`,
      });
      allOk = false;
      break;
    }
    let result: ToolResult;
    try {
      result = await def.handler(validation.data, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ tool: action.tool, ok: false, error: message });
      allOk = false;
      break;
    }
    if (!result.ok) {
      results.push({ tool: action.tool, ok: false, error: result.error });
      allOk = false;
      break;
    }
    results.push({ tool: action.tool, ok: true, result: result.data });
  }

  // Best-effort audit logging — never block the apply on audit failure
  let auditId: string | null = null;
  try {
    const audit = await php.post<{ id: string }>('/api/v1/console/audit', {
      rawPrompt: args.rawPrompt,
      narration: args.narration,
      proposedActions: args.actions,
      appliedResults: results,
      success: allOk,
    });
    auditId = audit.id;
  } catch (err) {
    // Don't propagate: a missing audit endpoint must not break apply.
    if (!(err instanceof PhpClientError && err.status === 404)) {
      console.warn('audit log failed:', err instanceof Error ? err.message : String(err));
    }
  }

  return {
    success: allOk,
    results,
    auditId,
  };
}

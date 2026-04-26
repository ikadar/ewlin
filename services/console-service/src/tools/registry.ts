/**
 * Central tool registry.
 *
 * All tools live in dedicated files (resolve.ts, constraints.ts, jobs.ts,
 * tasks.ts, system.ts) and are aggregated here. The registry is the
 * single source of truth shared by:
 *   - the internal LLM execute loop (Phase 3)
 *   - the MCP server (Phase 4) — both stdio and HTTP transports
 *
 * Adding a new tool: write the implementation in a domain file, export
 * a `ToolDefinition`, and append it to `allTools` below.
 */
import type { ToolDefinition } from './types.js';
import {
  resolveOperatorTool,
  resolveStationTool,
  resolveJobTool,
  resolveTaskInJobTool,
} from './resolve.js';
import {
  addOperatorAbsenceTool,
  addStationMaintenanceTool,
  cancelConstraintTool,
  listActiveConstraintsTool,
} from './constraints.js';
import { updateJobDeadlineTool } from './jobs.js';
import {
  addOperatorOvertimeTool,
  updateTaskDurationTool,
  replaceTaskStationTool,
  pinTaskAtTimeTool,
  unpinTaskTool,
  extendRunningTaskTool,
  listRunningTasksTool,
  checkStationOperatorAvailabilityTool,
} from './tasks.js';
import { proposePlanTool, askUserTool } from './system.js';

/**
 * Catalog of all tools available to the LLM.
 *
 * Order matters slightly: read-only resolvers come first because they're
 * the most common starting moves for the LLM, and a top-of-list position
 * gives them prominence in the system prompt's tool listing.
 */
export const allTools: readonly ToolDefinition[] = [
  // Resolvers (read-only)
  resolveOperatorTool,
  resolveStationTool,
  resolveJobTool,
  resolveTaskInJobTool,
  // Constraints
  addOperatorAbsenceTool,
  addStationMaintenanceTool,
  cancelConstraintTool,
  listActiveConstraintsTool,
  // Jobs
  updateJobDeadlineTool,
  // Tasks
  listRunningTasksTool,
  addOperatorOvertimeTool,
  updateTaskDurationTool,
  extendRunningTaskTool,
  replaceTaskStationTool,
  checkStationOperatorAvailabilityTool,
  pinTaskAtTimeTool,
  unpinTaskTool,
  // System (internal — not exposed via MCP)
  proposePlanTool,
  askUserTool,
];

export function findTool(name: string): ToolDefinition | undefined {
  return allTools.find((t) => t.name === name);
}

/** Tools that should be exposed via the MCP server (excludes internal). */
export function mcpExposedTools(): readonly ToolDefinition[] {
  return allTools.filter((t) => !t.internal);
}

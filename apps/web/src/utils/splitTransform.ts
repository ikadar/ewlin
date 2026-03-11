/**
 * Split Transform — View-Layer Tile Splitting
 *
 * Expands split assignments into virtual tiles for rendering.
 * Split state is session-local (not persisted across reload).
 * Each split part gets a full re-setup time.
 * Each part has an independent scheduledStart — parts can be placed at different times.
 */

import type { TaskAssignment, Task, Station, InternalTask } from '@flux/types';
import { isInternalTask } from '@flux/types';
import { addWorkingTime } from './workingTime';

export interface SplitPart {
  runMinutes: number;
  scheduledStart: string; // ISO timestamp — each part independently positionable
}

export interface SplitConfig {
  assignmentId: string;
  taskId: string;
  setupMinutes: number;   // cached from original task at split time
  parts: SplitPart[];     // each part has its own scheduledStart
  splitGroupId: string;
}

export interface VirtualAssignment extends TaskAssignment {
  /** Original real assignment ID (for API calls) */
  realAssignmentId: string;
  /** Split part index (undefined if not split) */
  splitPartIndex?: number;
  /** Total parts in split group */
  splitPartTotal?: number;
  /** Split group identifier */
  splitGroupId?: string;
}

/**
 * Expand split assignments into virtual tiles for rendering.
 * Non-split assignments pass through with realAssignmentId = id.
 * Split assignments expand into N virtual assignments with independent positions.
 */
export function expandSplitAssignments(
  assignments: TaskAssignment[],
  tasks: Task[],
  stations: Station[],
  splitConfigs: Map<string, SplitConfig>
): { virtualAssignments: VirtualAssignment[]; virtualTasks: Task[] } {
  const virtualAssignments: VirtualAssignment[] = [];
  const extraTasks: Task[] = [];

  for (const assignment of assignments) {
    const config = splitConfigs.get(assignment.id);
    if (!config) {
      virtualAssignments.push({ ...assignment, realAssignmentId: assignment.id });
      continue;
    }

    const task = tasks.find(t => t.id === config.taskId);
    if (!task || !isInternalTask(task)) {
      virtualAssignments.push({ ...assignment, realAssignmentId: assignment.id });
      continue;
    }

    const station = stations.find(s => s.id === assignment.targetId);

    for (let i = 0; i < config.parts.length; i++) {
      const part = config.parts[i];
      const partStart = new Date(part.scheduledStart);
      const totalMs = (config.setupMinutes + part.runMinutes) * 60 * 1000;
      const endTime = station
        ? addWorkingTime(partStart, totalMs, station)
        : new Date(partStart.getTime() + totalMs);

      const virtualId = `${assignment.id}:split:${i}`;
      const virtualTaskId = `${task.id}:split:${i}`;

      virtualAssignments.push({
        ...assignment,
        id: virtualId,
        taskId: virtualTaskId,
        scheduledStart: partStart.toISOString(),
        scheduledEnd: endTime.toISOString(),
        realAssignmentId: assignment.id,
        splitPartIndex: i,
        splitPartTotal: config.parts.length,
        splitGroupId: config.splitGroupId,
      });

      extraTasks.push({
        ...task,
        id: virtualTaskId,
        duration: { setupMinutes: config.setupMinutes, runMinutes: part.runMinutes },
      });
    }
  }

  return {
    virtualAssignments,
    virtualTasks: extraTasks.length > 0 ? [...tasks, ...extraTasks] : tasks,
  };
}

/**
 * Add a new split configuration.
 * Caller provides fully-built parts with per-part scheduledStart.
 */
export function addSplit(
  configs: Map<string, SplitConfig>,
  assignmentId: string,
  taskId: string,
  setupMinutes: number,
  parts: SplitPart[]
): Map<string, SplitConfig> {
  const newConfigs = new Map(configs);
  newConfigs.set(assignmentId, {
    assignmentId,
    taskId,
    setupMinutes,
    parts,
    splitGroupId: crypto.randomUUID(),
  });
  return newConfigs;
}

/**
 * Remove a split configuration (merge back to original).
 */
export function removeSplit(
  configs: Map<string, SplitConfig>,
  assignmentId: string
): Map<string, SplitConfig> {
  const newConfigs = new Map(configs);
  newConfigs.delete(assignmentId);
  return newConfigs;
}

/**
 * Re-split an already-split part into two sub-parts.
 * E.g., parts=[{run:120,start:T1},{run:120,start:T2}], reSplit(index=1, at=60, newSubPartStart=T3)
 * → parts=[{run:120,start:T1},{run:60,start:T2},{run:60,start:T3}]
 */
export function reSplit(
  configs: Map<string, SplitConfig>,
  assignmentId: string,
  virtualIndex: number,
  splitAtRunMinutes: number,
  newSubPartStart: string
): Map<string, SplitConfig> {
  const existing = configs.get(assignmentId);
  if (!existing || virtualIndex < 0 || virtualIndex >= existing.parts.length) return configs;

  const originalPart = existing.parts[virtualIndex];
  if (splitAtRunMinutes <= 0 || splitAtRunMinutes >= originalPart.runMinutes) return configs;

  const newParts = [...existing.parts];
  newParts.splice(virtualIndex, 1,
    { runMinutes: splitAtRunMinutes, scheduledStart: originalPart.scheduledStart },
    { runMinutes: originalPart.runMinutes - splitAtRunMinutes, scheduledStart: newSubPartStart }
  );

  const newConfigs = new Map(configs);
  newConfigs.set(assignmentId, { ...existing, parts: newParts });
  return newConfigs;
}

/**
 * Move a single split part to a new scheduled start time.
 */
export function moveSplitPart(
  configs: Map<string, SplitConfig>,
  assignmentId: string,
  partIndex: number,
  newScheduledStart: string
): Map<string, SplitConfig> {
  const existing = configs.get(assignmentId);
  if (!existing || partIndex < 0 || partIndex >= existing.parts.length) return configs;

  const newParts = [...existing.parts];
  newParts[partIndex] = { ...newParts[partIndex], scheduledStart: newScheduledStart };

  const newConfigs = new Map(configs);
  newConfigs.set(assignmentId, { ...existing, parts: newParts });
  return newConfigs;
}

/**
 * Get the split part index from a virtual assignment ID.
 * Returns null if the ID is not a virtual split ID.
 */
export function getSplitPartIndex(virtualId: string): number | null {
  const match = virtualId.match(/:split:(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Remove a split configuration (merge back to original).
 */
export function getRealAssignmentId(virtualId: string): string {
  const idx = virtualId.indexOf(':split:');
  return idx >= 0 ? virtualId.substring(0, idx) : virtualId;
}

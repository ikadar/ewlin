/**
 * Safety Zone derivation helpers.
 *
 * Conceptually: a rolling zone from now() in which assignments are
 * frozen by the scheduling engine. The boundary is computed server-side
 * in *working hours* and shipped on the snapshot as
 * `safetyZoneFrozenUntil` (ISO timestamp). The frontend derives per-tile
 * state from this boundary + safetyOverrides + `now()`.
 *
 * See playground-safety-zone.html and the v0.6.x safety-zone release doc.
 */

import type { Job, ScheduleSnapshot, TaskAssignment } from '@flux/types';

/** Compose the key used for override lookups (matches PHP backend). */
export function makeSafetyKey(
  jobId: string,
  sequenceIndex: number,
  stationId: string,
): string {
  return `${jobId}::${sequenceIndex}::${stationId}`;
}

/**
 * Build a (jobId, sequenceIndex, stationId) → true lookup of active
 * overrides. Missing rows = no override.
 */
export function buildOverrideLookup(snapshot: ScheduleSnapshot): Map<string, boolean> {
  const result = new Map<string, boolean>();
  const rows = snapshot.safetyOverrides ?? [];
  for (const o of rows) {
    if (o.isOverridden) {
      result.set(makeSafetyKey(o.jobId, o.sequenceIndex, o.stationId), true);
    }
  }
  return result;
}

/**
 * Compute the flat sequenceIndex for every task in the snapshot. Stable
 * within a given snapshot; reflects the order: element.position asc, then
 * task.sequenceOrder asc. This is the value stored in JobSafetyOverride,
 * so front/back must agree on the derivation.
 */
export function buildSequenceIndexLookup(snapshot: ScheduleSnapshot): Map<string, number> {
  const result = new Map<string, number>();
  const tasksById = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const elementsById = new Map(snapshot.elements.map((e) => [e.id, e]));

  for (const job of snapshot.jobs) {
    const jobElements: typeof snapshot.elements = [];
    for (const elId of job.elementIds ?? []) {
      const el = elementsById.get(elId);
      if (el) jobElements.push(el);
    }

    // Deterministic element order: keep the job's own elementIds order.
    let flatIndex = 0;
    for (const element of jobElements) {
      const elementTasks = (element.taskIds ?? [])
        .map((id) => tasksById.get(id))
        .filter((t): t is NonNullable<typeof t> => t !== undefined);
      elementTasks.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      for (const task of elementTasks) {
        result.set(task.id, flatIndex);
        flatIndex += 1;
      }
    }
  }
  return result;
}

/**
 * Is the assignment inside the safety zone at the given "now"?
 *
 * Boundary is the server-computed `safetyZoneFrozenUntil` (working-hours
 * accumulator from snapshot generation). Returns false when the feature
 * is disabled (boundary nullish) or when the start is in the past.
 */
export function isInSafetyZone(
  scheduledStartIso: string,
  frozenUntilIso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!frozenUntilIso) return false;
  const start = new Date(scheduledStartIso).getTime();
  const nowMs = now.getTime();
  const boundaryMs = new Date(frozenUntilIso).getTime();
  return start >= nowMs && start < boundaryMs;
}

/**
 * Derive the full safety state of an assignment in a single pass.
 */
export function deriveSafetyState(
  assignment: TaskAssignment,
  job: Job,
  sequenceIndex: number,
  stationId: string,
  frozenUntilIso: string | null | undefined,
  overrideLookup: Map<string, boolean>,
  now: Date = new Date(),
): { inSafetyZone: boolean; isFrozenOverridden: boolean } {
  const inZone = isInSafetyZone(assignment.scheduledStart, frozenUntilIso, now);
  if (!inZone) return { inSafetyZone: false, isFrozenOverridden: false };
  const overridden = overrideLookup.get(makeSafetyKey(job.id, sequenceIndex, stationId)) === true;
  return { inSafetyZone: true, isFrozenOverridden: overridden };
}

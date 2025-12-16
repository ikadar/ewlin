/**
 * Tile Swap Utilities
 * Functions for swapping positions of adjacent tiles on the same station.
 */

import type { TaskAssignment } from '@flux/types';

export type SwapDirection = 'up' | 'down';

export interface SwapResult {
  /** Updated assignments array */
  assignments: TaskAssignment[];
  /** Whether the swap was performed */
  swapped: boolean;
  /** ID of the other assignment that was swapped with */
  swappedWithId: string | null;
}

/**
 * Find the adjacent assignment on the same station.
 *
 * @param assignments - All assignments
 * @param assignmentId - The assignment to find adjacent for
 * @param direction - 'up' for earlier, 'down' for later
 * @returns The adjacent assignment or null if none exists
 */
export function findAdjacentAssignment(
  assignments: TaskAssignment[],
  assignmentId: string,
  direction: SwapDirection
): TaskAssignment | null {
  // Find the target assignment
  const target = assignments.find((a) => a.id === assignmentId);
  if (!target) return null;

  // Filter assignments on the same station (non-outsourced)
  const stationAssignments = assignments
    .filter((a) => !a.isOutsourced && a.targetId === target.targetId)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  // Find index of target in sorted list
  const targetIndex = stationAssignments.findIndex((a) => a.id === assignmentId);
  if (targetIndex === -1) return null;

  // Get adjacent based on direction
  if (direction === 'up') {
    // Adjacent above means earlier in time (lower index)
    return targetIndex > 0 ? stationAssignments[targetIndex - 1] : null;
  } else {
    // Adjacent below means later in time (higher index)
    return targetIndex < stationAssignments.length - 1
      ? stationAssignments[targetIndex + 1]
      : null;
  }
}

/**
 * Apply a swap operation between an assignment and its adjacent tile.
 *
 * The swap preserves both tiles' durations and adjusts their start/end times
 * so they exchange positions on the timeline.
 *
 * @param assignments - All assignments
 * @param assignmentId - The assignment initiating the swap
 * @param direction - 'up' to swap with tile above, 'down' to swap with tile below
 * @returns SwapResult with updated assignments
 */
export function applySwap(
  assignments: TaskAssignment[],
  assignmentId: string,
  direction: SwapDirection
): SwapResult {
  // Find the adjacent assignment
  const adjacent = findAdjacentAssignment(assignments, assignmentId, direction);

  if (!adjacent) {
    return {
      assignments,
      swapped: false,
      swappedWithId: null,
    };
  }

  // Find both assignments
  const target = assignments.find((a) => a.id === assignmentId)!;

  // Calculate durations (in ms)
  const targetDuration =
    new Date(target.scheduledEnd).getTime() - new Date(target.scheduledStart).getTime();
  const adjacentDuration =
    new Date(adjacent.scheduledEnd).getTime() - new Date(adjacent.scheduledStart).getTime();

  // Determine which is earlier
  const targetIsEarlier =
    new Date(target.scheduledStart).getTime() < new Date(adjacent.scheduledStart).getTime();

  // The earlier start time is the anchor point
  const earlierStart = targetIsEarlier ? target.scheduledStart : adjacent.scheduledStart;
  const earlierStartMs = new Date(earlierStart).getTime();

  // After swap:
  // - If target was earlier and swapping down: adjacent becomes first, target second
  // - If target was later and swapping up: target becomes first, adjacent second

  let newTargetStart: string;
  let newTargetEnd: string;
  let newAdjacentStart: string;
  let newAdjacentEnd: string;

  if (direction === 'up') {
    // Target moves up (earlier), adjacent moves down (later)
    // Target now starts at the earlier position
    newTargetStart = new Date(earlierStartMs).toISOString();
    newTargetEnd = new Date(earlierStartMs + targetDuration).toISOString();
    // Adjacent starts after target ends
    newAdjacentStart = newTargetEnd;
    newAdjacentEnd = new Date(earlierStartMs + targetDuration + adjacentDuration).toISOString();
  } else {
    // Target moves down (later), adjacent moves up (earlier)
    // Adjacent now starts at the earlier position
    newAdjacentStart = new Date(earlierStartMs).toISOString();
    newAdjacentEnd = new Date(earlierStartMs + adjacentDuration).toISOString();
    // Target starts after adjacent ends
    newTargetStart = newAdjacentEnd;
    newTargetEnd = new Date(earlierStartMs + adjacentDuration + targetDuration).toISOString();
  }

  // Create updated assignments array
  const now = new Date().toISOString();
  const updatedAssignments = assignments.map((a) => {
    if (a.id === target.id) {
      return {
        ...a,
        scheduledStart: newTargetStart,
        scheduledEnd: newTargetEnd,
        updatedAt: now,
      };
    }
    if (a.id === adjacent.id) {
      return {
        ...a,
        scheduledStart: newAdjacentStart,
        scheduledEnd: newAdjacentEnd,
        updatedAt: now,
      };
    }
    return a;
  });

  return {
    assignments: updatedAssignments,
    swapped: true,
    swappedWithId: adjacent.id,
  };
}

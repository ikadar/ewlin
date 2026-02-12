/**
 * Prerequisite Utilities
 *
 * Helper functions for checking element prerequisite status (blocking state).
 * v0.4.32b: Scheduler Tile Blocking Visual
 * v0.4.32c: Forme Status & Date Tracking
 */

import type {
  Element,
  PaperStatus,
  BatStatus,
  PlateStatus,
  FormeStatus,
  Task,
  Station,
} from '@flux/types';
import {
  PAPER_READY_STATES,
  BAT_READY_STATES,
  PLATES_READY_STATES,
  FORME_READY_STATES,
  DIE_CUTTING_CATEGORY_ID,
  DIE_CUTTING_KEYWORDS,
} from '@flux/types';

export { PAPER_READY_STATES, BAT_READY_STATES, PLATES_READY_STATES, FORME_READY_STATES };

/**
 * Check if an element's paper status is ready (not blocking).
 */
export function isPaperReady(status: PaperStatus): boolean {
  return PAPER_READY_STATES.includes(status);
}

/**
 * Check if an element's BAT status is ready (not blocking).
 */
export function isBatReady(status: BatStatus): boolean {
  return BAT_READY_STATES.includes(status);
}

/**
 * Check if an element's plates status is ready (not blocking).
 */
export function isPlatesReady(status: PlateStatus): boolean {
  return PLATES_READY_STATES.includes(status);
}

/**
 * Check if an element's forme status is ready (not blocking).
 */
export function isFormeReady(status: FormeStatus): boolean {
  return FORME_READY_STATES.includes(status);
}

export { DIE_CUTTING_CATEGORY_ID };

/**
 * Check if an element has any die-cutting action (internal or outsourced).
 * Used to determine if Forme prerequisite should be shown.
 *
 * @param element - The element to check
 * @param tasks - All tasks
 * @param stations - All stations
 * @returns true if element has die-cutting action
 */
export function hasDieCuttingAction(
  element: Element,
  tasks: Task[],
  stations: Station[]
): boolean {
  return element.taskIds.some((taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;

    if (task.type === 'Internal') {
      const station = stations.find((s) => s.id === task.stationId);
      return station?.categoryId === DIE_CUTTING_CATEGORY_ID;
    }

    if (task.type === 'Outsourced') {
      const actionLower = task.actionType?.toLowerCase() || '';
      return DIE_CUTTING_KEYWORDS.some((keyword) => actionLower.includes(keyword));
    }

    return false;
  });
}

/**
 * Check if an element is blocked due to missing prerequisites.
 * An element is blocked if ANY prerequisite is not in a ready state.
 *
 * @param element - The element to check
 * @returns true if blocked, false if ready
 */
export function isElementBlocked(element: Element): boolean {
  const paperReady = isPaperReady(element.paperStatus);
  const batReady = isBatReady(element.batStatus);
  const platesReady = isPlatesReady(element.plateStatus);
  const formeReady = isFormeReady(element.formeStatus);

  return !paperReady || !batReady || !platesReady || !formeReady;
}

/**
 * Get detailed blocking info for an element.
 * Returns which prerequisites are blocking and their current status.
 *
 * @param element - The element to check
 * @returns Object with blocking details for tooltip display
 */
export interface PrerequisiteBlockingInfo {
  isBlocked: boolean;
  paper: {
    status: PaperStatus;
    isReady: boolean;
    orderedAt?: string;
    deliveredAt?: string;
  };
  bat: {
    status: BatStatus;
    isReady: boolean;
    filesReceivedAt?: string;
    sentAt?: string;
    approvedAt?: string;
  };
  plates: {
    status: PlateStatus;
    isReady: boolean;
  };
  forme: {
    status: FormeStatus;
    isReady: boolean;
    orderedAt?: string;
    deliveredAt?: string;
  };
}

export function getPrerequisiteBlockingInfo(element: Element): PrerequisiteBlockingInfo {
  const paperReady = isPaperReady(element.paperStatus);
  const batReady = isBatReady(element.batStatus);
  const platesReady = isPlatesReady(element.plateStatus);
  const formeReady = isFormeReady(element.formeStatus);

  return {
    isBlocked: !paperReady || !batReady || !platesReady || !formeReady,
    paper: {
      status: element.paperStatus,
      isReady: paperReady,
      orderedAt: element.paperOrderedAt,
      deliveredAt: element.paperDeliveredAt,
    },
    bat: {
      status: element.batStatus,
      isReady: batReady,
      filesReceivedAt: element.filesReceivedAt,
      sentAt: element.batSentAt,
      approvedAt: element.batApprovedAt,
    },
    plates: {
      status: element.plateStatus,
      isReady: platesReady,
    },
    forme: {
      status: element.formeStatus,
      isReady: formeReady,
      orderedAt: element.formeOrderedAt,
      deliveredAt: element.formeDeliveredAt,
    },
  };
}

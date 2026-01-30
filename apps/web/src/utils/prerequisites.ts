/**
 * Prerequisite Utilities
 *
 * Helper functions for checking element prerequisite status (blocking state).
 * v0.4.32b: Scheduler Tile Blocking Visual
 */

import type { Element, PaperStatus, BatStatus, PlateStatus } from '@flux/types';

/**
 * Ready states for each prerequisite type.
 * An element is NOT blocked if all its prerequisites are in these states.
 */
export const PAPER_READY_STATES: PaperStatus[] = ['none', 'in_stock', 'delivered'];
export const BAT_READY_STATES: BatStatus[] = ['none', 'bat_approved'];
export const PLATES_READY_STATES: PlateStatus[] = ['none', 'ready'];

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

  return !paperReady || !batReady || !platesReady;
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
  };
  bat: {
    status: BatStatus;
    isReady: boolean;
  };
  plates: {
    status: PlateStatus;
    isReady: boolean;
  };
}

export function getPrerequisiteBlockingInfo(element: Element): PrerequisiteBlockingInfo {
  const paperReady = isPaperReady(element.paperStatus);
  const batReady = isBatReady(element.batStatus);
  const platesReady = isPlatesReady(element.plateStatus);

  return {
    isBlocked: !paperReady || !batReady || !platesReady,
    paper: {
      status: element.paperStatus,
      isReady: paperReady,
    },
    bat: {
      status: element.batStatus,
      isReady: batReady,
    },
    plates: {
      status: element.plateStatus,
      isReady: platesReady,
    },
  };
}

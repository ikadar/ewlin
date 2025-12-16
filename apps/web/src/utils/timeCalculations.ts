/**
 * Time Calculations
 * Utilities for calculating assignment end times.
 */

import type { InternalTask } from '@flux/types';
import { getTotalMinutes } from '@flux/types';

/**
 * Calculate the scheduled end time for an internal task.
 * Simple calculation: start + duration (without operating hours stretching for MVP).
 *
 * @param task - The internal task
 * @param scheduledStart - ISO timestamp of scheduled start
 * @returns ISO timestamp of scheduled end
 */
export function calculateEndTime(task: InternalTask, scheduledStart: string): string {
  const startDate = new Date(scheduledStart);
  const totalMinutes = getTotalMinutes(task.duration);
  const endDate = new Date(startDate.getTime() + totalMinutes * 60 * 1000);
  return endDate.toISOString();
}

/**
 * Get duration in milliseconds for an internal task.
 *
 * @param task - The internal task
 * @returns Duration in milliseconds
 */
export function getDurationMs(task: InternalTask): number {
  const totalMinutes = getTotalMinutes(task.duration);
  return totalMinutes * 60 * 1000;
}

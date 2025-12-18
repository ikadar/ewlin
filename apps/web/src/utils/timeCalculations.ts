/**
 * Time Calculations
 * Utilities for calculating assignment end times.
 */

import type { InternalTask, Station, DaySchedule } from '@flux/types';
import { getTotalMinutes } from '@flux/types';

const DAY_NAMES: (keyof Station['operatingSchedule'])[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Parse time string "HH:MM" to minutes since midnight.
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get the day schedule for a specific date, considering exceptions.
 */
function getDaySchedule(station: Station, date: Date): DaySchedule {
  // Check for exceptions first (use local date for comparison)
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const exception = station.exceptions.find((e) => e.date === dateStr);

  if (exception) {
    return exception.schedule;
  }

  // Use regular operating schedule
  const dayOfWeek = date.getDay();
  const dayName = DAY_NAMES[dayOfWeek];
  return station.operatingSchedule[dayName];
}

/**
 * Find the current or next operating slot for a given time.
 * Returns null if no slot found on this day.
 */
function findCurrentOrNextSlot(
  daySchedule: DaySchedule,
  currentMinutes: number
): { start: number; end: number } | null {
  if (!daySchedule.isOperating || daySchedule.slots.length === 0) {
    return null;
  }

  // Sort slots by start time
  const sortedSlots = [...daySchedule.slots]
    .map((slot) => ({
      start: parseTimeToMinutes(slot.start),
      end: slot.end === '24:00' ? 24 * 60 : parseTimeToMinutes(slot.end),
    }))
    .sort((a, b) => a.start - b.start);

  // Find slot that contains current time or starts after it
  for (const slot of sortedSlots) {
    if (currentMinutes < slot.end) {
      return {
        start: Math.max(slot.start, currentMinutes),
        end: slot.end,
      };
    }
  }

  return null;
}

/**
 * Calculate the scheduled end time for an internal task with operating hours stretching.
 * Implements BR-ASSIGN-003b: Task stretching algorithm.
 *
 * @param task - The internal task
 * @param scheduledStart - ISO timestamp of scheduled start
 * @param station - The station (optional, for operating hours stretching)
 * @returns ISO timestamp of scheduled end
 */
export function calculateEndTime(
  task: InternalTask,
  scheduledStart: string,
  station?: Station
): string {
  const startDate = new Date(scheduledStart);
  const totalMinutes = getTotalMinutes(task.duration);

  // If no station provided, use simple calculation
  if (!station) {
    const endDate = new Date(startDate.getTime() + totalMinutes * 60 * 1000);
    return endDate.toISOString();
  }

  // Implement BR-ASSIGN-003b: Task stretching algorithm
  let remainingMinutes = totalMinutes;
  let currentDate = new Date(startDate);
  let iterations = 0;
  const maxIterations = 365 * 24; // Safety limit

  while (remainingMinutes > 0 && iterations < maxIterations) {
    iterations++;

    const daySchedule = getDaySchedule(station, currentDate);
    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

    const slot = findCurrentOrNextSlot(daySchedule, currentMinutes);

    if (slot) {
      // We're in an operating slot or found one later today
      const effectiveStart = Math.max(slot.start, currentMinutes);
      const availableMinutes = slot.end - effectiveStart;
      const workMinutes = Math.min(availableMinutes, remainingMinutes);

      remainingMinutes -= workMinutes;

      if (remainingMinutes <= 0) {
        // Work completed in this slot
        const endMinutes = effectiveStart + workMinutes;
        currentDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
        break;
      } else {
        // Slot exhausted, move to end of this slot and continue searching today
        currentDate.setHours(Math.floor(slot.end / 60), slot.end % 60, 0, 0);
        // Continue loop to find next slot on same day
        continue;
      }
    } else {
      // No more slots today, move to start of next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }
  }

  return currentDate.toISOString();
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

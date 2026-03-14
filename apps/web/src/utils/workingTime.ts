/**
 * Working Time Utilities
 *
 * Functions to add/subtract time while respecting non-working periods.
 * v0.3.53: Precedence Lines + Working Hours (REQ-03)
 */

import type { Station, DaySchedule, TimeSlot } from '@flux/types';

/**
 * Get the day schedule for a specific date, checking exceptions first.
 */
export function getDayScheduleForDate(date: Date, station: Station): DaySchedule {
  // Format date as YYYY-MM-DD for exception lookup
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Check for schedule exception first
  const exception = station.exceptions.find((e) => e.date === dateStr);
  if (exception) {
    return exception.schedule;
  }

  // Use regular schedule based on day of week
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  switch (dayOfWeek) {
    case 0: return station.operatingSchedule.sunday;
    case 1: return station.operatingSchedule.monday;
    case 2: return station.operatingSchedule.tuesday;
    case 3: return station.operatingSchedule.wednesday;
    case 4: return station.operatingSchedule.thursday;
    case 5: return station.operatingSchedule.friday;
    case 6: return station.operatingSchedule.saturday;
    default: return { isOperating: false, slots: [] };
  }
}

/**
 * Parse a time string (HH:MM) into a Date object for the given day.
 */
function parseTimeToDate(timeStr: string, baseDate: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Find the current or next available time slot for a given time.
 * Returns null if no more slots available today.
 */
function findCurrentOrNextSlot(
  currentTime: Date,
  slots: TimeSlot[]
): TimeSlot | null {
  const timeStr = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;

  for (const slot of slots) {
    // If current time is before slot end, this slot is usable
    if (timeStr < slot.end) {
      return slot;
    }
  }

  return null; // No more slots today
}

/**
 * Get the start of the next working day.
 */
function getNextWorkingDayStart(currentDate: Date, station: Station): Date {
  const nextDay = new Date(currentDate);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);

  // Find a day that is operating (limit to 14 days to prevent infinite loop)
  for (let i = 0; i < 14; i++) {
    const daySchedule = getDayScheduleForDate(nextDay, station);
    if (daySchedule.isOperating && daySchedule.slots.length > 0) {
      // Return the start of the first slot
      return parseTimeToDate(daySchedule.slots[0].start, nextDay);
    }
    nextDay.setDate(nextDay.getDate() + 1);
  }

  // Fallback: just return next day at 8:00
  const fallback = new Date(currentDate);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(8, 0, 0, 0);
  return fallback;
}

/**
 * Add working time to a date, skipping non-working periods.
 *
 * @param startTime - Starting point
 * @param durationMs - Duration to add (in milliseconds)
 * @param station - Station with operatingSchedule and exceptions
 * @returns New Date after adding working time
 */
export function addWorkingTime(
  startTime: Date,
  durationMs: number,
  station: Station
): Date {
  // If no duration, return start time
  if (durationMs <= 0) {
    return new Date(startTime);
  }

  let current = new Date(startTime);
  let remainingMs = durationMs;

  // Safety limit: prevent infinite loops (max 30 days)
  const maxIterations = 30 * 24; // 30 days worth of hourly iterations
  let iterations = 0;

  while (remainingMs > 0 && iterations < maxIterations) {
    iterations++;

    const daySchedule = getDayScheduleForDate(current, station);

    // If not operating today, skip to next working day
    if (!daySchedule.isOperating || daySchedule.slots.length === 0) {
      current = getNextWorkingDayStart(current, station);
      continue;
    }

    // Find current or next slot
    const slot = findCurrentOrNextSlot(current, daySchedule.slots);

    if (!slot) {
      // No more slots today, skip to next working day
      current = getNextWorkingDayStart(current, station);
      continue;
    }

    const slotStart = parseTimeToDate(slot.start, current);
    const slotEnd = parseTimeToDate(slot.end, current);

    // If current time is before slot start, jump to slot start
    if (current < slotStart) {
      current = slotStart;
    }

    // Calculate available time in this slot
    const availableMs = slotEnd.getTime() - current.getTime();

    if (remainingMs <= availableMs) {
      // Fits in this slot - we're done
      current = new Date(current.getTime() + remainingMs);
      remainingMs = 0;
    } else {
      // Consume this slot and continue
      remainingMs -= availableMs;
      current = slotEnd;
    }
  }

  return current;
}

/**
 * Find the previous or current time slot for a given time (working backwards).
 * Returns null if no slots available before this time today.
 */
function findPreviousOrCurrentSlot(
  currentTime: Date,
  slots: TimeSlot[]
): TimeSlot | null {
  const timeStr = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;

  // Iterate in reverse to find the last usable slot
  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i];
    // If current time is after slot start, this slot is usable
    if (timeStr > slot.start) {
      return slot;
    }
  }

  return null; // No slots before this time today
}

/**
 * Get the end of the previous working day.
 */
function getPreviousWorkingDayEnd(currentDate: Date, station: Station): Date {
  const prevDay = new Date(currentDate);
  prevDay.setDate(prevDay.getDate() - 1);
  prevDay.setHours(23, 59, 59, 999);

  // Find a day that is operating (limit to 14 days to prevent infinite loop)
  for (let i = 0; i < 14; i++) {
    const daySchedule = getDayScheduleForDate(prevDay, station);
    if (daySchedule.isOperating && daySchedule.slots.length > 0) {
      // Return the end of the last slot
      const lastSlot = daySchedule.slots[daySchedule.slots.length - 1];
      return parseTimeToDate(lastSlot.end, prevDay);
    }
    prevDay.setDate(prevDay.getDate() - 1);
  }

  // Fallback: just return previous day at 17:00
  const fallback = new Date(currentDate);
  fallback.setDate(fallback.getDate() - 1);
  fallback.setHours(17, 0, 0, 0);
  return fallback;
}

/**
 * Subtract working time from a date, skipping non-working periods (going backwards).
 *
 * @param endTime - Ending point
 * @param durationMs - Duration to subtract (in milliseconds)
 * @param station - Station with operatingSchedule and exceptions
 * @returns New Date after subtracting working time
 */
export function subtractWorkingTime(
  endTime: Date,
  durationMs: number,
  station: Station
): Date {
  // If no duration, return end time
  if (durationMs <= 0) {
    return new Date(endTime);
  }

  let current = new Date(endTime);
  let remainingMs = durationMs;

  // Safety limit: prevent infinite loops (max 30 days)
  const maxIterations = 30 * 24;
  let iterations = 0;

  while (remainingMs > 0 && iterations < maxIterations) {
    iterations++;

    const daySchedule = getDayScheduleForDate(current, station);

    // If not operating today, skip to previous working day
    if (!daySchedule.isOperating || daySchedule.slots.length === 0) {
      current = getPreviousWorkingDayEnd(current, station);
      continue;
    }

    // Find previous or current slot
    const slot = findPreviousOrCurrentSlot(current, daySchedule.slots);

    if (!slot) {
      // No slots before this time today, skip to previous working day
      current = getPreviousWorkingDayEnd(current, station);
      continue;
    }

    const slotStart = parseTimeToDate(slot.start, current);
    const slotEnd = parseTimeToDate(slot.end, current);

    // If current time is after slot end, jump to slot end
    if (current > slotEnd) {
      current = slotEnd;
    }

    // Calculate available time in this slot (going backwards)
    const availableMs = current.getTime() - slotStart.getTime();

    if (remainingMs <= availableMs) {
      // Fits in this slot - we're done
      current = new Date(current.getTime() - remainingMs);
      remainingMs = 0;
    } else {
      // Consume this slot and continue backwards
      remainingMs -= availableMs;
      current = slotStart;
    }
  }

  return current;
}

/**
 * Snap a time to the previous available working time end.
 * If the time is already within working hours, returns the same time.
 * If not, returns the end of the previous working slot (same day or previous working day).
 *
 * Mirror of snapToNextWorkingTime() — used for ALAP backward placement.
 */
export function snapToPreviousWorkingTime(time: Date, station: Station): Date {
  // If already within working hours, return as-is
  if (isWithinWorkingHours(time, station)) {
    return new Date(time);
  }

  const daySchedule = getDayScheduleForDate(time, station);

  // If day is operating, find the latest slot that ends before current time
  if (daySchedule.isOperating && daySchedule.slots.length > 0) {
    const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

    // Reverse iterate to find the latest slot ending before our time
    for (let i = daySchedule.slots.length - 1; i >= 0; i--) {
      const slot = daySchedule.slots[i];
      if (slot.end <= timeStr) {
        return parseTimeToDate(slot.end, time);
      }
    }
  }

  // No usable slots today, go to previous working day end
  return getPreviousWorkingDayEnd(time, station);
}

/**
 * Check if a time falls within working hours of a station.
 */
export function isWithinWorkingHours(time: Date, station: Station): boolean {
  const daySchedule = getDayScheduleForDate(time, station);

  if (!daySchedule.isOperating || daySchedule.slots.length === 0) {
    return false;
  }

  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

  for (const slot of daySchedule.slots) {
    if (timeStr >= slot.start && timeStr < slot.end) {
      return true;
    }
  }

  return false;
}

/**
 * Snap a time to the next available working time.
 * If the time is already within working hours, returns the same time.
 * If not, returns the start of the next working slot (same day or next working day).
 *
 * Use case: Drying time is a physical process that doesn't pause during non-working hours.
 * But work can only START during working hours. So if drying ends at 12:30 (during lunch),
 * the earliest a task can start is 13:00 (when lunch ends).
 */
export function snapToNextWorkingTime(time: Date, station: Station): Date {
  // If already within working hours, return as-is
  if (isWithinWorkingHours(time, station)) {
    return new Date(time);
  }

  const daySchedule = getDayScheduleForDate(time, station);

  // If day is not operating, skip to next working day
  if (!daySchedule.isOperating || daySchedule.slots.length === 0) {
    return getNextWorkingDayStart(time, station);
  }

  // Find the next slot that starts after the current time
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

  for (const slot of daySchedule.slots) {
    if (slot.start > timeStr) {
      // This slot starts after our time - snap to its start
      return parseTimeToDate(slot.start, time);
    }
  }

  // No more slots today, go to next working day
  return getNextWorkingDayStart(time, station);
}

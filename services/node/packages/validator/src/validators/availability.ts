/**
 * Availability Validator
 * Checks that task is scheduled within station operating hours.
 */

import type {
  ScheduleSnapshot,
  ScheduleConflict,
  ProposedAssignment,
  Station,
  DaySchedule,
} from '@flux/types';
import { parseTimestamp } from '../utils/time.js';
import { findStation, findTask } from '../utils/helpers.js';
import { calculateEndTime } from './shared.js';

/**
 * Validate that the proposed assignment is within station operating hours.
 */
export function validateAvailability(
  proposed: ProposedAssignment,
  snapshot: ScheduleSnapshot
): ScheduleConflict | null {
  // Outsourced tasks don't have operating hour constraints
  if (proposed.isOutsourced) {
    return null;
  }

  const station = findStation(snapshot, proposed.targetId);
  if (!station) {
    return {
      type: 'AvailabilityConflict',
      message: `Station not found`,
      taskId: proposed.taskId,
      targetId: proposed.targetId,
    };
  }

  // Check station status
  if (station.status !== 'Available') {
    return {
      type: 'AvailabilityConflict',
      message: `Station is ${station.status}, not available for scheduling`,
      taskId: proposed.taskId,
      targetId: proposed.targetId,
      details: {
        stationStatus: station.status,
      },
    };
  }

  const task = findTask(snapshot, proposed.taskId);
  if (!task) {
    return null;
  }

  const proposedStart = parseTimestamp(proposed.scheduledStart);
  const proposedEnd = calculateEndTime(task, proposedStart);

  // Check if start time is within operating hours
  const startCheck = checkWithinOperatingHours(proposedStart, station, snapshot);
  if (!startCheck.isWithin) {
    return {
      type: 'AvailabilityConflict',
      message: `Task start time is outside operating hours`,
      taskId: proposed.taskId,
      targetId: proposed.targetId,
      details: {
        reason: startCheck.reason,
        time: proposed.scheduledStart,
      },
    };
  }

  // For MVP, we just check if start is within hours
  // Full implementation would check the entire duration and handle stretching

  return null;
}

interface OperatingHoursCheck {
  isWithin: boolean;
  reason?: string;
}

/**
 * Check if a timestamp is within station operating hours.
 */
function checkWithinOperatingHours(
  timestamp: Date,
  station: Station,
  snapshot: ScheduleSnapshot
): OperatingHoursCheck {
  const dateStr = timestamp.toISOString().split('T')[0];

  // Check for schedule exceptions first
  const exception = station.exceptions.find((e) => e.date === dateStr);
  if (exception) {
    if (!exception.schedule.isOperating) {
      return {
        isWithin: false,
        reason: `Station closed due to: ${exception.reason ?? 'schedule exception'}`,
      };
    }
    return checkWithinDaySchedule(timestamp, exception.schedule);
  }

  // Use regular operating schedule
  const daySchedule = getDaySchedule(timestamp, station);
  if (!daySchedule.isOperating) {
    return {
      isWithin: false,
      reason: `Station not operating on this day`,
    };
  }

  return checkWithinDaySchedule(timestamp, daySchedule);
}

/**
 * Get the day schedule for a given timestamp.
 */
function getDaySchedule(timestamp: Date, station: Station): DaySchedule {
  const dayOfWeek = timestamp.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const schedule = station.operatingSchedule;

  switch (dayOfWeek) {
    case 0:
      return schedule.sunday;
    case 1:
      return schedule.monday;
    case 2:
      return schedule.tuesday;
    case 3:
      return schedule.wednesday;
    case 4:
      return schedule.thursday;
    case 5:
      return schedule.friday;
    case 6:
      return schedule.saturday;
    default:
      return { isOperating: false, slots: [] };
  }
}

/**
 * Check if time is within any slot of the day schedule.
 */
function checkWithinDaySchedule(timestamp: Date, daySchedule: DaySchedule): OperatingHoursCheck {
  if (!daySchedule.isOperating || daySchedule.slots.length === 0) {
    return {
      isWithin: false,
      reason: 'Station not operating on this day',
    };
  }

  const timeStr = timestamp.toISOString().split('T')[1]?.substring(0, 5) ?? '';

  for (const slot of daySchedule.slots) {
    if (timeStr >= slot.start && timeStr < slot.end) {
      return { isWithin: true };
    }
  }

  return {
    isWithin: false,
    reason: `Time ${timeStr} is outside operating hours`,
  };
}

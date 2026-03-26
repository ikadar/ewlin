import type { ScheduleSnapshot, Station, TaskAssignment, Task } from '@flux/types';
import {
  validateAssignment,
  snapToNextWorkingTime,
  addWorkingTime,
  calculateEndTime,
  findTask,
  findStation,
  findAssignmentByTaskId,
  parseTimestamp,
  formatTimestamp,
} from '@flux/schedule-validator';
import type { Tile, StationAnalysis } from './types.js';
import { isOptimizableStation } from './classify.js';

// ============================================================================
// Working-time-aware end time computation
// ============================================================================

/**
 * Computes end time respecting station operating hours.
 * For internal tasks on stations with operating schedules, uses addWorkingTime
 * to skip non-operating periods. Falls back to naive calculateEndTime otherwise.
 */
function computeEndTime(task: Task, start: Date, station: Station): Date {
  if (task.type === 'Internal' && station.operatingSchedule) {
    const dur = task.duration as { setupMinutes: number; runMinutes: number };
    const durationMs = (dur.setupMinutes + dur.runMinutes) * 60 * 1000;
    return addWorkingTime(start, durationMs, station);
  }
  return calculateEndTime(task, start);
}

// ============================================================================
// Quarter-hour ceiling
// ============================================================================

export function ceilToQuarterHour(date: Date): Date {
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ms = date.getMilliseconds();
  const remainder = minutes % 15;

  if (remainder === 0 && seconds === 0 && ms === 0) {
    return date;
  }

  const result = new Date(date);
  result.setMinutes(minutes + (15 - remainder), 0, 0);
  return result;
}

// ============================================================================
// Snapshot mutation
// ============================================================================

export function mutateSnapshot(
  snapshot: ScheduleSnapshot,
  taskId: string,
  newStart: string,
  newEnd: string,
): void {
  const idx = snapshot.assignments.findIndex(a => a.taskId === taskId);
  if (idx >= 0) {
    snapshot.assignments[idx] = {
      ...snapshot.assignments[idx],
      scheduledStart: newStart,
      scheduledEnd: newEnd,
    };
  }
}

// ============================================================================
// Find earliest valid start for a tile
// ============================================================================

const MAX_PLACEMENT_ATTEMPTS = 50;

export function findEarliestValidStart(
  tile: Tile,
  station: Station,
  snapshot: ScheduleSnapshot,
  stationNextAvailable: Date,
  now: Date,
): { start: Date; end: Date } | null {
  const task = findTask(snapshot, tile.taskId);
  if (!task) return null;

  // 1. Start with station continuity (no earlier than previous tile's end or now)
  let earliest = new Date(Math.max(stationNextAvailable.getTime(), now.getTime()));

  // 2. Snap to operating hours
  earliest = snapToNextWorkingTime(earliest, station);

  // 3. Round up to quarter-hour
  earliest = ceilToQuarterHour(earliest);

  // 5. Calculate end time (respecting station operating hours)
  let endTime = computeEndTime(task, earliest, station);

  // 6. Validate and resolve conflicts
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const proposed = {
      taskId: tile.taskId,
      targetId: station.id,
      isOutsourced: tile.assignment.isOutsourced,
      scheduledStart: formatTimestamp(earliest),
    };

    const result = validateAssignment(proposed, snapshot);

    if (result.valid || result.conflicts.length === 0) {
      return { start: earliest, end: endTime };
    }

    // Handle conflicts by advancing the start time
    let advanced = false;
    for (const conflict of result.conflicts) {
      if (conflict.type === 'StationConflict' && conflict.details) {
        // Advance past the conflicting tile's end (field name: conflictEnd)
        const details = conflict.details as Record<string, unknown>;
        const endStr = details.conflictEnd ?? details.existingEnd;
        if (typeof endStr === 'string') {
          earliest = parseTimestamp(endStr);
          advanced = true;
          break;
        }
      }
      if (conflict.type === 'PrecedenceConflict' && result.suggestedStart) {
        const suggested = parseTimestamp(result.suggestedStart);
        // If suggested is BEFORE current earliest, constraints are contradictory:
        // predecessor pushes forward but successor pushes back (frozen tile).
        // Can't resolve — don't move this tile.
        if (suggested.getTime() < earliest.getTime()) {
          return null;
        }
        // Ensure we don't go before station's next available slot
        earliest = new Date(Math.max(suggested.getTime(), stationNextAvailable.getTime()));
        advanced = true;
        break;
      }
      if (conflict.type === 'GroupCapacityConflict') {
        earliest = new Date(earliest.getTime() + 15 * 60 * 1000);
        advanced = true;
        break;
      }
      if (conflict.type === 'AvailabilityConflict') {
        earliest = new Date(earliest.getTime() + 15 * 60 * 1000);
        advanced = true;
        break;
      }
    }

    if (!advanced) {
      earliest = new Date(earliest.getTime() + 15 * 60 * 1000);
    }

    // Re-snap and re-ceil
    earliest = snapToNextWorkingTime(earliest, station);
    earliest = ceilToQuarterHour(earliest);
    endTime = computeEndTime(task, earliest, station);
  }

  // Failed to find valid slot within attempts — return best effort
  return { start: earliest, end: endTime };
}

// ============================================================================
// Compact a single station
// ============================================================================

export function compactStation(
  analysis: StationAnalysis,
  snapshot: ScheduleSnapshot,
  now: Date,
  horizonEnd: Date,
): number {
  const station = analysis.station;
  let nextAvailable = new Date(now);
  let movedCount = 0;

  // Process immobile tiles first to track nextAvailable
  for (const tile of analysis.immobileTiles) {
    const end = parseTimestamp(tile.assignment.scheduledEnd);
    if (end > nextAvailable) {
      nextAvailable = end;
    }
  }

  // Get all assignments on this station, sorted by current scheduledStart
  const allAssignments = snapshot.assignments
    .filter(a => a.targetId === station.id)
    .sort((a, b) => parseTimestamp(a.scheduledStart).getTime() - parseTimestamp(b.scheduledStart).getTime());

  for (const a of allAssignments) {
    const start = parseTimestamp(a.scheduledStart);

    // Skip immobile (past or completed)
    if (start < now || a.isCompleted) {
      const end = parseTimestamp(a.scheduledEnd);
      if (end > nextAvailable) {
        nextAvailable = end;
      }
      continue;
    }

    // Skip frozen (beyond horizon) — track end time but don't move
    if (start > horizonEnd) {
      const end = parseTimestamp(a.scheduledEnd);
      if (end > nextAvailable) {
        nextAvailable = end;
      }
      continue;
    }

    // Build tile for this assignment
    const task = findTask(snapshot, a.taskId);
    if (!task) continue;

    const tile: Tile = {
      taskId: a.taskId,
      assignment: a,
      task,
      elementId: task.elementId,
      jobId: '', // Not needed for compaction
      spec: {},
      deadline: null,
      sequenceOrder: task.sequenceOrder,
    };

    const placement = findEarliestValidStart(tile, station, snapshot, nextAvailable, now);
    if (!placement) {
      // Contradictory constraints — keep tile at original position, track its end
      const end = parseTimestamp(a.scheduledEnd);
      if (end > nextAvailable) {
        nextAvailable = end;
      }
      continue;
    }

    const newStartStr = formatTimestamp(placement.start);
    const newEndStr = formatTimestamp(placement.end);

    if (newStartStr !== a.scheduledStart) {
      mutateSnapshot(snapshot, a.taskId, newStartStr, newEndStr);
      movedCount++;
    } else if (newEndStr !== a.scheduledEnd) {
      // Update end time even if start didn't change (naive → working-time-aware)
      mutateSnapshot(snapshot, a.taskId, newStartStr, newEndStr);
    }

    nextAvailable = placement.end;
  }

  return movedCount;
}

// ============================================================================
// Compact all stations — multi-pass convergence
// ============================================================================

export function compactAllStations(
  analyses: StationAnalysis[],
  snapshot: ScheduleSnapshot,
  now: Date,
  horizonEnd: Date,
): number {
  const maxPasses = 5;
  let totalMoved = 0;

  // Sort: printing stations first (by downstream impact), then non-printing
  const sorted = [...analyses].sort((a, b) => {
    const aPrint = a.classification === 'printing' ? 0 : 1;
    const bPrint = b.classification === 'printing' ? 0 : 1;
    return aPrint - bPrint;
  });

  for (let pass = 0; pass < maxPasses; pass++) {
    let movedInPass = 0;

    for (const analysis of sorted) {
      movedInPass += compactStation(analysis, snapshot, now, horizonEnd);
    }

    totalMoved += movedInPass;
    if (movedInPass === 0) break;
  }

  return totalMoved;
}

// ============================================================================
// Apply reorders with synthetic start times
// ============================================================================

export function applyReordersToSnapshot(
  snapshot: ScheduleSnapshot,
  reorderedTiles: Tile[],
  now: Date,
): void {
  for (let i = 0; i < reorderedTiles.length; i++) {
    const tile = reorderedTiles[i];
    // Synthetic start: now + i seconds (preserves desired order for compaction)
    const syntheticStart = new Date(now.getTime() + i * 1000);
    const syntheticEnd = new Date(syntheticStart.getTime() + 60 * 60 * 1000); // +1h placeholder

    mutateSnapshot(
      snapshot,
      tile.taskId,
      formatTimestamp(syntheticStart),
      formatTimestamp(syntheticEnd),
    );
  }
}

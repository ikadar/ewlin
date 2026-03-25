import type { ScheduleSnapshot, Station, StationCategory, TaskAssignment } from '@flux/types';
import {
  findStation,
  findTask,
  findElement,
  findJob,
  getStationAssignments,
  parseTimestamp,
} from '@flux/schedule-validator';
import type { Tile, StationAnalysis, StationClass } from './types.js';

// ============================================================================
// Station classification
// ============================================================================

const OPTIMIZABLE_KEYWORDS = ['offset', 'numérique', 'digital'];

export function isOptimizableStation(station: Station, categories: StationCategory[]): boolean {
  const cat = categories.find(c => c.id === station.categoryId);
  if (!cat) return false;
  const nameLower = cat.name.toLowerCase();
  return OPTIMIZABLE_KEYWORDS.some(kw => nameLower.includes(kw));
}

export function elementHasPrintingTask(
  elementId: string,
  snapshot: ScheduleSnapshot,
  optimizableStationIds: Set<string>,
  visited: Set<string> = new Set(),
): boolean {
  if (visited.has(elementId)) return false;
  visited.add(elementId);

  const element = findElement(snapshot, elementId);
  if (!element) return false;

  // Check direct tasks on this element
  for (const taskId of element.taskIds) {
    const task = findTask(snapshot, taskId);
    if (task && task.type === 'Internal' && optimizableStationIds.has(task.stationId)) {
      return true;
    }
  }

  // Recurse into prerequisite elements
  for (const prereqId of element.prerequisiteElementIds) {
    if (elementHasPrintingTask(prereqId, snapshot, optimizableStationIds, visited)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Tile building
// ============================================================================

export function buildTile(assignment: TaskAssignment, snapshot: ScheduleSnapshot): Tile | null {
  const task = findTask(snapshot, assignment.taskId);
  if (!task) return null;

  const element = findElement(snapshot, task.elementId);
  if (!element) return null;

  const job = findJob(snapshot, element.jobId);
  if (!job) return null;

  return {
    taskId: assignment.taskId,
    assignment,
    task,
    elementId: task.elementId,
    jobId: element.jobId,
    spec: (element.spec as Record<string, unknown>) ?? {},
    deadline: job.workshopExitDate ? parseDeadline(job.workshopExitDate) : null,
    sequenceOrder: task.sequenceOrder,
  };
}

function parseDeadline(workshopExitDate: string): Date {
  // Deadline is at 14:00 on the workshop exit date
  const date = new Date(workshopExitDate);
  if (isNaN(date.getTime())) return new Date(workshopExitDate);
  date.setHours(14, 0, 0, 0);
  return date;
}

// ============================================================================
// Station analysis
// ============================================================================

export function classifyStations(
  snapshot: ScheduleSnapshot,
  now: Date,
  horizonEnd: Date,
): StationAnalysis[] {
  const optimizableStationIds = new Set<string>();
  for (const station of snapshot.stations) {
    if (isOptimizableStation(station, snapshot.categories)) {
      optimizableStationIds.add(station.id);
    }
  }

  const analyses: StationAnalysis[] = [];

  for (const station of snapshot.stations) {
    const assignments = getStationAssignments(snapshot, station.id);
    if (assignments.length === 0) continue;

    const immobileTiles: Tile[] = [];
    const movableTiles: Tile[] = [];
    const frozenTiles: Tile[] = [];

    for (const a of assignments) {
      const tile = buildTile(a, snapshot);
      if (!tile) continue;

      const start = parseTimestamp(a.scheduledStart);
      if (start < now || a.isCompleted) {
        immobileTiles.push(tile);
      } else if (start > horizonEnd) {
        frozenTiles.push(tile);
      } else {
        movableTiles.push(tile);
      }
    }

    // Classify station
    let classification: StationClass;
    if (optimizableStationIds.has(station.id)) {
      classification = 'printing';
    } else {
      // Check per-tile: any tile with printing dependency = downstream
      let hasDownstream = false;
      const printfreeTiles: Tile[] = [];
      for (const tile of movableTiles) {
        if (elementHasPrintingTask(tile.elementId, snapshot, optimizableStationIds)) {
          hasDownstream = true;
        } else {
          printfreeTiles.push(tile);
        }
      }
      classification = hasDownstream ? 'downstream' : 'print-free';
      // For print-free classification, only include print-free tiles as movable
      if (classification === 'downstream') {
        // Keep all movable tiles but mark station as downstream
      } else {
        // Only non-printing-dependency tiles are reorderable
      }
    }

    // Get station's similarity criteria
    const category = snapshot.categories.find(c => c.id === station.categoryId);
    const criteria = category?.similarityCriteria ?? [];

    // Get anchor spec (last immobile tile's element spec)
    const anchorSpec = getAnchorSpec(immobileTiles, snapshot);

    analyses.push({
      stationId: station.id,
      station,
      classification,
      immobileTiles,
      movableTiles,
      frozenTiles,
      criteria,
      anchorSpec,
    });
  }

  return analyses;
}

function getAnchorSpec(immobileTiles: Tile[], _snapshot: ScheduleSnapshot): Record<string, unknown> {
  if (immobileTiles.length === 0) return {};
  // Last immobile tile's spec
  const lastImmobile = immobileTiles[immobileTiles.length - 1];
  return lastImmobile.spec;
}

// ============================================================================
// Helper: get print-free tiles from a station analysis
// ============================================================================

export function getPrintfreeTiles(
  analysis: StationAnalysis,
  snapshot: ScheduleSnapshot,
): Tile[] {
  if (analysis.classification !== 'downstream' && analysis.classification !== 'print-free') {
    return analysis.movableTiles;
  }
  const optimizableStationIds = new Set<string>();
  for (const station of snapshot.stations) {
    if (isOptimizableStation(station, snapshot.categories)) {
      optimizableStationIds.add(station.id);
    }
  }
  return analysis.movableTiles.filter(
    tile => !elementHasPrintingTask(tile.elementId, snapshot, optimizableStationIds),
  );
}

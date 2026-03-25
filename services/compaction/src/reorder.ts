import type { SimilarityCriterion } from '@flux/types';
import type { Tile } from './types.js';

// ============================================================================
// Constants
// ============================================================================

const SIMILARITY_WEIGHT = 100;
const DEADLINE_PENALTY_WEIGHT = 1;

// ============================================================================
// Similarity scoring
// ============================================================================

export function tileSpecSimilarity(
  specA: Record<string, unknown>,
  specB: Record<string, unknown>,
  criteria: SimilarityCriterion[],
): number {
  let matches = 0;
  for (const c of criteria) {
    const valA = specA[c.fieldPath] ?? null;
    const valB = specB[c.fieldPath] ?? null;
    if (valA !== null && valB !== null && valA === valB) {
      matches++;
    }
  }
  return matches;
}

export function scoreSimilarity(tiles: Tile[], criteria: SimilarityCriterion[]): number {
  let total = 0;
  for (let i = 1; i < tiles.length; i++) {
    total += tileSpecSimilarity(tiles[i - 1].spec, tiles[i].spec, criteria);
  }
  return total;
}

// ============================================================================
// Precedence checks for ordering (not timeline — just sequence validity)
// ============================================================================

export function canPlaceTile(
  tile: Tile,
  placedElementOrders: Map<string, number[]>,
  allTiles: Tile[],
  placedTaskIds: Set<string>,
): boolean {
  const elemId = tile.elementId;
  const seq = tile.sequenceOrder;

  // 1. Intra-element: all same-element tiles with lower sequenceOrder must be placed
  const placedOrders = placedElementOrders.get(elemId) ?? [];
  for (const other of allTiles) {
    if (other.elementId === elemId && other.sequenceOrder < seq) {
      if (!placedOrders.includes(other.sequenceOrder)) {
        return false;
      }
    }
  }

  // 2. Cross-element: if first task (seq 0), all prerequisite element tiles must be placed
  const element = allTiles.find(t => t.elementId === elemId);
  const prereqElementIds = getPrerequisiteElementIds(tile, allTiles);
  if (seq === 0 && prereqElementIds.length > 0) {
    for (const other of allTiles) {
      if (prereqElementIds.includes(other.elementId)) {
        if (!placedTaskIds.has(other.taskId)) {
          return false;
        }
      }
    }
  }

  // 3. Cross-job: if first task of root element (seq 0, no element prereqs), required job tiles
  const requiredJobIds = getRequiredJobIds(tile, allTiles);
  if (seq === 0 && prereqElementIds.length === 0 && requiredJobIds.length > 0) {
    for (const other of allTiles) {
      if (requiredJobIds.includes(other.jobId)) {
        if (!placedTaskIds.has(other.taskId)) {
          return false;
        }
      }
    }
  }

  return true;
}

function getPrerequisiteElementIds(tile: Tile, _allTiles: Tile[]): string[] {
  // The tile doesn't carry prerequisiteElementIds directly — we need to get it
  // from the snapshot during tile building. For now, store it on the tile.
  // This is handled by enriching tiles with element data in classify.ts
  return (tile as TileWithDeps).prerequisiteElementIds ?? [];
}

function getRequiredJobIds(tile: Tile, _allTiles: Tile[]): string[] {
  return (tile as TileWithDeps).requiredJobIds ?? [];
}

interface TileWithDeps extends Tile {
  prerequisiteElementIds?: string[];
  requiredJobIds?: string[];
}

// ============================================================================
// All precedence satisfied (for 2-opt validation)
// ============================================================================

export function allPrecedenceSatisfied(tiles: Tile[]): boolean {
  const seenElementOrders = new Map<string, number[]>();
  const seenTaskIds = new Set<string>();

  for (const tile of tiles) {
    const elemId = tile.elementId;
    const seq = tile.sequenceOrder;

    // 1. Intra-element
    const seenOrders = seenElementOrders.get(elemId) ?? [];
    for (const other of tiles) {
      if (other.elementId === elemId && other.sequenceOrder < seq) {
        if (!seenOrders.includes(other.sequenceOrder)) {
          return false;
        }
      }
    }

    // 2. Cross-element
    const prereqElementIds = getPrerequisiteElementIds(tile, tiles);
    if (seq === 0 && prereqElementIds.length > 0) {
      for (const other of tiles) {
        if (prereqElementIds.includes(other.elementId)) {
          if (!seenTaskIds.has(other.taskId)) {
            return false;
          }
        }
      }
    }

    // 3. Cross-job
    const requiredJobIds = getRequiredJobIds(tile, tiles);
    if (seq === 0 && prereqElementIds.length === 0 && requiredJobIds.length > 0) {
      for (const other of tiles) {
        if (requiredJobIds.includes(other.jobId)) {
          if (!seenTaskIds.has(other.taskId)) {
            return false;
          }
        }
      }
    }

    const orders = seenElementOrders.get(elemId) ?? [];
    orders.push(seq);
    seenElementOrders.set(elemId, orders);
    seenTaskIds.add(tile.taskId);
  }

  return true;
}

// ============================================================================
// Greedy nearest-neighbor with deadline penalty
// ============================================================================

export function greedyNearestNeighbor(
  tiles: Tile[],
  criteria: SimilarityCriterion[],
  anchorSpec: Record<string, unknown>,
): Tile[] {
  if (tiles.length <= 1) return [...tiles];

  // Sort by deadline first for urgency-aware start
  const sorted = [...tiles].sort(compareDeadline);

  const result: Tile[] = [];
  const remaining = [...sorted];
  const placedElementOrders = new Map<string, number[]>();
  const placedTaskIds = new Set<string>();
  let cumulativeDuration = 0;

  while (remaining.length > 0) {
    let bestIdx: number | null = null;
    let bestScore = -Infinity;

    const lastSpec = result.length > 0 ? result[result.length - 1].spec : anchorSpec;

    for (let idx = 0; idx < remaining.length; idx++) {
      const candidate = remaining[idx];

      if (!canPlaceTile(candidate, placedElementOrders, tiles, placedTaskIds)) {
        continue;
      }

      const similarity = tileSpecSimilarity(lastSpec, candidate.spec, criteria);

      // Deadline penalty
      const candidateDuration = getTotalMinutes(candidate);
      let deadlinePenalty = 0;
      if (candidate.deadline !== null) {
        const estimatedEndMinutes = cumulativeDuration + candidateDuration;
        const now = new Date();
        const estimatedEnd = new Date(now.getTime() + estimatedEndMinutes * 60 * 1000);
        if (estimatedEnd > candidate.deadline) {
          deadlinePenalty = (estimatedEnd.getTime() - candidate.deadline.getTime()) / (60 * 1000);
        }
      }

      const score = SIMILARITY_WEIGHT * similarity - DEADLINE_PENALTY_WEIGHT * deadlinePenalty;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }

    if (bestIdx === null) {
      // All remaining are constrained — append in current order
      result.push(...remaining);
      break;
    }

    const chosen = remaining[bestIdx];
    result.push(chosen);
    cumulativeDuration += getTotalMinutes(chosen);
    remaining.splice(bestIdx, 1);

    const orders = placedElementOrders.get(chosen.elementId) ?? [];
    orders.push(chosen.sequenceOrder);
    placedElementOrders.set(chosen.elementId, orders);
    placedTaskIds.add(chosen.taskId);
  }

  return result;
}

// ============================================================================
// 2-opt local improvement
// ============================================================================

export function twoOptImprove(tiles: Tile[], criteria: SimilarityCriterion[]): Tile[] {
  if (tiles.length <= 2) return tiles;

  let current = [...tiles];
  let currentScore = scoreSimilarity(current, criteria);
  const maxIterations = 100;
  let iterations = 0;
  let improved = true;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    const n = current.length;

    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n; j++) {
        // Reverse segment [i+1..j]
        const newTiles = [...current];
        const segment = newTiles.slice(i + 1, j + 1);
        segment.reverse();
        newTiles.splice(i + 1, j - i, ...segment);

        if (!allPrecedenceSatisfied(newTiles)) {
          continue;
        }

        const newScore = scoreSimilarity(newTiles, criteria);
        if (newScore > currentScore) {
          current = newTiles;
          currentScore = newScore;
          improved = true;
          break; // Restart outer loop (break inner, outer will also break via improved flag)
        }
      }
      if (improved) break; // Restart from i=0
    }
  }

  return current;
}

// ============================================================================
// Helpers
// ============================================================================

function compareDeadline(a: Tile, b: Tile): number {
  if (a.deadline === null && b.deadline === null) return 0;
  if (a.deadline === null) return 1;
  if (b.deadline === null) return -1;
  return a.deadline.getTime() - b.deadline.getTime();
}

function getTotalMinutes(tile: Tile): number {
  if (tile.task.type === 'Internal') {
    return (tile.task.duration.setupMinutes + tile.task.duration.runMinutes) || 60;
  }
  // Outsourced: estimate based on open days (8h per day)
  if (tile.task.type === 'Outsourced') {
    return tile.task.duration.openDays * 8 * 60;
  }
  return 60;
}

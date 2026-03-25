import type { SimilarityCriterion } from '@flux/types';
import type { Tile } from './types.js';
import { greedyNearestNeighbor, twoOptImprove } from './reorder.js';

// ============================================================================
// Hierarchical clustering
// ============================================================================

export function hierarchicalCluster(
  tiles: Tile[],
  criteria: SimilarityCriterion[],
  level: number,
  anchorSpec: Record<string, unknown>,
): Tile[] {
  if (tiles.length <= 1 || level >= criteria.length) {
    // Terminal: sort by deadline
    return [...tiles].sort(compareDeadline);
  }

  const fieldPath = criteria[level].fieldPath;

  // Group by current level's criterion
  const groups = new Map<string, number[]>();
  for (let idx = 0; idx < tiles.length; idx++) {
    const val = String(tiles[idx].spec[fieldPath] ?? '__none__');
    const indices = groups.get(val) ?? [];
    indices.push(idx);
    groups.set(val, indices);
  }

  const anchorValue = anchorSpec[fieldPath] ?? null;

  // Order groups: anchor-match first, then earliest deadline
  const groupKeys = [...groups.keys()];
  groupKeys.sort((a, b) => {
    if (anchorValue !== null) {
      const aMatch = a === String(anchorValue) ? 0 : 1;
      const bMatch = b === String(anchorValue) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    const aDeadline = clusterEarliestDeadline(groups.get(a)!, tiles);
    const bDeadline = clusterEarliestDeadline(groups.get(b)!, tiles);
    if (aDeadline === null && bDeadline === null) return 0;
    if (aDeadline === null) return 1;
    if (bDeadline === null) return -1;
    return aDeadline.getTime() - bDeadline.getTime();
  });

  const orderedTiles: Tile[] = [];
  let lastSpec = anchorSpec;

  for (const key of groupKeys) {
    const groupTiles = groups.get(key)!.map(i => tiles[i]);

    let sorted: Tile[];
    if (level < criteria.length - 1) {
      // Recurse to next level
      sorted = hierarchicalCluster(groupTiles, criteria, level + 1, lastSpec);
    } else {
      // Terminal level: greedy NN + 2-opt
      sorted = greedyNearestNeighbor(groupTiles, criteria, lastSpec);
      sorted = twoOptImprove(sorted, criteria);
    }

    orderedTiles.push(...sorted);
    if (sorted.length > 0) {
      lastSpec = sorted[sorted.length - 1].spec;
    }
  }

  return orderedTiles;
}

// ============================================================================
// Orchestrator: cluster → NN → 2-opt
// ============================================================================

export function clusterAndReorder(
  tiles: Tile[],
  criteria: SimilarityCriterion[],
  anchorSpec: Record<string, unknown>,
): Tile[] {
  if (tiles.length <= 1) return tiles;

  if (criteria.length === 0) {
    // No criteria — just sort by deadline and apply NN
    return greedyNearestNeighbor(tiles, criteria, anchorSpec);
  }

  return hierarchicalCluster(tiles, criteria, 0, anchorSpec);
}

// ============================================================================
// Helpers
// ============================================================================

function clusterEarliestDeadline(indices: number[], tiles: Tile[]): Date | null {
  let earliest: Date | null = null;
  for (const i of indices) {
    const d = tiles[i].deadline;
    if (d !== null && (earliest === null || d < earliest)) {
      earliest = d;
    }
  }
  return earliest;
}

function compareDeadline(a: Tile, b: Tile): number {
  if (a.deadline === null && b.deadline === null) return 0;
  if (a.deadline === null) return 1;
  if (b.deadline === null) return -1;
  return a.deadline.getTime() - b.deadline.getTime();
}

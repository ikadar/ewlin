import type { ScheduleSnapshot, TaskAssignment } from '@flux/types';
import { parseTimestamp, formatTimestamp } from '@flux/schedule-validator';
import { classifyStations, getPrintfreeTiles, hasFrozenDownstream } from './classify.js';
import { clusterAndReorder } from './cluster.js';
import { scoreSimilarity } from './reorder.js';
import { compactAllStations, applyReordersToSnapshot } from './timeline.js';
import { validateAndRollback } from './rollback.js';
import type { CompactionResult, ProgressCallback, StationAnalysis } from './types.js';

// ============================================================================
// Main compaction orchestrator
// ============================================================================

export function compact(
  snapshot: ScheduleSnapshot,
  horizonHours: number,
  onProgress: ProgressCallback,
): CompactionResult {
  const startMs = performance.now();
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + horizonHours * 60 * 60 * 1000);
  let stepsCompleted = 0;

  // Save original assignments for rollback comparison
  const originalAssignments = new Map<string, TaskAssignment>();
  for (const a of snapshot.assignments) {
    originalAssignments.set(a.taskId, { ...a });
  }

  // ========================================================================
  // Phase 0 — Analyze
  // ========================================================================
  onProgress({
    type: 'progress',
    phase: 'analyze',
    stepsCompleted: ++stepsCompleted,
    message: 'Analyzing schedule',
  });

  const analyses = classifyStations(snapshot, now, horizonEnd);

  const printingStations = analyses.filter(a => a.classification === 'printing' && a.movableTiles.length >= 2);
  const printfreeStations = analyses.filter(a => {
    if (a.classification === 'print-free' && a.movableTiles.length >= 2) return true;
    if (a.classification === 'downstream') {
      const pfTiles = getPrintfreeTiles(a, snapshot);
      return pfTiles.length >= 2;
    }
    return false;
  });

  let totalReordered = 0;
  let similarityBefore = 0;
  let similarityAfter = 0;

  // ========================================================================
  // Phase 1 — Cluster & reorder printing stations
  // ========================================================================
  for (let i = 0; i < printingStations.length; i++) {
    const analysis = printingStations[i];
    onProgress({
      type: 'progress',
      phase: 'reorder_printing',
      stationName: analysis.station.name,
      stationIndex: i,
      totalStations: printingStations.length,
      stepsCompleted: ++stepsCompleted,
    });

    // Exclude pinned tiles: tiles whose downstream chain has frozen assignments.
    // Reordering these would push downstream tiles into frozen territory.
    const reorderableTiles = analysis.movableTiles.filter(
      tile => !hasFrozenDownstream(tile, snapshot, horizonEnd)
    );

    if (reorderableTiles.length < 2) {
      // Not enough reorderable tiles — skip similarity optimization
      similarityBefore += scoreSimilarity(analysis.movableTiles, analysis.criteria);
      similarityAfter += scoreSimilarity(analysis.movableTiles, analysis.criteria);
      continue;
    }

    const before = scoreSimilarity(reorderableTiles, analysis.criteria);
    const reordered = clusterAndReorder(reorderableTiles, analysis.criteria, analysis.anchorSpec);
    const after = scoreSimilarity(reordered, analysis.criteria);

    similarityBefore += before;
    similarityAfter += after;

    if (after > before) {
      applyReordersToSnapshot(snapshot, reordered, now);
      totalReordered += reordered.length;
    }
  }

  // ========================================================================
  // Phase 2 — Propagate via compaction
  // ========================================================================
  onProgress({
    type: 'progress',
    phase: 'propagate',
    stepsCompleted: ++stepsCompleted,
    message: 'Propagating to downstream stations',
  });

  compactAllStations(analyses, snapshot, now, horizonEnd);

  // ========================================================================
  // Phase 3 — Print-free reorder
  // ========================================================================
  for (let i = 0; i < printfreeStations.length; i++) {
    const analysis = printfreeStations[i];
    const tiles = analysis.classification === 'downstream'
      ? getPrintfreeTiles(analysis, snapshot)
      : analysis.movableTiles;

    if (tiles.length < 2) continue;

    onProgress({
      type: 'progress',
      phase: 'reorder_printfree',
      stationName: analysis.station.name,
      stationIndex: i,
      totalStations: printfreeStations.length,
      stepsCompleted: ++stepsCompleted,
    });

    // Exclude pinned tiles (frozen downstream)
    const reorderableTiles = tiles.filter(
      tile => !hasFrozenDownstream(tile, snapshot, horizonEnd)
    );

    if (reorderableTiles.length < 2) continue;

    const before = scoreSimilarity(reorderableTiles, analysis.criteria);
    const reordered = clusterAndReorder(reorderableTiles, analysis.criteria, analysis.anchorSpec);
    const after = scoreSimilarity(reordered, analysis.criteria);

    if (after > before) {
      applyReordersToSnapshot(snapshot, reordered, now);
      totalReordered += reordered.length;
    }
  }

  // Re-compact after print-free reorder
  compactAllStations(analyses, snapshot, now, horizonEnd);

  // ========================================================================
  // Phase 4 — Validate & rollback
  // ========================================================================
  onProgress({
    type: 'progress',
    phase: 'validate',
    stepsCompleted: ++stepsCompleted,
    message: 'Validating constraints',
  });

  const rollbackCount = validateAndRollback(snapshot, originalAssignments, analyses, now, horizonEnd);

  // ========================================================================
  // Build result
  // ========================================================================
  const changedAssignments = snapshot.assignments.filter(a => {
    const orig = originalAssignments.get(a.taskId);
    return orig && orig.scheduledStart !== a.scheduledStart;
  });

  const computeMs = Math.round(performance.now() - startMs);

  return {
    assignments: changedAssignments.map(a => ({
      taskId: a.taskId,
      scheduledStart: a.scheduledStart,
      scheduledEnd: a.scheduledEnd,
    })),
    movedCount: changedAssignments.length,
    reorderedCount: totalReordered,
    similarityBefore,
    similarityAfter,
    rollbackCount,
    printingStationsOptimized: printingStations.length,
    downstreamStationsPropagated: analyses.filter(a => a.classification === 'downstream').length,
    printfreeStationsReordered: printfreeStations.length,
    computeMs,
  };
}

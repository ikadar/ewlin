import type { TaskAssignment, Task, Station, SimilarityCriterion } from '@flux/types';

// ============================================================================
// Tile — enriched assignment with element/job/spec data for algorithm use
// ============================================================================

export interface Tile {
  taskId: string;
  assignment: TaskAssignment;
  task: Task;
  elementId: string;
  jobId: string;
  spec: Record<string, unknown>;
  deadline: Date | null;
  sequenceOrder: number;
}

// ============================================================================
// Station classification
// ============================================================================

export type StationClass = 'printing' | 'downstream' | 'print-free';

export interface StationAnalysis {
  stationId: string;
  station: Station;
  classification: StationClass;
  immobileTiles: Tile[];
  movableTiles: Tile[];
  frozenTiles: Tile[];
  criteria: SimilarityCriterion[];
  anchorSpec: Record<string, unknown>;
}

// ============================================================================
// Progress events (matches V2 SSE contract)
// ============================================================================

export interface CompactionProgress {
  type: 'progress' | 'complete' | 'error';
  phase: string;
  stationName?: string;
  stationIndex?: number;
  totalStations?: number;
  stepsCompleted: number;
  message?: string;
  result?: CompactionResult;
}

// ============================================================================
// Compaction result
// ============================================================================

export interface AssignmentResult {
  taskId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface CompactionResult {
  assignments: AssignmentResult[];
  movedCount: number;
  reorderedCount: number;
  similarityBefore: number;
  similarityAfter: number;
  rollbackCount: number;
  printingStationsOptimized: number;
  downstreamStationsPropagated: number;
  printfreeStationsReordered: number;
  computeMs: number;
}

export type ProgressCallback = (event: CompactionProgress) => void;

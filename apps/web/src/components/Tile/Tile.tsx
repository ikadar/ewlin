import { Circle, CircleCheck } from 'lucide-react';
import type { TaskAssignment, Job, InternalTask } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { SwapButtons } from './SwapButtons';
import { SimilarityIndicators } from './SimilarityIndicators';
import { getJobColorClasses } from './colorUtils';
import type { SimilarityResult } from './similarityUtils';

export interface TileProps {
  /** Task assignment data */
  assignment: TaskAssignment;
  /** Task data (internal task with duration) */
  task: InternalTask;
  /** Job data */
  job: Job;
  /** Y position in pixels (top) */
  top: number;
  /** Callback when tile is clicked (select job) */
  onSelect?: (jobId: string) => void;
  /** Callback when tile is double-clicked (recall) */
  onRecall?: (assignmentId: string) => void;
  /** Callback when swap up is clicked */
  onSwapUp?: (assignmentId: string) => void;
  /** Callback when swap down is clicked */
  onSwapDown?: (assignmentId: string) => void;
  /** Whether to show swap up button */
  showSwapUp?: boolean;
  /** Whether to show swap down button */
  showSwapDown?: boolean;
  /** Whether this tile's job is selected */
  isSelected?: boolean;
  /** Similarity comparison results with previous tile (if any) */
  similarityResults?: SimilarityResult[];
  /** ID of the job being dragged (for muting other jobs during drag) */
  activeJobId?: string;
}

/**
 * Calculate height in pixels from duration in minutes.
 */
function minutesToPixels(minutes: number): number {
  return (minutes / 60) * PIXELS_PER_HOUR;
}

/**
 * Tile - Visual representation of a scheduled task assignment.
 * Shows job color, setup/run sections, completion status, and swap buttons.
 */
export function Tile({
  assignment,
  task,
  job,
  top,
  onSelect,
  onRecall,
  onSwapUp,
  onSwapDown,
  showSwapUp = true,
  showSwapDown = true,
  isSelected = false,
  similarityResults,
  activeJobId,
}: TileProps) {
  const { setupMinutes, runMinutes } = task.duration;
  const totalMinutes = setupMinutes + runMinutes;

  // Calculate heights
  const setupHeight = minutesToPixels(setupMinutes);
  const runHeight = minutesToPixels(runMinutes);
  const totalHeight = minutesToPixels(totalMinutes);

  // Get color classes
  const colorClasses = getJobColorClasses(job.color);

  // Completion state
  const isCompleted = assignment.isCompleted;

  // Muting state: tile is muted during drag if it belongs to a different job
  const isMuted = activeJobId !== undefined && activeJobId !== job.id;

  // Completed gradient style
  const completedGradient = isCompleted
    ? 'linear-gradient(to right, rgba(34,197,94,0.6) 0%, rgba(34,197,94,0.2) 50%, transparent 100%)'
    : undefined;

  // Handle click (select job)
  const handleClick = () => {
    onSelect?.(job.id);
  };

  // Handle double click (recall)
  const handleDoubleClick = () => {
    onRecall?.(assignment.id);
  };

  // Handle swap
  const handleSwapUp = () => {
    onSwapUp?.(assignment.id);
  };

  const handleSwapDown = () => {
    onSwapDown?.(assignment.id);
  };

  // Determine if we have setup time to show
  const hasSetup = setupMinutes > 0;

  // Selected state styling
  const selectedClass = isSelected ? 'ring-2 ring-white/30' : '';

  // Muting style: desaturate and reduce opacity for other jobs during drag
  const mutingStyle = isMuted
    ? { filter: 'saturate(0.2)', opacity: 0.6 }
    : undefined;

  return (
    <div
      className={`absolute left-0 right-0 text-sm border-l-4 ${colorClasses.border} group cursor-pointer ${selectedClass} transition-[filter,opacity] duration-150 ease-out`}
      style={{ top: `${top}px`, height: `${totalHeight}px`, ...mutingStyle }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      data-testid={`tile-${assignment.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick();
      }}
    >
      {/* Similarity indicators (shown at top of tile, overlapping junction with previous tile) */}
      {similarityResults && similarityResults.length > 0 && (
        <SimilarityIndicators results={similarityResults} />
      )}

      {/* Setup section (if has setup time) */}
      {hasSetup && (
        <div
          className={`absolute left-0 right-0 ${colorClasses.setupBg} border-b ${colorClasses.setupBorder}`}
          style={{
            top: 0,
            height: `${setupHeight}px`,
            backgroundImage: completedGradient,
          }}
          data-testid="tile-setup-section"
        />
      )}

      {/* Run section */}
      <div
        className={`absolute left-0 right-0 ${colorClasses.runBg} pt-0.5 px-2`}
        style={{
          top: hasSetup ? `${setupHeight}px` : 0,
          height: hasSetup ? `${runHeight}px` : `${totalHeight}px`,
          backgroundImage: completedGradient,
        }}
        data-testid="tile-run-section"
      >
        {/* Content: completion icon + reference + client */}
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CircleCheck
              className="w-4 h-4 text-emerald-500 shrink-0"
              data-testid="tile-completed-icon"
            />
          ) : (
            <Circle
              className="w-4 h-4 text-zinc-600 shrink-0"
              data-testid="tile-incomplete-icon"
            />
          )}
          <span
            className={`${colorClasses.text} font-medium truncate min-w-0`}
            data-testid="tile-content"
          >
            {job.reference} · {job.client}
          </span>
        </div>
      </div>

      {/* Swap buttons (visible on hover) */}
      <SwapButtons
        onSwapUp={handleSwapUp}
        onSwapDown={handleSwapDown}
        showUp={showSwapUp}
        showDown={showSwapDown}
      />
    </div>
  );
}

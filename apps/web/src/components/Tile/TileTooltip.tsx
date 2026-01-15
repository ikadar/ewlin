/**
 * TileTooltip - Tooltip for small tiles that can't display full content
 *
 * v0.3.63: Shows job details when tile is too small to display text.
 * Appears instantly on hover (no delay for power users).
 *
 * Content:
 * - Job reference and client
 * - Station name
 * - Duration (setup + run)
 * - Completion status
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckSquare, Square } from 'lucide-react';
import type { Job, InternalTask, TaskAssignment } from '@flux/types';

export interface TileTooltipProps {
  /** Job data */
  job: Job;
  /** Task data */
  task: InternalTask;
  /** Assignment data */
  assignment: TaskAssignment;
  /** Children to wrap (the tile content) */
  children: React.ReactNode;
  /** Whether tooltip is enabled (only for small tiles) */
  enabled: boolean;
}

interface TooltipPosition {
  x: number;
  y: number;
}

/**
 * Format duration for display.
 */
function formatDuration(task: InternalTask): string {
  const { setupMinutes, runMinutes } = task.duration;
  const totalMinutes = setupMinutes + runMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}min`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${minutes.toString().padStart(2, '0')}`;
}

/**
 * Calculate tooltip position to stay within viewport.
 */
function calculatePosition(
  mouseX: number,
  mouseY: number,
  tooltipWidth: number,
  tooltipHeight: number
): TooltipPosition {
  const padding = 12;
  const offset = 8; // Distance from cursor
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Default: appear to the right and below cursor
  let x = mouseX + offset;
  let y = mouseY + offset;

  // Flip horizontal if too close to right edge
  if (x + tooltipWidth + padding > viewportWidth) {
    x = mouseX - tooltipWidth - offset;
  }

  // Flip vertical if too close to bottom edge
  if (y + tooltipHeight + padding > viewportHeight) {
    y = mouseY - tooltipHeight - offset;
  }

  // Clamp to viewport
  x = Math.max(padding, Math.min(x, viewportWidth - tooltipWidth - padding));
  y = Math.max(padding, Math.min(y, viewportHeight - tooltipHeight - padding));

  return { x, y };
}

/**
 * TileTooltip - Wrapper component that shows a tooltip on hover.
 */
export function TileTooltip({
  job,
  task,
  assignment,
  children,
  enabled,
}: TileTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track mouse position for tooltip placement
  const handleMouseEnter = () => {
    if (enabled) {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!enabled || !isVisible) return;

    // Use estimated tooltip size for initial positioning
    const estimatedWidth = 200;
    const estimatedHeight = 100;
    const newPosition = calculatePosition(e.clientX, e.clientY, estimatedWidth, estimatedHeight);
    setPosition(newPosition);
  };

  // Adjust position after tooltip renders (for accurate size)
  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const adjustedPosition = calculatePosition(
        position.x - 8, // Account for offset
        position.y - 8,
        rect.width,
        rect.height
      );
      if (adjustedPosition.x !== position.x || adjustedPosition.y !== position.y) {
        setPosition(adjustedPosition);
      }
    }
  }, [isVisible, position.x, position.y]);

  const isCompleted = assignment.isCompleted;

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      className="contents"
    >
      {children}

      {enabled && isVisible && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[10000] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3 min-w-[180px] max-w-[280px] pointer-events-none"
          style={{ left: position.x, top: position.y }}
          data-testid="tile-tooltip"
        >
          {/* Job reference and client */}
          <div className="font-medium text-zinc-100 truncate">
            {job.reference}
          </div>
          <div className="text-sm text-zinc-400 truncate">
            {job.client}
          </div>

          {/* Separator */}
          <div className="h-px bg-zinc-700 my-2" />

          {/* Station */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">Station</span>
            <span className="text-zinc-300">{task.stationId}</span>
          </div>

          {/* Duration */}
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-zinc-500">Durée</span>
            <span className="text-zinc-300">
              {formatDuration(task)}
              {task.duration.setupMinutes > 0 && (
                <span className="text-zinc-500 ml-1">
                  (calage: {task.duration.setupMinutes}min)
                </span>
              )}
            </span>
          </div>

          {/* Completion status */}
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-zinc-500">Statut</span>
            <span className={`flex items-center gap-1 ${isCompleted ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {isCompleted ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5" />
                  Terminé
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  En cours
                </>
              )}
            </span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

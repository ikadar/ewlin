import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { TaskAssignment, Job, InternalTask } from '@flux/types';

export interface SplitPopoverProps {
  x: number;
  y: number;
  task: InternalTask;
  job: Job;
  assignment: TaskAssignment;
  onConfirm: (splitAtRunMinutes: number) => void;
  onCancel: () => void;
}

/**
 * SplitPopover — Portal-based popover for splitting a tile.
 *
 * Shows a slider to choose the split point (run minutes for part 1),
 * a mini preview of the two resulting parts, and Annuler/Diviser buttons.
 */
export function SplitPopover({
  x,
  y,
  task,
  job,
  assignment,
  onConfirm,
  onCancel,
}: SplitPopoverProps) {
  const { setupMinutes, runMinutes } = task.duration;
  const minSplit = 15;
  const maxSplit = runMinutes - 15;
  const [splitAt, setSplitAt] = useState(Math.round(runMinutes / 2 / 15) * 15);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Position with viewport edge detection
  const getPosition = useCallback(() => {
    const width = 320;
    const height = 280;
    const padding = 8;

    let posX = x;
    let posY = y;

    if (x + width + padding > window.innerWidth) posX = x - width;
    if (y + height + padding > window.innerHeight) posY = y - height;

    posX = Math.max(padding, posX);
    posY = Math.max(padding, posY);

    return { left: posX, top: posY };
  }, [x, y]);

  const position = getPosition();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Close on scroll
  useEffect(() => {
    const handleScroll = () => onCancel();
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', handleScroll, { capture: true });
  }, [onCancel]);

  const part1Run = splitAt;
  const part2Run = runMinutes - splitAt;
  const part1Total = setupMinutes + part1Run;
  const part2Total = setupMinutes + part2Run;
  const previewTotal = part1Total + part2Total;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 p-4 w-[320px]"
      style={{ left: position.left, top: position.top }}
      data-testid="split-popover"
    >
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">
        Diviser la t&acirc;che
      </h3>

      {/* Mini preview: two proportional rectangles */}
      <div className="flex gap-1 h-14 mb-3 rounded overflow-hidden">
        {/* Part 1 */}
        <div
          className="flex flex-col min-w-[20px]"
          style={{ flex: part1Total }}
        >
          {/* Setup section (hatched) */}
          <div
            className="bg-zinc-600"
            style={{
              flex: setupMinutes,
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
            }}
          />
          {/* Run section (solid) */}
          <div className="bg-blue-600" style={{ flex: part1Run }} />
        </div>

        {/* Part 2 */}
        <div
          className="flex flex-col min-w-[20px]"
          style={{ flex: part2Total }}
        >
          {/* Setup section (hatched) */}
          <div
            className="bg-zinc-600"
            style={{
              flex: setupMinutes,
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
            }}
          />
          {/* Run section (solid) */}
          <div className="bg-blue-600" style={{ flex: part2Run }} />
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={minSplit}
        max={maxSplit}
        step={15}
        value={splitAt}
        onChange={(e) => setSplitAt(Number(e.target.value))}
        className="w-full mb-2 accent-blue-500"
        data-testid="split-slider"
      />

      {/* Duration labels */}
      <div className="flex justify-between text-xs text-zinc-400 mb-2">
        <span>Partie 1: {formatDuration(part1Total)}</span>
        <span>Partie 2: {formatDuration(part2Total)}</span>
      </div>

      {/* Info line: re-setup time */}
      <p className="text-xs text-zinc-500 mb-3">
        Calage partie 2 : {setupMinutes} min &middot; Total : {formatDuration(previewTotal)}
      </p>

      {/* Buttons */}
      <div className="flex justify-end gap-2">
        <button
          className="px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
          onClick={onCancel}
          data-testid="split-cancel"
        >
          Annuler
        </button>
        <button
          className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
          onClick={() => onConfirm(splitAt)}
          data-testid="split-confirm"
        >
          Diviser
        </button>
      </div>
    </div>,
    document.body
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

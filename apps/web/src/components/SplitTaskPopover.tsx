import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Scissors } from 'lucide-react';
import type { InternalTask } from '@flux/types';

export interface SplitTaskPopoverProps {
  x: number;
  y: number;
  task: InternalTask;
  stationName: string;
  onConfirm: (ratio: number) => void;
  onCancel: () => void;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function SplitTaskPopover({
  x,
  y,
  task,
  stationName,
  onConfirm,
  onCancel,
}: SplitTaskPopoverProps) {
  const [ratio, setRatio] = useState(50);
  const popoverRef = useRef<HTMLDivElement>(null);

  const runMinutes = task.duration.runMinutes;
  const setupMinutes = task.duration.setupMinutes;
  const runA = Math.round(runMinutes * (ratio / 100));
  const runB = runMinutes - runA;
  const totalA = setupMinutes + runA;
  const totalB = setupMinutes + runB;

  // Calculate position with viewport edge detection
  const getPosition = useCallback(() => {
    const popoverWidth = 280;
    const popoverHeight = 340;
    const padding = 8;

    let posX = x;
    let posY = y;

    if (x + popoverWidth + padding > window.innerWidth) {
      posX = x - popoverWidth;
    }
    if (y + popoverHeight + padding > window.innerHeight) {
      posY = y - popoverHeight;
    }

    posX = Math.max(padding, posX);
    posY = Math.max(padding, posY);

    return { left: posX, top: posY };
  }, [x, y]);

  const position = getPosition();

  // Handle click outside
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

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleConfirm = () => {
    onConfirm(ratio / 100);
  };

  // Task label from element/comment or station name
  const label = task.comment || stationName;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 p-4 w-[280px]"
      style={{ left: position.left, top: position.top }}
      data-testid="split-task-popover"
    >
      {/* Title */}
      <div className="flex items-center gap-2 mb-1">
        <Scissors className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-zinc-200">Diviser la tâche</span>
      </div>

      {/* Subtitle */}
      <div className="text-xs text-zinc-400 mb-4">
        {stationName} — {label} · Run {formatDuration(runMinutes)} · Setup {formatDuration(setupMinutes)}
      </div>

      {/* Preview blocks */}
      <div className="flex flex-col gap-1 mb-4" style={{ height: '120px' }}>
        {/* Part A */}
        <div
          className="rounded overflow-hidden flex flex-col"
          style={{ flex: totalA }}
        >
          <div className="bg-blue-500/[0.18] border-b border-blue-400/20 px-2 py-0.5">
            <span className="text-[10px] text-blue-300">Setup {formatDuration(setupMinutes)}</span>
          </div>
          <div className="bg-blue-500/[0.09] flex-1 px-2 py-0.5 flex items-center">
            <span className="text-[10px] text-blue-300">Run {formatDuration(runA)}</span>
          </div>
        </div>

        {/* Part B */}
        <div
          className="rounded overflow-hidden flex flex-col"
          style={{ flex: totalB }}
        >
          <div className="bg-blue-500/[0.18] border-b border-blue-400/20 px-2 py-0.5">
            <span className="text-[10px] text-blue-300">Setup {formatDuration(setupMinutes)}</span>
          </div>
          <div className="bg-blue-500/[0.09] flex-1 px-2 py-0.5 flex items-center">
            <span className="text-[10px] text-blue-300">Run {formatDuration(runB)}</span>
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-zinc-300 mb-2">
        <span>Partie A — {formatDuration(totalA)} total</span>
        <span>Partie B — {formatDuration(totalB)} total</span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={5}
        max={95}
        step={5}
        value={ratio}
        onChange={(e) => setRatio(Number(e.target.value))}
        className="w-full mb-4 accent-blue-500"
        data-testid="split-ratio-slider"
      />

      {/* Buttons */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          data-testid="split-cancel"
        >
          Annuler
        </button>
        <button
          onClick={handleConfirm}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          data-testid="split-confirm"
        >
          Diviser
        </button>
      </div>
    </div>,
    document.body
  );
}

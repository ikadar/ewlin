/**
 * PrerequisiteTooltip
 *
 * Shows prerequisite status for a blocked element.
 * Displays after 2 seconds of hover, only on blocked tiles.
 * v0.4.32b: Scheduler Tile Blocking Visual & Tooltip
 */

import { memo } from 'react';
import type { PrerequisiteBlockingInfo } from '../../utils';

/** French labels for prerequisite types */
const LABELS = {
  paper: 'Papier',
  bat: 'BAT',
  plates: 'Plaques',
} as const;

/** French labels for paper status */
const PAPER_STATUS_LABELS: Record<string, string> = {
  none: 'Pas de papier',
  in_stock: 'En stock',
  to_order: 'À commander',
  ordered: 'Commandé',
  delivered: 'Livré',
};

/** French labels for BAT status */
const BAT_STATUS_LABELS: Record<string, string> = {
  none: 'Pas de BAT',
  waiting_files: 'Attente fichiers',
  files_received: 'Fichiers reçus',
  bat_sent: 'BAT envoyé',
  bat_approved: 'BAT validé',
};

/** French labels for plates status */
const PLATES_STATUS_LABELS: Record<string, string> = {
  none: 'Pas de plaques',
  to_make: 'À faire',
  ready: 'Prêtes',
};

export interface PrerequisiteTooltipProps {
  /** Blocking info with status for each prerequisite */
  blockingInfo: PrerequisiteBlockingInfo;
  /** Whether tooltip is visible (after 2s hover) */
  isVisible: boolean;
}

/**
 * PrerequisiteTooltip - Shows prerequisite status with icons.
 * Positioned above the tile with an arrow pointing down.
 */
export const PrerequisiteTooltip = memo(function PrerequisiteTooltip({
  blockingInfo,
  isVisible,
}: PrerequisiteTooltipProps) {
  if (!isVisible) return null;

  const { paper, bat, plates } = blockingInfo;

  // Build items to show (hide items with 'none' status unless blocking)
  const items: Array<{
    key: string;
    label: string;
    statusLabel: string;
    isReady: boolean;
  }> = [];

  // Paper: always show if not 'none', or if blocking
  if (paper.status !== 'none' || !paper.isReady) {
    items.push({
      key: 'paper',
      label: LABELS.paper,
      statusLabel: PAPER_STATUS_LABELS[paper.status] || paper.status,
      isReady: paper.isReady,
    });
  }

  // BAT: always show if not 'none', or if blocking
  if (bat.status !== 'none' || !bat.isReady) {
    items.push({
      key: 'bat',
      label: LABELS.bat,
      statusLabel: BAT_STATUS_LABELS[bat.status] || bat.status,
      isReady: bat.isReady,
    });
  }

  // Plates: always show if not 'none', or if blocking
  if (plates.status !== 'none' || !plates.isReady) {
    items.push({
      key: 'plates',
      label: LABELS.plates,
      statusLabel: PLATES_STATUS_LABELS[plates.status] || plates.status,
      isReady: plates.isReady,
    });
  }

  // If no items to show, don't render tooltip
  if (items.length === 0) return null;

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none"
      data-testid="prerequisite-tooltip"
    >
      {/* Tooltip content */}
      <div className="bg-slate-800 text-white text-xs rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            {/* Icon: warning for blocking, check for ready */}
            <span className={item.isReady ? 'text-green-400' : 'text-amber-400'}>
              {item.isReady ? '✓' : '⚠'}
            </span>
            {/* Label and status */}
            <span>
              {item.label}: {item.statusLabel}
            </span>
          </div>
        ))}
      </div>
      {/* Arrow pointing down */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800" />
    </div>
  );
});

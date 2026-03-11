/**
 * PrerequisiteTooltip
 *
 * Shows prerequisite status for a blocked element.
 * Displays after 2 seconds of hover, only on blocked tiles.
 * v0.4.32b: Scheduler Tile Blocking Visual & Tooltip
 * v0.4.32c: Forme Status & Date Tracking
 */

import { memo } from 'react';
import type { PrerequisiteBlockingInfo } from '../../utils';
import { formatDateDDMMYYYY } from '../../utils';

/** French labels for prerequisite types */
const LABELS = {
  paper: 'Papier',
  bat: 'BAT',
  plates: 'Plaques',
  forme: 'Forme',
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

/** French labels for forme status */
const FORME_STATUS_LABELS: Record<string, string> = {
  none: 'Pas de forme',
  in_stock: 'Sur stock',
  to_order: 'À commander',
  ordered: 'Commandée',
  delivered: 'Livrée',
};

/** Tooltip item structure */
interface TooltipItem {
  key: string;
  label: string;
  statusLabel: string;
  isReady: boolean;
  date?: string;
}

/**
 * Get the most relevant date for paper status.
 */
function getPaperDate(paper: PrerequisiteBlockingInfo['paper']): string | undefined {
  if (paper.status === 'delivered') return formatDateDDMMYYYY(paper.deliveredAt);
  if (paper.status === 'ordered') return formatDateDDMMYYYY(paper.orderedAt);
  return undefined;
}

/**
 * Build paper item for tooltip.
 * Extracted to reduce cognitive complexity.
 */
function buildPaperItem(paper: PrerequisiteBlockingInfo['paper']): TooltipItem | null {
  if (paper.status === 'none' && paper.isReady) return null;
  return {
    key: 'paper',
    label: LABELS.paper,
    statusLabel: PAPER_STATUS_LABELS[paper.status] || paper.status,
    isReady: paper.isReady,
    date: getPaperDate(paper),
  };
}

/**
 * Get the most relevant date for BAT status.
 */
function getBatDate(bat: PrerequisiteBlockingInfo['bat']): string | undefined {
  if (bat.status === 'bat_approved') return formatDateDDMMYYYY(bat.approvedAt);
  if (bat.status === 'bat_sent') return formatDateDDMMYYYY(bat.sentAt);
  if (bat.status === 'files_received') return formatDateDDMMYYYY(bat.filesReceivedAt);
  return undefined;
}

/**
 * Build BAT item for tooltip.
 * Extracted to reduce cognitive complexity.
 */
function buildBatItem(bat: PrerequisiteBlockingInfo['bat']): TooltipItem | null {
  if (bat.status === 'none' && bat.isReady) return null;
  return {
    key: 'bat',
    label: LABELS.bat,
    statusLabel: BAT_STATUS_LABELS[bat.status] || bat.status,
    isReady: bat.isReady,
    date: getBatDate(bat),
  };
}

/**
 * Build plates item for tooltip.
 */
function buildPlatesItem(plates: PrerequisiteBlockingInfo['plates']): TooltipItem | null {
  if (plates.status === 'none' && plates.isReady) return null;
  return {
    key: 'plates',
    label: LABELS.plates,
    statusLabel: PLATES_STATUS_LABELS[plates.status] || plates.status,
    isReady: plates.isReady,
  };
}

/**
 * Get the most relevant date for forme status.
 */
function getFormeDate(forme: PrerequisiteBlockingInfo['forme']): string | undefined {
  if (forme.status === 'delivered') return formatDateDDMMYYYY(forme.deliveredAt);
  if (forme.status === 'ordered') return formatDateDDMMYYYY(forme.orderedAt);
  return undefined;
}

/**
 * Build forme item for tooltip.
 * Extracted to reduce cognitive complexity.
 */
function buildFormeItem(forme: PrerequisiteBlockingInfo['forme']): TooltipItem | null {
  if (forme.status === 'none' && forme.isReady) return null;
  return {
    key: 'forme',
    label: LABELS.forme,
    statusLabel: FORME_STATUS_LABELS[forme.status] || forme.status,
    isReady: forme.isReady,
    date: getFormeDate(forme),
  };
}

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

  const { paper, bat, plates, forme } = blockingInfo;

  // Build items to show using helper functions
  const items: TooltipItem[] = [
    buildPaperItem(paper),
    buildBatItem(bat),
    buildPlatesItem(plates),
    buildFormeItem(forme),
  ].filter((item): item is TooltipItem => item !== null);

  // If no items to show, don't render tooltip
  if (items.length === 0) return null;

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none"
      data-testid="prerequisite-tooltip"
    >
      {/* Tooltip content */}
      <div className="flux-tooltip whitespace-nowrap">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            {/* Icon: warning for blocking, check for ready */}
            <span className={item.isReady ? 'text-green-400' : 'text-amber-400'}>
              {item.isReady ? '✓' : '⚠'}
            </span>
            {/* Label, status, and optional date */}
            <span>
              {item.label}: {item.statusLabel}
              {item.date && <span className="ml-1 text-[var(--tt-muted)]">{item.date}</span>}
            </span>
          </div>
        ))}
      </div>
      {/* Arrow pointing down */}
      <div className="flux-tooltip-arrow absolute left-1/2 -translate-x-1/2 top-full" />
    </div>
  );
});

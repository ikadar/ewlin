/**
 * TileTooltip
 *
 * Rich tooltip shown on all tiles after 500ms hover.
 * Displays 8 sections: header, description, deadline, element, spec, prerequisites, task, schedule.
 * Fázis D: TileTooltip Enhancement (spec §6, 2026-02-23)
 */

import { memo } from 'react';
import type { Job, Element, InternalTask, TaskAssignment } from '@flux/types';
import type { PrerequisiteBlockingInfo } from '../../utils';
import { formatDateDDMMYYYY, formatScheduleDateTime } from '../../utils';
import { parsePapierDSL } from '../../utils/papierDSL';

export interface TileTooltipProps {
  /** Whether tooltip is visible (after 500ms hover) */
  isVisible: boolean;
  /** Job data */
  job: Job;
  /** Element data (optional) */
  element?: Element;
  /** Task data */
  task: InternalTask;
  /** Assignment data */
  assignment: TaskAssignment;
  /** Prerequisite blocking info (only present on blocked tiles) */
  blockingInfo?: PrerequisiteBlockingInfo;
  /** Whether this tile is blocked */
  isBlocked?: boolean;
}

// ─── Prerequisite section helpers ──────────────────────────────────────────

/** French labels for prerequisite types */
const PREREQ_LABELS = {
  paper: 'Papier',
  bat: 'BAT',
  plates: 'Plaques',
  forme: 'Forme',
} as const;

const PAPER_STATUS_LABELS: Record<string, string> = {
  none: 'Pas de papier',
  in_stock: 'En stock',
  to_order: 'À commander',
  ordered: 'Commandé',
  delivered: 'Livré',
};

const BAT_STATUS_LABELS: Record<string, string> = {
  none: 'Pas de BAT',
  waiting_files: 'Attente fichiers',
  files_received: 'Fichiers reçus',
  bat_sent: 'BAT envoyé',
  bat_approved: 'BAT validé',
};

const PLATES_STATUS_LABELS: Record<string, string> = {
  none: 'Pas de plaques',
  to_make: 'À faire',
  ready: 'Prêtes',
};

const FORME_STATUS_LABELS: Record<string, string> = {
  none: 'Pas de forme',
  in_stock: 'Sur stock',
  to_order: 'À commander',
  ordered: 'Commandée',
  delivered: 'Livrée',
};

interface TooltipItem {
  key: string;
  label: string;
  statusLabel: string;
  isReady: boolean;
  date?: string;
}

function buildPaperItem(paper: PrerequisiteBlockingInfo['paper']): TooltipItem | null {
  if (paper.status === 'none' && paper.isReady) return null;
  let date: string | undefined;
  if (paper.status === 'delivered') date = formatDateDDMMYYYY(paper.deliveredAt);
  else if (paper.status === 'ordered') date = formatDateDDMMYYYY(paper.orderedAt);
  return {
    key: 'paper',
    label: PREREQ_LABELS.paper,
    statusLabel: PAPER_STATUS_LABELS[paper.status] || paper.status,
    isReady: paper.isReady,
    date,
  };
}

function buildBatItem(bat: PrerequisiteBlockingInfo['bat']): TooltipItem | null {
  if (bat.status === 'none' && bat.isReady) return null;
  let date: string | undefined;
  if (bat.status === 'bat_approved') date = formatDateDDMMYYYY(bat.approvedAt);
  else if (bat.status === 'bat_sent') date = formatDateDDMMYYYY(bat.sentAt);
  else if (bat.status === 'files_received') date = formatDateDDMMYYYY(bat.filesReceivedAt);
  return {
    key: 'bat',
    label: PREREQ_LABELS.bat,
    statusLabel: BAT_STATUS_LABELS[bat.status] || bat.status,
    isReady: bat.isReady,
    date,
  };
}

function buildPlatesItem(plates: PrerequisiteBlockingInfo['plates']): TooltipItem | null {
  if (plates.status === 'none' && plates.isReady) return null;
  return {
    key: 'plates',
    label: PREREQ_LABELS.plates,
    statusLabel: PLATES_STATUS_LABELS[plates.status] || plates.status,
    isReady: plates.isReady,
  };
}

function buildFormeItem(forme: PrerequisiteBlockingInfo['forme']): TooltipItem | null {
  if (forme.status === 'none' && forme.isReady) return null;
  let date: string | undefined;
  if (forme.status === 'delivered') date = formatDateDDMMYYYY(forme.deliveredAt);
  else if (forme.status === 'ordered') date = formatDateDDMMYYYY(forme.orderedAt);
  return {
    key: 'forme',
    label: PREREQ_LABELS.forme,
    statusLabel: FORME_STATUS_LABELS[forme.status] || forme.status,
    isReady: forme.isReady,
    date,
  };
}

function buildPrerequisiteItems(blockingInfo: PrerequisiteBlockingInfo): TooltipItem[] {
  return [
    buildPaperItem(blockingInfo.paper),
    buildBatItem(blockingInfo.bat),
    buildPlatesItem(blockingInfo.plates),
    buildFormeItem(blockingInfo.forme),
  ].filter((item): item is TooltipItem => item !== null);
}

// ─── Spec section helpers ───────────────────────────────────────────────────

interface SpecRow {
  label: string;
  value: string;
}

function buildSpecRows(spec: Element['spec']): SpecRow[] {
  if (!spec) return [];
  const rows: SpecRow[] = [];

  if (spec.format != null) {
    rows.push({ label: 'Format', value: spec.format });
  }
  if (spec.papier != null) {
    const parsed = parsePapierDSL(spec.papier);
    const value = parsed.grammage ? `${parsed.type} ${parsed.grammage}` : parsed.type;
    rows.push({ label: 'Papier', value });
  }
  if (spec.pagination != null) {
    rows.push({ label: 'Pagination', value: `${spec.pagination}p` });
  }
  if (spec.imposition != null) {
    rows.push({ label: 'Imposition', value: spec.imposition });
  }
  if (spec.impression != null) {
    rows.push({ label: 'Impression', value: spec.impression });
  }
  if (spec.surfacage != null) {
    rows.push({ label: 'Surfaçage', value: spec.surfacage });
  }
  if (spec.quantite != null) {
    rows.push({ label: 'Quantité', value: `${spec.quantite}ex` });
  }
  if (spec.qteFeuilles != null) {
    rows.push({ label: 'Qté feuilles', value: `${spec.qteFeuilles}F` });
  }
  if (spec.autres != null) {
    rows.push({ label: 'Autres', value: spec.autres });
  }

  return rows;
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * TileTooltip - Rich tooltip displayed above tile after 500ms hover.
 * Shows job info, spec details, prerequisites, task times, and schedule.
 */
export const TileTooltip = memo(function TileTooltip({
  isVisible,
  job,
  element,
  task,
  assignment,
  blockingInfo,
}: TileTooltipProps) {
  if (!isVisible) return null;

  const specRows = buildSpecRows(element?.spec);
  const prerequisiteItems = blockingInfo ? buildPrerequisiteItems(blockingInfo) : [];
  const { setupMinutes, runMinutes } = task.duration;

  const startFormatted = formatScheduleDateTime(assignment.scheduledStart);
  const endFormatted = formatScheduleDateTime(assignment.scheduledEnd);
  const deadlineFormatted = job.workshopExitDate
    ? formatDateDDMMYYYY(job.workshopExitDate)
    : undefined;

  return (
    <div
      className="absolute left-0 bottom-full mb-2 z-50 pointer-events-none w-72"
      data-testid="tile-tooltip"
    >
      <div className="bg-slate-800 border border-white/10 rounded-lg shadow-xl px-3 py-2.5 text-xs text-zinc-100 space-y-2">

        {/* Header: reference — client */}
        <div data-testid="tile-tooltip-header">
          <span className="font-bold text-white">{job.reference}</span>
          <span className="text-zinc-400"> — {job.client}</span>
        </div>

        {/* Description (only if non-empty) */}
        {job.description && (
          <div className="italic text-zinc-300" data-testid="tile-tooltip-description">
            {job.description}
          </div>
        )}

        {/* Deadline */}
        {deadlineFormatted && (
          <div className="text-zinc-400" data-testid="tile-tooltip-deadline">
            Sortie atelier: <span className="text-zinc-200">{deadlineFormatted}</span>
          </div>
        )}

        {/* Spec rows */}
        {specRows.length > 0 && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5" data-testid="tile-tooltip-spec">
            {specRows.map((row) => (
              <div key={row.label} className="contents">
                <span className="text-zinc-500">{row.label}:</span>
                <span className="text-zinc-200">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Prerequisites (only when there are non-"none" fields) */}
        {prerequisiteItems.length > 0 && (
          <div className="space-y-0.5 border-t border-white/10 pt-1.5" data-testid="tile-tooltip-prerequisites">
            {prerequisiteItems.map((item) => (
              <div key={item.key} className="flex items-center gap-1.5">
                <span className={item.isReady ? 'text-green-400' : 'text-amber-400'}>
                  {item.isReady ? '✓' : '⚠'}
                </span>
                <span className="text-zinc-400">{item.label}:</span>
                <span className={item.isReady ? 'text-zinc-300' : 'text-amber-200'}>
                  {item.statusLabel}
                </span>
                {item.date && (
                  <span className="text-zinc-500 ml-0.5">{item.date}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Task: setup + run times */}
        <div className="text-zinc-400 border-t border-white/10 pt-1.5" data-testid="tile-tooltip-task">
          Setup: <span className="text-zinc-200">{setupMinutes}min</span>
          {' · '}
          Run: <span className="text-zinc-200">{runMinutes}min</span>
        </div>

        {/* Schedule: start → end */}
        {startFormatted && endFormatted && (
          <div className="text-zinc-400" data-testid="tile-tooltip-schedule">
            <span className="text-zinc-200">{startFormatted}</span>
            {' → '}
            <span className="text-zinc-200">{endFormatted}</span>
          </div>
        )}
      </div>

      {/* Arrow pointing down */}
      <div className="absolute left-4 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800" />
    </div>
  );
});

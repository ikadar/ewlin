import { memo, useState } from 'react';
import { CircleCheck, Circle, Trash2, FolderOpen, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
  type FluxJob,
  type FluxElement,
  type FluxSTStatus,
  type PrerequisiteColumn,
  type PrerequisiteStatus,
} from './fluxTypes';
import { STCell } from './STCell';
import type { StationCategoryResponse } from '@/store/api/stationCategoryApi';
import {
  worstPrerequisiteStatus,
  getMultiElementStationData,
  sortStationDataBySeverity,
  getFluxJobStatus,
} from './fluxAggregation';
import { FluxJobStatusDot } from './FluxJobStatusDot';
import { FluxPrerequisiteBadge } from './FluxPrerequisiteBadge';
import { FluxPrerequisiteListbox } from './FluxPrerequisiteListbox';
import { FluxStationIndicator } from './FluxStationIndicator';
import { FluxStackedDots } from './FluxStackedDots';
import { TransporteurCell } from './TransporteurCell';
import { FluxTableContext, useFluxTableContext } from './FluxTableContext';
import { type SortColumn, type SortDirection } from './fluxSort';
import type { ShipperResponse } from '@/store/api/shipperApi';

/** Format batDeadline ISO string as "JJ/MM" and compute "J-X" countdown. */
function formatBatDeadlineCell(iso: string | null | undefined): { date: string; countdown: string; urgencyClass: string } | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  const deadlineDate = new Date(parseInt(year!, 10), parseInt(month!, 10) - 1, parseInt(day!, 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((deadlineDate.getTime() - today.getTime()) / 86400000);
  const date = `${day}/${month}`;
  let countdown: string;
  let urgencyClass: string;
  if (diffDays > 3) {
    countdown = `J-${diffDays}`;
    urgencyClass = 'text-zinc-500';
  } else if (diffDays === 3) {
    countdown = 'J-3';
    urgencyClass = 'dl-bat-j3';
  } else if (diffDays === 2) {
    countdown = 'J-2';
    urgencyClass = 'dl-bat-j2';
  } else if (diffDays === 1) {
    countdown = 'J-1';
    urgencyClass = 'dl-bat-j1 font-semibold';
  } else if (diffDays === 0) {
    countdown = 'J-0';
    urgencyClass = 'dl-bat-overdue font-semibold';
  } else {
    countdown = `J+${Math.abs(diffDays)}`;
    urgencyClass = 'dl-bat-overdue font-semibold';
  }
  return { date, countdown, urgencyClass };
}

/** Get the relevant status change date for a prerequisite column based on current status. */
function getPrerequisiteDate(element: FluxElement, column: PrerequisiteColumn): string | null {
  switch (column) {
    case 'bat':
      switch (element.bat) {
        case 'files_received': return element.filesReceivedAt ?? null;
        case 'bat_sent':       return element.batSentAt ?? null;
        case 'bat_approved':   return element.batApprovedAt ?? null;
        default: return null;
      }
    case 'papier':
      switch (element.papier) {
        case 'ordered':   return element.paperOrderedAt ?? null;
        case 'delivered': return element.paperDeliveredAt ?? null;
        default: return null;
      }
    case 'formes':
      switch (element.formes) {
        case 'ordered':   return element.formeOrderedAt ?? null;
        case 'delivered': return element.formeDeliveredAt ?? null;
        default: return null;
      }
    default: return null;
  }
}

interface FluxTableProps {
  jobs: FluxJob[];
  /** Station categories for dynamic column headers (ordered by displayOrder). */
  categories?: StationCategoryResponse[];
  /** Job ID of the keyboard-focused parent row (Alt+↑/↓ navigation). */
  focusedJobId?: string;
  /** Set of job IDs that are currently expanded (multi-element only). */
  expandedJobIds?: Set<string>;
  /** Active sort column (v0.5.21). Defaults to 'id'. */
  sortColumn?: SortColumn;
  /** Active sort direction (v0.5.21). Defaults to 'asc'. */
  sortDirection?: SortDirection;
  /** Called when the user clicks a sortable column header (v0.5.21). */
  onSortChange?: (column: SortColumn) => void;
  onUpdatePrerequisite?: (
    jobId: string,
    elementId: string,
    column: PrerequisiteColumn,
    status: PrerequisiteStatus,
  ) => void;
  /** Update an outsourced task's ST status (v0.5.23). */
  onUpdateSTStatus?: (taskId: string, status: FluxSTStatus) => void;
  onToggleExpand?: (jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
  onEditJob?: (jobId: string) => void;
  /** Update a job's shipper (transporteur). */
  onUpdateShipper?: (jobInternalId: string, shipperId: string | null) => void;
  /** Available shippers for the inline dropdown. */
  shippers?: ShipperResponse[];
  /** Toggle a job's shipped (Parti) status. */
  onToggleShipped?: (jobInternalId: string, shipped: boolean) => void;
  /** Toggle a job's invoiced (Facturé) status. */
  onToggleInvoiced?: (jobInternalId: string, invoiced: boolean) => void;
  /** Open scheduler in new tab scrolled to the given task (F9). */
  onStationClick?: (taskId: string) => void;
  /** Job IDs (internal UUIDs) that are late (from schedule snapshot). */
  lateJobIds?: Set<string>;
  /** Job IDs (internal UUIDs) that have scheduling conflicts (excluding DeadlineConflict). */
  conflictJobIds?: Set<string>;
}

// Frozen zone shadow styles (spec 3.6) — uses CSS variable for theme adaptability
const LEFT_SHADOW = { boxShadow: '4px 0 8px -2px var(--flux-frozen-shadow)' } as const;
const RIGHT_SHADOW = { boxShadow: '-4px 0 8px -2px var(--flux-frozen-shadow)' } as const;

// Shared sticky cell classes for left-frozen columns
const stickyCell = 'sticky z-20 bg-flux-elevated group-hover:bg-flux-hover';
// Sub-row sticky cells use a slightly lighter background (spec: dark-surface)
const subRowStickyCell = 'sticky z-20 bg-flux-surface group-hover:bg-flux-hover/50';
// Header sticky cells match the header background (bg-flux-hover)
const stickyHeaderCell = 'sticky z-30 bg-flux-hover';

/**
 * Sort indicator chevron for a column header (v0.5.21).
 * - Active ascending: single up arrow, blue, always visible.
 * - Active descending: single down arrow, blue, always visible.
 * - Inactive sortable: double chevron, opacity-0, appears on group-hover.
 */
function SortChevron({ col, active, dir }: { col: SortColumn; active: SortColumn; dir: SortDirection }) {
  const isActive = col === active;
  if (!isActive) {
    return (
      <ChevronsUpDown
        className="w-3 h-3 text-flux-text-muted opacity-0 group-hover:opacity-100 transition-opacity inline ml-0.5"
        strokeWidth={2}
      />
    );
  }
  if (dir === 'asc') {
    return (
      <ChevronUp
        className="w-3 h-3 text-blue-400 inline ml-0.5"
        strokeWidth={2.5}
      />
    );
  }
  return (
    <ChevronDown
      className="w-3 h-3 text-blue-400 inline ml-0.5"
      strokeWidth={2.5}
    />
  );
}

/**
 * Header row for the Flux table.
 * Sortable columns show a chevron indicator; clicking triggers onSortChange.
 * Parti and Actions are not sortable (spec 3.6).
 */
function FluxTableHeader() {
  const ctx = useFluxTableContext();
  const { sortColumn, sortDirection, onSortChange } = ctx;
  const headerCell = 'px-2 py-3 text-left text-sm font-medium whitespace-nowrap text-flux-text-secondary';
  const sortableHeader = `${headerCell} group cursor-pointer select-none`;
  // Prerequisite column headers: centered, tighter padding (mockup2 spec)
  const prereqHeader = 'px-1 py-3 text-center text-sm font-medium whitespace-nowrap text-flux-text-secondary group cursor-pointer select-none';

  return (
    <thead className="sticky top-0 z-30 bg-flux-hover">
      <tr className="bg-flux-hover border-b border-flux-border">
        {/* Expand — frozen left, no header */}
        <th className={`${stickyHeaderCell} left-0 w-6 py-3`} />
        {/* Status dot — frozen left, no header */}
        <th className={`${stickyHeaderCell} left-6 py-3`} />
        {/* ID — frozen left */}
        <th
          className={`${stickyHeaderCell} left-10 ${sortableHeader}`}
          title="Identifiant"
          onClick={() => onSortChange('id')}
        >
          ID <SortChevron col="id" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Client — frozen left */}
        <th
          className={`${stickyHeaderCell} left-[7.5rem] ${sortableHeader}`}
          title="Client"
          onClick={() => onSortChange('client')}
        >
          Client <SortChevron col="client" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Designation — frozen left + right shadow */}
        <th
          className={`${stickyHeaderCell} left-[16.5rem] ${sortableHeader}`}
          style={LEFT_SHADOW}
          title="Désignation"
          onClick={() => onSortChange('designation')}
        >
          Désignation <SortChevron col="designation" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Référent */}
        <th
          className={sortableHeader}
          title="Référent"
          onClick={() => onSortChange('referent')}
        >
          Référent <SortChevron col="referent" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Sortie */}
        <th
          className={sortableHeader}
          title="Date de sortie atelier"
          onClick={() => onSortChange('sortie')}
        >
          Sortie <SortChevron col="sortie" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Prerequisite columns — centered, px-1 (mockup2 spec) */}
        <th
          className={prereqHeader}
          title="Bon à tirer"
          onClick={() => onSortChange('bat')}
        >
          <div className="flex items-center justify-center gap-1">
            BAT <SortChevron col="bat" active={sortColumn} dir={sortDirection} />
          </div>
        </th>
        <th
          className={prereqHeader}
          title="Deadline BAT"
        >
          <div className="flex items-center justify-center gap-1">
            D.L. BAT
          </div>
        </th>
        <th
          className={prereqHeader}
          title="Papier"
          onClick={() => onSortChange('papier')}
        >
          <div className="flex items-center justify-center gap-1">
            Papier <SortChevron col="papier" active={sortColumn} dir={sortDirection} />
          </div>
        </th>
        <th
          className={prereqHeader}
          title="Formes"
          onClick={() => onSortChange('formes')}
        >
          <div className="flex items-center justify-center gap-1">
            Formes <SortChevron col="formes" active={sortColumn} dir={sortDirection} />
          </div>
        </th>
        <th
          className={prereqHeader}
          title="Plaques"
          onClick={() => onSortChange('plaques')}
        >
          <div className="flex items-center justify-center gap-1">
            Plaques <SortChevron col="plaques" active={sortColumn} dir={sortDirection} />
          </div>
        </th>
        {/* Station columns — dynamic from API, not sortable (mockup2 spec) */}
        {ctx.categories.map(cat => (
          <th
            key={cat.id}
            className="px-0 py-3 text-center font-medium whitespace-nowrap text-flux-text-secondary border-l border-flux-border"
            style={{ fontSize: '11px' }}
            title={cat.name}
          >
            {cat.abbreviation || cat.name.substring(0, 5)}
          </th>
        ))}
        {/* ST (Sous-traitance) — not sortable, hover for visual consistency (mockup2 spec) */}
        <th
          className={`${headerCell} group cursor-pointer select-none hover:bg-flux-active`}
          title="Sous-traitance"
        >
          <div className="flex items-center gap-1 whitespace-nowrap">ST</div>
        </th>
        {/* Transporteur */}
        <th
          className={sortableHeader}
          title="Transporteur"
          onClick={() => onSortChange('transporteur')}
        >
          Transp. <SortChevron col="transporteur" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Parti — not sortable (K5.1 deferred), hover for visual consistency (mockup2 spec) */}
        <th
          className={`${headerCell} group cursor-pointer select-none hover:bg-flux-active`}
          title="Statut d'expédition"
        >
          <div className="flex items-center gap-1 whitespace-nowrap">Parti</div>
        </th>
        {/* Facturé — not sortable, hover for visual consistency */}
        <th
          className={`${headerCell} group cursor-pointer select-none hover:bg-flux-active`}
          title="Statut de facturation"
        >
          <div className="flex items-center gap-1 whitespace-nowrap">Facturé</div>
        </th>
        {/* Actions — frozen right + left shadow */}
        <th
          className={`${stickyHeaderCell} right-0 px-4 py-3 text-left text-sm font-medium text-flux-text-secondary`}
          style={RIGHT_SHADOW}
        >
          Actions
        </th>
      </tr>
    </thead>
  );
}

/**
 * A single parent job row. Multi-element rows show aggregated worst values
 * and stacked dots in station cells (collapsed state, spec 3.11).
 * v0.5.17: expand toggle, listbox for single-element, action callbacks.
 */
const FluxTableRow = memo(function FluxTableRow({
  job,
  isFocused,
}: {
  job: FluxJob;
  isFocused: boolean;
}) {
  const ctx = useFluxTableContext();
  const isMulti = job.elements.length > 1;
  const isExpanded = isMulti && ctx.expandedJobIds.has(job.id);
  const el0 = job.elements[0] as FluxElement;

  // Prerequisite values — aggregated for multi-element, direct for single
  const bat    = isMulti ? worstPrerequisiteStatus(job.elements.map(e => e.bat))    : el0.bat;
  const papier = isMulti ? worstPrerequisiteStatus(job.elements.map(e => e.papier)) : el0.papier;
  const formes = isMulti ? worstPrerequisiteStatus(job.elements.map(e => e.formes)) : el0.formes;
  const plaques= isMulti ? worstPrerequisiteStatus(job.elements.map(e => e.plaques)): el0.plaques;

  // +N count only when collapsed (sub-rows show individual elements when expanded)
  const plusCount = isMulti && !isExpanded ? job.elements.length - 1 : undefined;

  // Job-level status for dot + row tint
  const jobStatus = getFluxJobStatus(job, ctx.lateJobIds, ctx.conflictJobIds);

  // Row background tint: subtle rgba on <tr>, opaque mix on sticky cells
  // flux-elevated = rgb(36,36,36). We blend the status color at ~5%.
  const ROW_TINT: Record<string, { tr: string; sticky: string }> = {
    late:     { tr: 'var(--flux-late-row-bg)', sticky: 'var(--flux-late-sticky-bg)' },
    conflict: { tr: 'var(--flux-conflict-row-bg)', sticky: 'var(--flux-conflict-sticky-bg)' },
  };
  const tint = jobStatus ? ROW_TINT[jobStatus] : null;

  const cellBase = `${stickyCell} px-4 py-0 text-sm text-flux-text-secondary`;
  const stickyBg = tint ? { backgroundColor: tint.sticky } : undefined;

  // Left border style reflects expanded state
  const expandCellStyle = isMulti
    ? { borderLeft: isExpanded ? '3px solid rgba(99,102,241,1)' : '3px solid rgba(99,102,241,0.25)', ...stickyBg }
    : stickyBg;

  // Row background: status tint > focus tint > none
  const rowBg = isFocused ? 'rgba(99,102,241,0.08)' : tint?.tr;

  return (
    <tr
      className={`border-b border-flux-border group transition-colors cursor-pointer hover:bg-flux-hover ${isMulti ? 'row-multi' : ''} ${isFocused ? 'ring-1 ring-inset ring-indigo-500/40' : ''}`}
      style={{
        height: '2.25rem',
        backgroundColor: rowBg,
      }}
      data-testid="flux-table-row"
      data-job-id={job.id}
      data-flux-focused={isFocused ? 'true' : undefined}
      data-late-row={jobStatus === 'late' ? 'true' : undefined}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, select, [role="listbox"], [role="option"], a')) return;
        if (isMulti) ctx.onToggleExpand(job.id);
      }}
    >
      {/* Expand toggle — frozen left */}
      <td
        className={`${stickyCell} left-0 text-center`}
        style={expandCellStyle}
      >
        {isMulti && (
          <button
            className={`inline-flex items-center justify-center w-[14px] h-[14px] rounded-[3px] border font-mono font-semibold leading-none transition-colors ${
              isExpanded
                ? 'border-indigo-500/60 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50'
                : 'border-flux-border-light bg-transparent text-flux-text-muted hover:bg-flux-active hover:border-flux-text-muted hover:text-flux-text-secondary'
            }`}
            style={{ fontSize: '11px' }}
            onClick={() => ctx.onToggleExpand(job.id)}
            aria-label={isExpanded ? 'Réduire les éléments' : 'Développer les éléments'}
            aria-expanded={isExpanded}
            data-testid="flux-expand-toggle"
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
      </td>

      {/* Status dot — frozen left */}
      <td className={`${stickyCell} left-6 py-0`} style={stickyBg}>
        <div className="flex items-center justify-center h-full">
          <FluxJobStatusDot status={jobStatus} />
        </div>
      </td>

      {/* ID — frozen left */}
      <td className={`${stickyCell} left-10 px-4 py-0 text-sm text-flux-text-primary font-mono font-medium whitespace-nowrap`} style={stickyBg}>
        {job.id}
      </td>

      {/* Client — frozen left */}
      <td className={`${cellBase} left-[7.5rem] whitespace-nowrap`} style={stickyBg}>
        {job.client}
      </td>

      {/* Designation — frozen left + right shadow */}
      <td
        className={`${cellBase} left-[16.5rem]`}
        style={tint ? { ...LEFT_SHADOW, backgroundColor: tint.sticky } : LEFT_SHADOW}
        data-testid="flux-designation"
      >
        {job.designation}
        {isMulti && (
          <span className="ml-1 text-flux-text-muted" style={{ fontSize: '10px' }}>
            ({job.elements.length})
          </span>
        )}
      </td>

      {/* Référent */}
      <td className="px-2 py-0 text-sm text-flux-text-secondary whitespace-nowrap">
        {job.referent ?? ''}
      </td>

      {/* Sortie */}
      <td className="px-2 py-0 text-sm text-flux-text-secondary whitespace-nowrap">
        {job.sortie}
      </td>

      {/* Prerequisite badge/listbox cells */}
      {(['bat', 'papier', 'formes', 'plaques'] as PrerequisiteColumn[]).map((col, i) => {
        const status = [bat, papier, formes, plaques][i]!;
        const date = !isMulti ? getPrerequisiteDate(el0, col) : null;
        const cell = isMulti && isExpanded ? (
          <td key={col} className="px-1 py-0" />
        ) : isMulti ? (
          <td key={col} className="px-1 py-0">
            <FluxPrerequisiteBadge status={status} plusCount={plusCount} />
          </td>
        ) : (
          <td key={col} className="p-0">
            <FluxPrerequisiteListbox
              jobId={job.id}
              elementId={el0.id}
              column={col}
              status={status}
              date={date}
            />
          </td>
        );
        // Insert DL BAT cell right after BAT column
        if (col === 'bat') {
          const dl = formatBatDeadlineCell(job.batDeadline);
          return [
            cell,
            <td key="dl-bat" className="px-1 py-0 whitespace-nowrap text-center">
              {dl ? (
                <span className="inline-flex items-center gap-1">
                  <span className="text-sm text-flux-text-secondary">{dl.date}</span>
                  <span className={`text-sm font-mono ${dl.urgencyClass}`}>{dl.countdown}</span>
                </span>
              ) : ''}
            </td>,
          ];
        }
        return cell;
      })}

      {/* Station cells — dynamic from API */}
      {ctx.categories.map(cat => {
        const singleTaskId = !isMulti ? el0.stations[cat.id]?.taskId : undefined;
        const clickable = singleTaskId && ctx.onStationClick;
        return (
          <td
            key={cat.id}
            className={`p-0 text-center border-l border-flux-border${clickable ? ' cursor-pointer' : ''}`}
            style={{ lineHeight: 0, verticalAlign: 'middle' }}
            data-testid={`flux-station-${cat.id}`}
            onClick={clickable ? () => ctx.onStationClick!(singleTaskId) : undefined}
          >
            {isMulti && !isExpanded ? (
              <FluxStackedDots
                data={sortStationDataBySeverity(
                  getMultiElementStationData(job.elements, cat.id)
                )}
                stationName={cat.name}
              />
            ) : !isMulti ? (
              <FluxStationIndicator
                data={el0.stations[cat.id]}
                stationName={cat.name}
              />
            ) : null}
          </td>
        );
      })}

      {/* ST (Sous-traitance) — empty when expanded, flattened for collapsed multi, single element otherwise */}
      <td className="px-1.5 py-0" style={{ maxWidth: '160px', verticalAlign: 'middle' }} data-testid="flux-st-cell">
        {!isExpanded && (
          <STCell
            tasks={isMulti
              ? job.elements.flatMap(e => e.outsourcing)
              : el0.outsourcing}
            onUpdateSTStatus={ctx.onUpdateSTStatus}
          />
        )}
      </td>

      {/* Transporteur */}
      <td className="px-2 py-0 text-sm text-flux-text-secondary whitespace-nowrap">
        {ctx.onUpdateShipper && ctx.shippers ? (
          <TransporteurCell
            jobInternalId={job.internalId}
            jobId={job.id}
            currentValue={job.transporteur}
            shippers={ctx.shippers}
            onUpdateShipper={ctx.onUpdateShipper}
          />
        ) : (
          job.transporteur ?? '—'
        )}
      </td>

      {/* Parti — clickable toggle */}
      <td className="px-2 py-0 whitespace-nowrap">
        <button
          type="button"
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
          onClick={() => ctx.onToggleShipped?.(job.internalId, !job.parti.shipped)}
          title={job.parti.shipped ? 'Marquer comme non expédié' : 'Marquer comme expédié'}
        >
          {job.parti.shipped ? (
            <>
              <CircleCheck className="w-4 h-4 text-emerald-500" strokeWidth={2} />
              {job.parti.date && (
                <span className="text-flux-text-muted" style={{ fontSize: '11px' }}>
                  {job.parti.date}
                </span>
              )}
            </>
          ) : (
            <Circle className="w-4 h-4 text-zinc-600" strokeWidth={2} />
          )}
        </button>
      </td>

      {/* Facturé — clickable toggle */}
      <td className="px-2 py-0 whitespace-nowrap">
        <button
          type="button"
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
          onClick={() => ctx.onToggleInvoiced?.(job.internalId, !job.facture.invoiced)}
          title={job.facture.invoiced ? 'Marquer comme non facturé' : 'Marquer comme facturé'}
        >
          {job.facture.invoiced ? (
            <>
              <CircleCheck className="w-4 h-4 text-emerald-500" strokeWidth={2} />
              {job.facture.date && (
                <span className="text-flux-text-muted" style={{ fontSize: '11px' }}>
                  {job.facture.date}
                </span>
              )}
            </>
          ) : (
            <Circle className="w-4 h-4 text-zinc-600" strokeWidth={2} />
          )}
        </button>
      </td>

      {/* Actions — frozen right */}
      <td
        className={`${stickyCell} right-0 px-4 py-0`}
        style={tint ? { ...RIGHT_SHADOW, backgroundColor: tint.sticky } : RIGHT_SHADOW}
      >
        <div className="flex items-center gap-2">
          <button
            className="text-red-400 hover:text-red-300 transition-colors"
            onClick={() => ctx.onDeleteJob(job.id)}
            title="Supprimer"
            data-testid="flux-action-delete"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            className="text-blue-400 hover:text-blue-300 transition-colors"
            onClick={() => ctx.onEditJob(job.id)}
            title="Éditer"
            data-testid="flux-action-edit"
          >
            <FolderOpen className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
});

/**
 * Sub-row for one element of a multi-element job (shown when expanded, spec 3.11).
 * v0.5.17: animated entry, interactive prerequisite listboxes (qa.md K8.1).
 */
function FluxSubRow({
  job,
  element,
  index,
}: {
  job: FluxJob;
  element: FluxElement;
  index: number;
}) {
  const ctx = useFluxTableContext();
  const isLate = job.internalId ? ctx.lateJobIds.has(job.internalId) : false;
  return (
    <tr
      className="border-b border-flux-border group transition-colors hover:bg-flux-hover/50"
      style={{
        height: '2rem',
        animation: `flux-subrow-in 400ms cubic-bezier(0.25, 1, 0.5, 1) both`,
        animationDelay: `${index * 30}ms`,
      }}
      data-testid="flux-sub-row"
      data-job-id={job.id}
      data-element-id={element.id}
      data-late-row={isLate ? 'true' : undefined}
    >
      {/* Expand — indigo border (visual continuation) */}
      <td
        className={`${subRowStickyCell} left-0`}
        style={{ borderLeft: '3px solid rgb(99,102,241)' }}
      />

      {/* Status dot — empty */}
      <td className={`${subRowStickyCell} left-6`} />

      {/* ID — empty */}
      <td className={`${subRowStickyCell} left-10`} />

      {/* Client — empty */}
      <td className={`${subRowStickyCell} left-[7.5rem]`} />

      {/* Designation — label with arrow prefix */}
      <td
        className={`${subRowStickyCell} left-[16.5rem] px-4 py-0 text-flux-text-tertiary`}
        style={LEFT_SHADOW}
        data-testid="flux-sub-designation"
      >
        <span className="text-xs pl-4 text-flux-text-muted">↳ {element.label}</span>
      </td>

      {/* Référent — empty */}
      <td />

      {/* Sortie — empty */}
      <td />

      {/* Prerequisite listbox cells */}
      {(['bat', 'papier', 'formes', 'plaques'] as PrerequisiteColumn[]).map(col => {
        const cell = (
          <td key={col} className="p-0">
            <FluxPrerequisiteListbox
              jobId={job.id}
              elementId={element.id}
              column={col}
              status={element[col]}
              compact
              date={getPrerequisiteDate(element, col)}
            />
          </td>
        );
        if (col === 'bat') {
          return [cell, <td key="dl-bat" />];
        }
        return cell;
      })}

      {/* Station cells — dynamic from API */}
      {ctx.categories.map(cat => {
        const taskId = element.stations[cat.id]?.taskId;
        const clickable = taskId && ctx.onStationClick;
        return (
          <td
            key={cat.id}
            className={`p-0 text-center border-l border-flux-border${clickable ? ' cursor-pointer' : ''}`}
            style={{ lineHeight: 0, verticalAlign: 'middle' }}
            onClick={clickable ? () => ctx.onStationClick!(taskId) : undefined}
          >
            <FluxStationIndicator
              data={element.stations[cat.id]}
              stationName={cat.name}
            />
          </td>
        );
      })}

      {/* ST — per-element tasks */}
      <td className="px-1.5 py-0" style={{ maxWidth: '160px', verticalAlign: 'middle' }}>
        <STCell
          tasks={element.outsourcing}
          onUpdateSTStatus={ctx.onUpdateSTStatus}
        />
      </td>

      {/* Transporteur — empty */}
      <td />

      {/* Parti — empty */}
      <td />

      {/* Facturé — empty */}
      <td />

      {/* Actions — empty (frozen right placeholder) */}
      <td
        className={`${subRowStickyCell} right-0`}
        style={RIGHT_SHADOW}
      />
    </tr>
  );
}

/**
 * Production Flow Dashboard table.
 * Horizontally scrollable with frozen left and right column zones.
 * v0.5.17: interactive prerequisite listboxes, expand/collapse, action callbacks.
 * v0.5.21: sortable column headers, webkit scrollbar.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, sections 3.6–3.14
 */
export const FluxTable = memo(function FluxTable({
  jobs,
  categories = [],
  focusedJobId,
  expandedJobIds = new Set<string>(),
  sortColumn = 'id',
  sortDirection = 'asc',
  onSortChange = () => {},
  onUpdatePrerequisite = () => {},
  onUpdateSTStatus = () => {},
  onToggleExpand = () => {},
  onDeleteJob = () => {},
  onEditJob = () => {},
  onUpdateShipper,
  shippers = [],
  onToggleShipped,
  onToggleInvoiced,
  onStationClick,
  lateJobIds = new Set<string>(),
  conflictJobIds = new Set<string>(),
}: FluxTableProps) {
  // openListboxId is managed here to coordinate "only one listbox open at a time"
  const [openListboxId, setOpenListboxId] = useState<string | null>(null);

  const ctxValue = {
    categories,
    openListboxId,
    setOpenListboxId,
    onUpdatePrerequisite,
    onUpdateSTStatus,
    onToggleExpand,
    onDeleteJob,
    onEditJob,
    onUpdateShipper,
    shippers,
    onToggleShipped,
    onToggleInvoiced,
    expandedJobIds,
    sortColumn,
    sortDirection,
    onSortChange,
    onStationClick,
    lateJobIds,
    conflictJobIds,
  };

  return (
    <FluxTableContext.Provider value={ctxValue}>
      <div
        className="h-full overflow-auto scrollbar-visible"
      >
        <table
          className="w-full table-fixed"
          style={{ minWidth: '1440px', fontSize: '13px' }}
          data-testid="flux-table"
        >
          <colgroup>
            <col style={{ width: '1.5rem' }} />
            <col style={{ width: '1rem' }} />
            <col style={{ width: '5rem' }} />
            <col style={{ width: '9rem' }} />
            <col style={{ width: '16rem' }} />
            <col style={{ width: '7rem' }} />
            <col style={{ width: '6rem' }} />
            <col style={{ width: '8.5rem' }} />
            <col style={{ width: '8.5rem' }} />
            <col style={{ width: '8.5rem' }} />
            <col style={{ width: '8.5rem' }} />
            <col style={{ width: '6rem' }} />
            {categories.map(cat => (
              <col key={cat.id} style={{ width: '3.5rem' }} />
            ))}
            <col style={{ width: '14rem' }} />
            <col style={{ width: '6rem' }} />
            <col style={{ width: '7rem' }} />
            <col style={{ width: '7rem' }} />
            <col style={{ width: '4rem' }} />
          </colgroup>

          <FluxTableHeader />

          <tbody className="divide-y divide-flux-border">
            {jobs.flatMap(job => {
              const isExpanded = expandedJobIds.has(job.id);
              const rows: React.ReactNode[] = [
                <FluxTableRow
                  key={job.id}
                  job={job}
                  isFocused={focusedJobId === job.id}
                />,
              ];
              if (isExpanded && job.elements.length > 1) {
                job.elements.forEach((el, idx) => {
                  rows.push(
                    <FluxSubRow
                      key={`${job.id}-${el.id}`}
                      job={job}
                      element={el}
                      index={idx}
                    />,
                  );
                });
              }
              return rows;
            })}
          </tbody>
        </table>
      </div>
    </FluxTableContext.Provider>
  );
});

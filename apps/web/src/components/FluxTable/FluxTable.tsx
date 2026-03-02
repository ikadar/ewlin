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
} from './fluxAggregation';
import { FluxPrerequisiteBadge } from './FluxPrerequisiteBadge';
import { FluxPrerequisiteListbox } from './FluxPrerequisiteListbox';
import { FluxStationIndicator } from './FluxStationIndicator';
import { FluxStackedDots } from './FluxStackedDots';
import { FluxTableContext, useFluxTableContext } from './FluxTableContext';
import { type SortColumn, type SortDirection } from './fluxSort';

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
}

// Frozen zone shadow styles (spec 3.6)
const LEFT_SHADOW = { boxShadow: '4px 0 8px -2px rgba(0,0,0,0.3)' } as const;
const RIGHT_SHADOW = { boxShadow: '-4px 0 8px -2px rgba(0,0,0,0.3)' } as const;

// Shared sticky cell classes for left-frozen columns
const stickyCell = 'sticky z-20 bg-flux-elevated';

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
 * Station columns, Parti, and Actions are not sortable (spec 3.6).
 */
function FluxTableHeader() {
  const ctx = useFluxTableContext();
  const { sortColumn, sortDirection, onSortChange } = ctx;
  const headerCell = 'px-2 py-3 text-left font-medium whitespace-nowrap text-flux-text-secondary';
  const sortableHeader = `${headerCell} group cursor-pointer select-none`;

  return (
    <thead>
      <tr className="bg-flux-hover border-b border-flux-border">
        {/* Expand — frozen left, no header */}
        <th className={`${stickyCell} left-0 w-6 py-3`} />
        {/* ID — frozen left */}
        <th
          className={`${stickyCell} left-6 ${sortableHeader}`}
          title="Identifiant"
          onClick={() => onSortChange('id')}
        >
          ID <SortChevron col="id" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Client — frozen left */}
        <th
          className={`${stickyCell} left-[5.5rem] ${sortableHeader}`}
          title="Client"
          onClick={() => onSortChange('client')}
        >
          Client <SortChevron col="client" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Designation — frozen left + right shadow */}
        <th
          className={`${stickyCell} left-[14.5rem] ${sortableHeader}`}
          style={LEFT_SHADOW}
          title="Désignation"
          onClick={() => onSortChange('designation')}
        >
          Désignation <SortChevron col="designation" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Sortie */}
        <th
          className={sortableHeader}
          title="Date de sortie atelier"
          onClick={() => onSortChange('sortie')}
        >
          Sortie <SortChevron col="sortie" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Prerequisite columns */}
        <th
          className={sortableHeader}
          title="Bon à tirer"
          onClick={() => onSortChange('bat')}
        >
          BAT <SortChevron col="bat" active={sortColumn} dir={sortDirection} />
        </th>
        <th
          className={sortableHeader}
          title="Papier"
          onClick={() => onSortChange('papier')}
        >
          Papier <SortChevron col="papier" active={sortColumn} dir={sortDirection} />
        </th>
        <th
          className={sortableHeader}
          title="Formes"
          onClick={() => onSortChange('formes')}
        >
          Formes <SortChevron col="formes" active={sortColumn} dir={sortDirection} />
        </th>
        <th
          className={sortableHeader}
          title="Plaques"
          onClick={() => onSortChange('plaques')}
        >
          Plaques <SortChevron col="plaques" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Station columns — dynamic from API, not sortable */}
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
        {/* ST (Sous-traitance) — not sortable, between last station col and Transporteur */}
        <th
          className={headerCell}
          title="Sous-traitance"
        >
          ST
        </th>
        {/* Transporteur */}
        <th
          className={sortableHeader}
          title="Transporteur"
          onClick={() => onSortChange('transporteur')}
        >
          Transp. <SortChevron col="transporteur" active={sortColumn} dir={sortDirection} />
        </th>
        {/* Parti — not sortable (K5.1 deferred) */}
        <th className={headerCell} title="Statut d'expédition">
          Parti
        </th>
        {/* Actions — frozen right + left shadow */}
        <th
          className={`${stickyCell} right-0 px-4 py-3 font-medium text-flux-text-secondary`}
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

  const cellBase = `${stickyCell} px-4 py-0 text-sm text-flux-text-secondary`;

  // Left border style reflects expanded state
  const expandCellStyle = isMulti
    ? { borderLeft: isExpanded ? '3px solid rgba(99,102,241,1)' : '3px solid rgba(99,102,241,0.25)' }
    : undefined;

  return (
    <tr
      className={`border-b border-flux-border ${isMulti ? 'row-multi' : ''} ${isFocused ? 'ring-1 ring-inset ring-indigo-500/40' : ''}`}
      style={{
        height: '36px',
        backgroundColor: isFocused ? 'rgba(99,102,241,0.08)' : undefined,
      }}
      data-testid="flux-table-row"
      data-job-id={job.id}
      data-flux-focused={isFocused ? 'true' : undefined}
    >
      {/* Expand toggle — frozen left */}
      <td
        className={`${stickyCell} left-0 text-center`}
        style={expandCellStyle}
      >
        {isMulti && (
          <button
            className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border font-mono font-semibold leading-none transition-colors ${
              isExpanded
                ? 'border-indigo-500/60 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50'
                : 'border-flux-border-light bg-transparent text-flux-text-muted hover:border-flux-text-muted hover:text-flux-text-secondary'
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

      {/* ID — frozen left */}
      <td className={`${stickyCell} left-6 px-4 py-0 text-sm text-flux-text-primary font-mono font-medium whitespace-nowrap`}>
        {job.id}
      </td>

      {/* Client — frozen left */}
      <td className={`${cellBase} left-[5.5rem] whitespace-nowrap`}>
        {job.client}
      </td>

      {/* Designation — frozen left + right shadow */}
      <td
        className={`${cellBase} left-[14.5rem]`}
        style={LEFT_SHADOW}
        data-testid="flux-designation"
      >
        {job.designation}
        {isMulti && (
          <span className="ml-1 text-flux-text-muted" style={{ fontSize: '10px' }}>
            ({job.elements.length})
          </span>
        )}
      </td>

      {/* Sortie */}
      <td className="px-2 py-0 text-sm text-flux-text-secondary whitespace-nowrap">
        {job.sortie}
      </td>

      {/* Prerequisite badge/listbox cells */}
      {(['bat', 'papier', 'formes', 'plaques'] as PrerequisiteColumn[]).map((col, i) => {
        const status = [bat, papier, formes, plaques][i]!;
        return isMulti ? (
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
            />
          </td>
        );
      })}

      {/* Station cells — dynamic from API */}
      {ctx.categories.map(cat => (
        <td
          key={cat.id}
          className="p-0 text-center border-l border-flux-border"
          style={{ lineHeight: 0 }}
          data-testid={`flux-station-${cat.id}`}
        >
          {isMulti ? (
            <FluxStackedDots
              data={sortStationDataBySeverity(
                getMultiElementStationData(job.elements, cat.id)
              )}
              stationName={cat.name}
            />
          ) : (
            <FluxStationIndicator
              data={el0.stations[cat.id]}
              stationName={cat.name}
            />
          )}
        </td>
      ))}

      {/* ST (Sous-traitance) — flattened tasks for collapsed multi, single element tasks otherwise */}
      <td className="px-1 py-1" style={{ maxWidth: '160px', verticalAlign: 'middle' }} data-testid="flux-st-cell">
        <STCell
          tasks={isMulti && !isExpanded
            ? job.elements.flatMap(e => e.outsourcing)
            : el0.outsourcing}
          onUpdateSTStatus={ctx.onUpdateSTStatus}
        />
      </td>

      {/* Transporteur */}
      <td className="px-2 py-0 text-sm text-flux-text-secondary whitespace-nowrap">
        {job.transporteur ?? '—'}
      </td>

      {/* Parti */}
      <td className="px-2 py-0 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
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
        </div>
      </td>

      {/* Actions — frozen right */}
      <td
        className={`${stickyCell} right-0 px-4 py-0`}
        style={RIGHT_SHADOW}
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
  return (
    <tr
      className="border-b border-flux-border"
      style={{
        height: '32px',
        animation: `flux-subrow-in 400ms cubic-bezier(0.25, 1, 0.5, 1) both`,
        animationDelay: `${index * 30}ms`,
      }}
      data-testid="flux-sub-row"
      data-job-id={job.id}
      data-element-id={element.id}
    >
      {/* Expand — indigo border (visual continuation) */}
      <td
        className={`${stickyCell} left-0`}
        style={{ borderLeft: '3px solid rgb(99,102,241)' }}
      />

      {/* ID — empty */}
      <td className={`${stickyCell} left-6`} />

      {/* Client — empty */}
      <td className={`${stickyCell} left-[5.5rem]`} />

      {/* Designation — label with arrow prefix */}
      <td
        className={`${stickyCell} left-[14.5rem] px-4 py-0 text-sm text-flux-text-tertiary`}
        style={LEFT_SHADOW}
        data-testid="flux-sub-designation"
      >
        <span className="text-flux-text-muted mr-1" aria-hidden="true">↳</span>
        {element.label}
      </td>

      {/* Sortie — empty */}
      <td />

      {/* Prerequisite listbox cells */}
      {(['bat', 'papier', 'formes', 'plaques'] as PrerequisiteColumn[]).map(col => (
        <td key={col} className="p-0">
          <FluxPrerequisiteListbox
            jobId={job.id}
            elementId={element.id}
            column={col}
            status={element[col]}
          />
        </td>
      ))}

      {/* Station cells — dynamic from API */}
      {ctx.categories.map(cat => (
        <td
          key={cat.id}
          className="p-0 text-center border-l border-flux-border"
          style={{ lineHeight: 0 }}
        >
          <FluxStationIndicator
            data={element.stations[cat.id]}
            stationName={cat.name}
          />
        </td>
      ))}

      {/* ST — per-element tasks */}
      <td className="px-1 py-1" style={{ maxWidth: '160px', verticalAlign: 'middle' }}>
        <STCell
          tasks={element.outsourcing}
          onUpdateSTStatus={ctx.onUpdateSTStatus}
        />
      </td>

      {/* Transporteur — empty */}
      <td />

      {/* Parti — empty */}
      <td />

      {/* Actions — empty (frozen right placeholder) */}
      <td
        className={`${stickyCell} right-0`}
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
    expandedJobIds,
    sortColumn,
    sortDirection,
    onSortChange,
  };

  return (
    <FluxTableContext.Provider value={ctxValue}>
      <div
        className="overflow-x-auto flux-scrollable"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgb(80 80 80) transparent',
        }}
      >
        <table
          className="w-full table-fixed"
          style={{ minWidth: '1440px', fontSize: '13px' }}
          data-testid="flux-table"
        >
          <colgroup>
            <col style={{ width: '1.5rem' }} />
            <col style={{ width: '4rem' }} />
            <col style={{ width: '9rem' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '6rem' }} />
            <col style={{ width: '6rem' }} />
            <col style={{ width: '6rem' }} />
            <col style={{ width: '6rem' }} />
            <col style={{ width: '6rem' }} />
            {categories.map(cat => (
              <col key={cat.id} style={{ width: '3.5rem' }} />
            ))}
            <col style={{ width: '10rem' }} />
            <col style={{ width: '6rem' }} />
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

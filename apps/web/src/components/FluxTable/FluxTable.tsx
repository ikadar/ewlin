import { memo, useMemo } from 'react';
import { CircleCheck, Circle, Trash2, Folder } from 'lucide-react';
import {
  STATION_CATEGORIES,
  type FluxJob,
  type FluxElement,
  type StationCategoryId,
} from './fluxTypes';
import {
  worstPrerequisiteStatus,
  getMultiElementStationData,
  sortStationDataBySeverity,
} from './fluxAggregation';
import { FluxPrerequisiteBadge } from './FluxPrerequisiteBadge';
import { FluxStationIndicator } from './FluxStationIndicator';
import { FluxStackedDots } from './FluxStackedDots';

interface FluxTableProps {
  jobs: FluxJob[];
}

// Frozen zone shadow styles (spec 3.6)
const LEFT_SHADOW = { boxShadow: '4px 0 8px -2px rgba(0,0,0,0.3)' } as const;
const RIGHT_SHADOW = { boxShadow: '-4px 0 8px -2px rgba(0,0,0,0.3)' } as const;

// Shared sticky cell classes for left-frozen columns
const stickyCell = 'sticky z-20 bg-flux-elevated';

/**
 * Header row for the Flux table.
 * All column headers show full name as title tooltip.
 * Sort chevron appears on hover (non-functional in v0.5.15).
 */
function FluxTableHeader() {
  const headerCell = 'px-2 py-3 text-left font-medium whitespace-nowrap text-flux-text-secondary';
  const sortIcon = (
    <svg
      className="w-3 h-3 text-flux-text-muted opacity-0 group-hover:opacity-100 transition-opacity inline ml-0.5"
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );

  return (
    <thead>
      <tr className="bg-flux-hover border-b border-flux-border">
        {/* Expand — frozen left, no header */}
        <th className={`${stickyCell} left-0 w-6 py-3`} />
        {/* ID — frozen left */}
        <th className={`${stickyCell} left-6 ${headerCell} group cursor-pointer`} title="Identifiant">
          ID {sortIcon}
        </th>
        {/* Client — frozen left */}
        <th
          className={`${stickyCell} left-[5.5rem] ${headerCell} group cursor-pointer`}
          title="Client"
        >
          Client {sortIcon}
        </th>
        {/* Designation — frozen left + right shadow */}
        <th
          className={`${stickyCell} left-[14.5rem] ${headerCell} group cursor-pointer`}
          style={LEFT_SHADOW}
          title="Désignation"
        >
          Désignation {sortIcon}
        </th>
        {/* Sortie */}
        <th className={`${headerCell} group cursor-pointer`} title="Date de sortie atelier">
          Sortie {sortIcon}
        </th>
        {/* Prerequisite columns */}
        <th className={`${headerCell} text-center group cursor-pointer`} title="Bon à tirer">
          BAT {sortIcon}
        </th>
        <th className={`${headerCell} text-center group cursor-pointer`} title="Papier">
          Papier {sortIcon}
        </th>
        <th className={`${headerCell} text-center group cursor-pointer`} title="Formes">
          Formes {sortIcon}
        </th>
        <th className={`${headerCell} text-center group cursor-pointer`} title="Plaques">
          Plaques {sortIcon}
        </th>
        {/* Station columns */}
        {STATION_CATEGORIES.map(cat => (
          <th
            key={cat.id}
            className="px-0 py-3 text-center font-medium whitespace-nowrap text-flux-text-secondary border-l border-flux-border"
            style={{ fontSize: '11px' }}
            title={cat.full}
          >
            {cat.abbr}
          </th>
        ))}
        {/* Transporteur */}
        <th className={`${headerCell} group cursor-pointer`} title="Transporteur">
          Transp. {sortIcon}
        </th>
        {/* Parti */}
        <th className={`${headerCell} group cursor-pointer`} title="Statut d'expédition">
          Parti {sortIcon}
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
 */
const FluxTableRow = memo(function FluxTableRow({ job }: { job: FluxJob }) {
  const isMulti = job.elements.length > 1;
  const el0 = job.elements[0] as FluxElement;

  // Prerequisite values — aggregated for multi-element, direct for single
  const bat    = isMulti ? worstPrerequisiteStatus(job.elements.map(e => e.bat))    : el0.bat;
  const papier = isMulti ? worstPrerequisiteStatus(job.elements.map(e => e.papier)) : el0.papier;
  const formes = isMulti ? worstPrerequisiteStatus(job.elements.map(e => e.formes)) : el0.formes;
  const plaques= isMulti ? worstPrerequisiteStatus(job.elements.map(e => e.plaques)): el0.plaques;
  const plusCount = isMulti ? job.elements.length - 1 : undefined;

  const cellBase = `${stickyCell} px-4 py-0 text-sm text-flux-text-secondary`;

  return (
    <tr
      className={`border-b border-flux-border ${isMulti ? 'row-multi' : ''}`}
      style={{ height: '36px' }}
      data-testid="flux-table-row"
      data-job-id={job.id}
    >
      {/* Expand toggle — frozen left */}
      <td
        className={`${stickyCell} left-0 text-center`}
        style={isMulti ? { borderLeft: '3px solid rgba(99,102,241,0.25)' } : undefined}
      >
        {isMulti && (
          <button
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border border-flux-border-light bg-transparent text-flux-text-muted font-mono font-semibold leading-none cursor-default"
            style={{ fontSize: '11px' }}
            disabled
            tabIndex={-1}
            aria-label="Expand/collapse elements"
            data-testid="flux-expand-toggle"
          >
            +
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

      {/* Prerequisite badge cells */}
      <td className="px-1 py-0 text-center">
        <FluxPrerequisiteBadge status={bat} plusCount={plusCount} />
      </td>
      <td className="px-1 py-0 text-center">
        <FluxPrerequisiteBadge status={papier} plusCount={plusCount} />
      </td>
      <td className="px-1 py-0 text-center">
        <FluxPrerequisiteBadge status={formes} plusCount={plusCount} />
      </td>
      <td className="px-1 py-0 text-center">
        <FluxPrerequisiteBadge status={plaques} plusCount={plusCount} />
      </td>

      {/* Station cells */}
      {STATION_CATEGORIES.map(cat => {
        const stationCell = (
          <td
            key={cat.id}
            className="p-0 text-center border-l border-flux-border"
            style={{ lineHeight: 0 }}
            data-testid={`flux-station-${cat.id}`}
          >
            {isMulti ? (
              <FluxStackedDots
                data={sortStationDataBySeverity(
                  getMultiElementStationData(job.elements, cat.id as StationCategoryId)
                )}
                stationName={cat.full}
              />
            ) : (
              <FluxStationIndicator
                data={el0.stations[cat.id as StationCategoryId]}
                stationName={cat.full}
              />
            )}
          </td>
        );
        return stationCell;
      })}

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
            tabIndex={-1}
            title="Supprimer"
            data-testid="flux-action-delete"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            className="text-blue-400 hover:text-blue-300 transition-colors"
            tabIndex={-1}
            title="Éditer"
            data-testid="flux-action-edit"
          >
            <Folder className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
});

/**
 * Production Flow Dashboard table.
 * Horizontally scrollable with frozen left and right column zones.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, sections 3.6–3.14
 */
export const FluxTable = memo(function FluxTable({ jobs }: FluxTableProps) {
  // Default sort: ID ascending (spec, qa.md K9.1)
  const sorted = useMemo(
    () => [...jobs].sort((a, b) => a.id.localeCompare(b.id)),
    [jobs],
  );

  return (
    <div
      className="overflow-x-auto"
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
          {STATION_CATEGORIES.map(cat => (
            <col key={cat.id} style={{ width: '3.5rem' }} />
          ))}
          <col style={{ width: '6rem' }} />
          <col style={{ width: '7rem' }} />
          <col style={{ width: '4rem' }} />
        </colgroup>

        <FluxTableHeader />

        <tbody className="divide-y divide-flux-border">
          {sorted.map(job => (
            <FluxTableRow key={job.id} job={job} />
          ))}
        </tbody>
      </table>
    </div>
  );
});

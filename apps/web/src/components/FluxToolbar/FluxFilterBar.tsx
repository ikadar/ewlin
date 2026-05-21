import { useMemo } from 'react';
import { RotateCcw, X } from 'lucide-react';
import {
  CARRIER_NONE,
  EMPTY_FLUX_FILTERS,
  FLUX_JOB_STATUS_FILTER_LABEL,
  hasActiveFilters,
  type FluxFilters,
  type FluxJobStatusFilter,
  type YesNoFilter,
} from '@/components/FluxTable/fluxFilters';
import type { FluxJob } from '@/components/FluxTable/fluxTypes';
import { FluxMultiSelect, type FluxMultiSelectOption } from './FluxMultiSelect';
import { FluxDateRangeFilter } from './FluxDateRangeFilter';

// Status → operational dot:
//   red    = late      — deadline missed, customer impact
//   yellow = conflict  — planning issue to resolve
//   blue   = planned   — has assignments and no issues
//   grey   = unplanned — not yet placed in the schedule
const STATUS_OPTIONS: ReadonlyArray<FluxMultiSelectOption<FluxJobStatusFilter>> = [
  { value: 'late',      label: FLUX_JOB_STATUS_FILTER_LABEL.late,      dotClassName: 'bg-red-500' },
  { value: 'conflict',  label: FLUX_JOB_STATUS_FILTER_LABEL.conflict,  dotClassName: 'bg-yellow-400' },
  { value: 'planned',   label: FLUX_JOB_STATUS_FILTER_LABEL.planned,   dotClassName: 'bg-blue-500' },
  { value: 'unplanned', label: FLUX_JOB_STATUS_FILTER_LABEL.unplanned, dotClassName: 'bg-zinc-500' },
];

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Vital',
  1: 'Impératif',
  2: 'Important',
  3: 'Standard',
  4: 'Flexible',
};

const PRIORITY_OPTIONS: ReadonlyArray<FluxMultiSelectOption<number>> = [
  { value: 0, label: PRIORITY_LABELS[0]! },
  { value: 1, label: PRIORITY_LABELS[1]! },
  { value: 2, label: PRIORITY_LABELS[2]! },
  { value: 3, label: PRIORITY_LABELS[3]! },
  { value: 4, label: PRIORITY_LABELS[4]! },
];

const YES_NO_OPTIONS: ReadonlyArray<FluxMultiSelectOption<YesNoFilter>> = [
  { value: 'yes', label: 'Oui' },
  { value: 'no',  label: 'Non' },
];

const YES_NO_LABEL: Record<YesNoFilter, string> = { yes: 'Oui', no: 'Non' };

interface FluxFilterBarProps {
  /** Source of truth for the dynamic option lists (clients, carriers, ids). */
  jobs: ReadonlyArray<FluxJob>;
  filters: FluxFilters;
  onChange: (next: FluxFilters) => void;
}

export function FluxFilterBar({ jobs, filters, onChange }: FluxFilterBarProps) {
  // Dynamic options: derived from the visible job set so filters never list
  // values that have zero matches in the current dashboard state.
  const clientOptions = useMemo<ReadonlyArray<FluxMultiSelectOption<string>>>(() => {
    const set = new Set(jobs.map(j => j.client).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b)).map(c => ({ value: c, label: c }));
  }, [jobs]);

  const carrierOptions = useMemo<ReadonlyArray<FluxMultiSelectOption<string>>>(() => {
    const set = new Set<string>();
    let hasNone = false;
    for (const j of jobs) {
      if (j.transporteur) set.add(j.transporteur);
      else hasNone = true;
    }
    const opts = [...set].sort((a, b) => a.localeCompare(b)).map(c => ({ value: c, label: c }));
    if (hasNone) opts.push({ value: CARRIER_NONE, label: '(Sans transporteur)' });
    return opts;
  }, [jobs]);

  const jobIdOptions = useMemo<ReadonlyArray<FluxMultiSelectOption<string>>>(
    () => jobs.map(j => ({ value: j.id, label: j.id })),
    [jobs],
  );

  const handleReset = () => onChange(EMPTY_FLUX_FILTERS);
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-2.5" data-testid="flux-filter-bar">
      <div className="flex flex-wrap items-center gap-2">
        <FluxMultiSelect
          label="Statut"
          options={STATUS_OPTIONS}
          values={filters.statuses}
          onChange={s => onChange({ ...filters, statuses: s })}
        />
        <FluxMultiSelect
          label="Client"
          options={clientOptions}
          values={filters.clients}
          onChange={s => onChange({ ...filters, clients: s })}
          searchable
        />
        <FluxMultiSelect
          label="Transporteur"
          options={carrierOptions}
          values={filters.carriers}
          onChange={s => onChange({ ...filters, carriers: s })}
        />
        <FluxMultiSelect
          label="Priorité"
          options={PRIORITY_OPTIONS}
          values={filters.priorities}
          onChange={s => onChange({ ...filters, priorities: s })}
        />
        <FluxMultiSelect
          label="N° dossier"
          options={jobIdOptions}
          values={filters.jobIds}
          onChange={s => onChange({ ...filters, jobIds: s })}
          searchable
        />
        <FluxDateRangeFilter
          label="Date départ"
          from={filters.sortieFrom}
          to={filters.sortieTo}
          onChange={(from, to) => onChange({ ...filters, sortieFrom: from, sortieTo: to })}
        />
        <FluxDateRangeFilter
          label="Deadline BAT"
          from={filters.batFrom}
          to={filters.batTo}
          onChange={(from, to) => onChange({ ...filters, batFrom: from, batTo: to })}
        />
        <FluxMultiSelect
          label="Parti"
          options={YES_NO_OPTIONS}
          values={filters.shipped}
          onChange={s => onChange({ ...filters, shipped: s })}
        />
        <FluxMultiSelect
          label="Facturé"
          options={YES_NO_OPTIONS}
          values={filters.invoiced}
          onChange={s => onChange({ ...filters, invoiced: s })}
        />
        <button
          type="button"
          onClick={handleReset}
          disabled={!active}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-flux-text-tertiary hover:text-flux-text-primary px-2 py-1 rounded hover:bg-flux-hover disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-default"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Réinitialiser</span>
        </button>
      </div>

      {active && (
        <FluxFilterRecap filters={filters} onChange={onChange} />
      )}
    </div>
  );
}

interface RecapProps {
  filters: FluxFilters;
  onChange: (next: FluxFilters) => void;
}

interface RecapChip {
  text: string;
  dotClassName?: string;
  onRemove: () => void;
}

interface RecapGroup {
  key: string;
  label: string;
  chips: RecapChip[];
}

function fmtIsoToShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function FluxFilterRecap({ filters, onChange }: RecapProps) {
  const groups: RecapGroup[] = [];

  if (filters.statuses.size > 0) {
    groups.push({
      key: 'statuses',
      label: 'statut',
      chips: [...filters.statuses].map(s => ({
        text: FLUX_JOB_STATUS_FILTER_LABEL[s],
        dotClassName: STATUS_OPTIONS.find(o => o.value === s)?.dotClassName,
        onRemove: () => {
          const next = new Set(filters.statuses);
          next.delete(s);
          onChange({ ...filters, statuses: next });
        },
      })),
    });
  }

  if (filters.clients.size > 0) {
    groups.push({
      key: 'clients',
      label: 'client',
      chips: [...filters.clients].sort().map(c => ({
        text: c,
        onRemove: () => {
          const next = new Set(filters.clients);
          next.delete(c);
          onChange({ ...filters, clients: next });
        },
      })),
    });
  }

  if (filters.carriers.size > 0) {
    groups.push({
      key: 'carriers',
      label: 'transporteur',
      chips: [...filters.carriers].map(c => ({
        text: c === CARRIER_NONE ? 'Sans transporteur' : c,
        onRemove: () => {
          const next = new Set(filters.carriers);
          next.delete(c);
          onChange({ ...filters, carriers: next });
        },
      })),
    });
  }

  if (filters.priorities.size > 0) {
    groups.push({
      key: 'priorities',
      label: 'priorité',
      chips: [...filters.priorities].sort((a, b) => a - b).map(p => ({
        text: PRIORITY_LABELS[p] ?? String(p),
        onRemove: () => {
          const next = new Set(filters.priorities);
          next.delete(p);
          onChange({ ...filters, priorities: next });
        },
      })),
    });
  }

  if (filters.jobIds.size > 0) {
    groups.push({
      key: 'jobIds',
      label: 'n° dossier',
      chips: [...filters.jobIds].sort().map(id => ({
        text: id,
        onRemove: () => {
          const next = new Set(filters.jobIds);
          next.delete(id);
          onChange({ ...filters, jobIds: next });
        },
      })),
    });
  }

  if (filters.sortieFrom || filters.sortieTo) {
    const text = rangeText(filters.sortieFrom, filters.sortieTo);
    groups.push({
      key: 'sortie',
      label: 'date départ',
      chips: [{
        text,
        onRemove: () => onChange({ ...filters, sortieFrom: null, sortieTo: null }),
      }],
    });
  }

  if (filters.batFrom || filters.batTo) {
    const text = rangeText(filters.batFrom, filters.batTo);
    groups.push({
      key: 'bat',
      label: 'deadline BAT',
      chips: [{
        text,
        onRemove: () => onChange({ ...filters, batFrom: null, batTo: null }),
      }],
    });
  }

  if (filters.shipped.size > 0) {
    groups.push({
      key: 'shipped',
      label: 'parti',
      chips: [...filters.shipped].map(v => ({
        text: YES_NO_LABEL[v],
        onRemove: () => {
          const next = new Set(filters.shipped);
          next.delete(v);
          onChange({ ...filters, shipped: next });
        },
      })),
    });
  }

  if (filters.invoiced.size > 0) {
    groups.push({
      key: 'invoiced',
      label: 'facturé',
      chips: [...filters.invoiced].map(v => ({
        text: YES_NO_LABEL[v],
        onRemove: () => {
          const next = new Set(filters.invoiced);
          next.delete(v);
          onChange({ ...filters, invoiced: next });
        },
      })),
    });
  }

  if (groups.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pt-2 border-t border-dashed border-flux-border min-h-[28px]"
      data-testid="flux-filter-recap"
    >
      {groups.map((g, gi) => (
        <span key={g.key} className="inline-flex items-center gap-1 flex-wrap">
          {gi > 0 && <span className="text-flux-text-muted text-[11px] select-none mr-1">|</span>}
          <span className="text-[11px] text-flux-text-tertiary lowercase tracking-wide mr-0.5">
            {g.label}:
          </span>
          {g.chips.map((c, ci) => (
            <span
              key={`${g.key}-${ci}`}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-px bg-blue-500/15 border border-blue-500/40 rounded-full text-[11px] text-flux-text-primary max-w-[220px]"
            >
              {c.dotClassName && (
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dotClassName}`} />
              )}
              <span className="truncate" title={c.text}>{c.text}</span>
              <button
                type="button"
                onClick={c.onRemove}
                className="text-flux-text-tertiary hover:text-flux-text-primary hover:bg-white/10 rounded-full p-px inline-flex items-center"
                aria-label={`Retirer ${c.text}`}
              >
                <X className="w-2.5 h-2.5" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

function rangeText(from: string | null, to: string | null): string {
  if (from && to) return `${fmtIsoToShort(from)} → ${fmtIsoToShort(to)}`;
  if (from)       return `à partir du ${fmtIsoToShort(from)}`;
  return `jusqu'au ${fmtIsoToShort(to!)}`;
}

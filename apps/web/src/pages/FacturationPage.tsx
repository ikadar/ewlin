import { useState, useMemo, useCallback, memo } from 'react';
import { useGetFluxJobsQuery, useToggleJobInvoicedMutation } from '@/store';
import type { FluxJob } from '@/components/FluxTable/fluxTypes';
import { useSort } from '@/hooks/useSort';
import { useRowExitAnimation } from '@/hooks/useRowExitAnimation';
import { FluxTabBar } from '@/components/FluxTabBar';
import {
  SortableHeader,
  FluxToggle,
  FluxEmptyState,
  FLUX_TABLE_CARD,
  FLUX_TABLE,
  FLUX_THEAD,
  FLUX_HEADER_TR,
  FLUX_BODY_TR,
  FLUX_BODY_TR_STYLE,
  FLUX_BODY_CELL,
  FLUX_BODY_CELL_PRIMARY,
} from '@/components/FluxStyledTable';

type FilterTab = 'a-facturer' | 'factures' | 'tous';
type SortCol = 'ref' | 'designation' | 'client' | 'shippedAt' | 'invoiced';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'a-facturer', label: 'À facturer' },
  { key: 'factures', label: 'Facturés' },
  { key: 'tous', label: 'Tous' },
];

function shippedJobs(jobs: FluxJob[]): FluxJob[] {
  return jobs.filter((j) => j.parti.shipped);
}

const defaultDirForCol = (col: SortCol) => col === 'shippedAt' ? 'desc' as const : 'asc' as const;

const JobRow = memo(function JobRow({
  job,
  exiting,
  collapsing,
  onToggleInvoiced,
}: {
  job: FluxJob;
  exiting?: boolean;
  collapsing?: boolean;
  onToggleInvoiced: (internalId: string, invoiced: boolean) => void;
}) {
  return (
    <tr
      className={`${FLUX_BODY_TR} ${
        collapsing ? 'opacity-0 pointer-events-none flux-row-collapsing'
        : exiting ? 'opacity-0 transition-opacity duration-1000 pointer-events-none'
        : ''
      }`}
      style={collapsing ? { height: 0 } : FLUX_BODY_TR_STYLE}
    >
      <td className={`${FLUX_BODY_CELL_PRIMARY} px-2 whitespace-nowrap`}>
        <span className="font-mono">{job.id}</span>
      </td>
      <td className={`${FLUX_BODY_CELL} whitespace-nowrap`}>{job.designation}</td>
      <td className={`${FLUX_BODY_CELL_PRIMARY} whitespace-nowrap`}>{job.client}</td>
      <td className={`${FLUX_BODY_CELL} whitespace-nowrap`}>
        <span className="font-mono text-flux-text-primary" style={{ fontSize: '11px' }}>
          {job.parti.date ?? '—'}
        </span>
      </td>
      <td className="px-2 py-0 whitespace-nowrap">
        <FluxToggle
          active={job.facture.invoiced}
          onToggle={() => onToggleInvoiced(job.internalId!, !job.facture.invoiced)}
          activeDate={job.facture.date}
          activeTitle="Marquer comme non facturé"
          inactiveTitle="Marquer comme facturé"
        />
      </td>
    </tr>
  );
});

export function FacturationPage() {
  const { data: allJobs = [], isLoading } = useGetFluxJobsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [toggleInvoiced] = useToggleJobInvoicedMutation();
  const [tab, setTab] = useState<FilterTab>('a-facturer');
  const { sortCol, sortDir, handleSort } = useSort<SortCol>('shippedAt', 'desc', defaultDirForCol);

  const shipped = useMemo(() => shippedJobs(allJobs), [allJobs]);

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = { 'a-facturer': 0, factures: 0, tous: shipped.length };
    for (const j of shipped) {
      if (j.facture.invoiced) c.factures++;
      else c['a-facturer']++;
    }
    return c;
  }, [shipped]);

  const filtered = useMemo(() => {
    let list = [...shipped];
    if (tab === 'a-facturer') list = list.filter((j) => !j.facture.invoiced);
    else if (tab === 'factures') list = list.filter((j) => j.facture.invoiced);

    list.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortCol) {
        case 'ref': va = a.id; vb = b.id; break;
        case 'designation': va = a.designation; vb = b.designation; break;
        case 'client': va = a.client; vb = b.client; break;
        case 'shippedAt': va = a.parti.date ?? ''; vb = b.parti.date ?? ''; break;
        case 'invoiced': va = a.facture.invoiced ? 1 : 0; vb = b.facture.invoiced ? 1 : 0; break;
      }
      const r = typeof va === 'string' ? va.localeCompare(vb as string) : (va < (vb as number) ? -1 : va > (vb as number) ? 1 : 0);
      return sortDir === 'desc' ? -r : r;
    });
    return list;
  }, [shipped, tab, sortCol, sortDir]);

  const commitInvoiced = useCallback((internalId: string) => {
    const job = shipped.find(j => j.internalId === internalId);
    if (job) toggleInvoiced({ jobInternalId: internalId, invoiced: !job.facture.invoiced });
  }, [toggleInvoiced, shipped]);

  const { exitingIds, collapsingIds, triggerExit } = useRowExitAnimation(commitInvoiced);

  const handleToggleInvoiced = useCallback((internalId: string, invoiced: boolean) => {
    const willLeave = (tab === 'a-facturer' && invoiced) || (tab === 'factures' && !invoiced);
    if (willLeave) {
      triggerExit(internalId);
    } else {
      toggleInvoiced({ jobInternalId: internalId, invoiced });
    }
  }, [toggleInvoiced, tab, triggerExit]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-flux-base">
      <div className={FLUX_TABLE_CARD}>
        {/* Summary bar */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-flux-border bg-flux-elevated text-xs text-flux-text-tertiary">
          <span>Dossiers partis : <strong className="text-flux-text-primary">{shipped.length}</strong></span>
          <span>En attente de facture : <strong className="text-flux-text-primary">{counts['a-facturer']}</strong></span>
        </div>

        <FluxTabBar
          tabs={TABS}
          activeTab={tab}
          counts={counts}
          onTabChange={setTab}
          testIdPrefix="fact-tab"
        />

        {/* Table */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <table className={FLUX_TABLE}>
            <thead className={FLUX_THEAD}>
              <tr className={FLUX_HEADER_TR}>
                <SortableHeader col="ref" active={sortCol} dir={sortDir} onSort={handleSort}>Réf.</SortableHeader>
                <SortableHeader col="designation" active={sortCol} dir={sortDir} onSort={handleSort} className="px-4">Désignation</SortableHeader>
                <SortableHeader col="client" active={sortCol} dir={sortDir} onSort={handleSort} className="px-4">Client</SortableHeader>
                <SortableHeader col="shippedAt" active={sortCol} dir={sortDir} onSort={handleSort} className="px-4">Parti le</SortableHeader>
                <SortableHeader col="invoiced" active={sortCol} dir={sortDir} onSort={handleSort}>Facturé</SortableHeader>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <JobRow key={job.id} job={job} exiting={exitingIds.has(job.internalId!)} collapsing={collapsingIds.has(job.internalId!)} onToggleInvoiced={handleToggleInvoiced} />
              ))}
            </tbody>
          </table>
          {isLoading && <FluxEmptyState title="Chargement…" />}
          {!isLoading && filtered.length === 0 && <FluxEmptyState title="Aucun dossier" />}
        </div>
      </div>
    </div>
  );
}

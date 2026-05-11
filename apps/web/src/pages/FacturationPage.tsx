import { useState, useMemo, useCallback, memo } from 'react';
import { CircleCheck, Circle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useGetFluxJobsQuery, useToggleJobInvoicedMutation } from '@/store';
import type { FluxJob } from '@/components/FluxTable/fluxTypes';

type FilterTab = 'a-facturer' | 'factures' | 'tous';
type SortCol = 'ref' | 'designation' | 'client' | 'shippedAt' | 'invoiced';
type SortDir = 'asc' | 'desc';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'a-facturer', label: 'À facturer' },
  { key: 'factures', label: 'Facturés' },
  { key: 'tous', label: 'Tous' },
];

function shippedJobs(jobs: FluxJob[]): FluxJob[] {
  return jobs.filter((j) => j.parti.shipped);
}

function SortChevron({ col, active, dir }: { col: SortCol; active: SortCol; dir: SortDir }) {
  if (col !== active) {
    return <ChevronsUpDown className="w-3 h-3 text-flux-text-muted opacity-0 group-hover:opacity-100 transition-opacity inline ml-0.5" strokeWidth={2} />;
  }
  if (dir === 'asc') return <ChevronUp className="w-3 h-3 text-blue-400 inline ml-0.5" strokeWidth={2.5} />;
  return <ChevronDown className="w-3 h-3 text-blue-400 inline ml-0.5" strokeWidth={2.5} />;
}

const JobRow = memo(function JobRow({
  job,
  exiting,
  onToggleInvoiced,
}: {
  job: FluxJob;
  exiting?: boolean;
  onToggleInvoiced: (internalId: string, invoiced: boolean) => void;
}) {
  return (
    <tr
      className={`border-b border-flux-border group hover:bg-flux-hover ${exiting ? 'opacity-0 transition-opacity duration-1000 pointer-events-none' : 'transition-colors'}`}
      style={{ height: '2.25rem' }}
    >
      <td className="px-2 py-0 text-sm whitespace-nowrap">
        <span className="font-mono font-medium text-flux-text-primary">{job.id}</span>
      </td>
      <td className="px-4 py-0 text-sm text-flux-text-secondary whitespace-nowrap">{job.designation}</td>
      <td className="px-4 py-0 text-sm text-flux-text-primary whitespace-nowrap">{job.client}</td>
      <td className="px-4 py-0 text-sm whitespace-nowrap">
        <span className="font-mono text-flux-text-primary" style={{ fontSize: '11px' }}>
          {job.parti.date ?? '—'}
        </span>
      </td>
      <td className="px-2 py-0 whitespace-nowrap">
        <button
          type="button"
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
          onClick={() => onToggleInvoiced(job.internalId!, !job.facture.invoiced)}
          title={job.facture.invoiced ? 'Marquer comme non facturé' : 'Marquer comme facturé'}
        >
          {job.facture.invoiced ? (
            <>
              <CircleCheck className="w-4 h-4 text-emerald-500" strokeWidth={2} />
              <span className="font-mono text-flux-text-muted" style={{ fontSize: '10px' }}>{job.facture.date}</span>
            </>
          ) : (
            <Circle className="w-4 h-4 text-zinc-600" strokeWidth={2} />
          )}
        </button>
      </td>
    </tr>
  );
});

export function FacturationPage() {
  const { data: allJobs = [], isLoading } = useGetFluxJobsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [toggleInvoiced] = useToggleJobInvoicedMutation();
  const [tab, setTab] = useState<FilterTab>('a-facturer');
  const [sortCol, setSortCol] = useState<SortCol>('shippedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const shipped = useMemo(() => shippedJobs(allJobs), [allJobs]);

  const counts = useMemo(() => {
    const c = { 'a-facturer': 0, factures: 0, tous: shipped.length };
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

  const handleSort = useCallback((col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir(col === 'shippedAt' ? 'desc' : 'asc'); }
  }, [sortCol]);

  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

  const handleToggleInvoiced = useCallback((internalId: string, invoiced: boolean) => {
    const willLeave = (tab === 'a-facturer' && invoiced) || (tab === 'factures' && !invoiced);
    if (willLeave) {
      setExitingIds(prev => new Set(prev).add(internalId));
      setTimeout(() => {
        setExitingIds(prev => { const next = new Set(prev); next.delete(internalId); return next; });
        toggleInvoiced({ jobInternalId: internalId, invoiced });
      }, 1000);
    } else {
      toggleInvoiced({ jobInternalId: internalId, invoiced });
    }
  }, [toggleInvoiced, tab]);

  const hc = 'px-2 py-3 text-left text-sm font-medium whitespace-nowrap text-flux-text-secondary group cursor-pointer select-none';

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-flux-base">
      <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden flex flex-col flex-1 m-4">
        {/* Summary bar */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-flux-border bg-flux-elevated text-xs text-flux-text-tertiary">
          <span>Dossiers partis : <strong className="text-flux-text-primary">{shipped.length}</strong></span>
          <span>En attente de facture : <strong className="text-flux-text-primary">{counts['a-facturer']}</strong></span>
        </div>

        {/* Tab bar */}
        <div className="flex items-end border-b border-flux-border bg-flux-elevated px-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-1.5',
                tab === t.key
                  ? 'border-blue-500 text-white bg-flux-elevated'
                  : 'border-transparent text-flux-text-secondary hover:text-white hover:bg-flux-hover/50',
              ].join(' ')}
            >
              <span>{t.label}</span>
              <span className="text-sm text-flux-text-muted">({counts[t.key]})</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-30 bg-flux-hover">
              <tr className="bg-flux-hover border-b border-flux-border">
                <th className={hc} onClick={() => handleSort('ref')}>Réf. <SortChevron col="ref" active={sortCol} dir={sortDir} /></th>
                <th className={`${hc} px-4`} onClick={() => handleSort('designation')}>Désignation <SortChevron col="designation" active={sortCol} dir={sortDir} /></th>
                <th className={`${hc} px-4`} onClick={() => handleSort('client')}>Client <SortChevron col="client" active={sortCol} dir={sortDir} /></th>
                <th className={`${hc} px-4`} onClick={() => handleSort('shippedAt')}>Parti le <SortChevron col="shippedAt" active={sortCol} dir={sortDir} /></th>
                <th className={hc} onClick={() => handleSort('invoiced')}>Facturé <SortChevron col="invoiced" active={sortCol} dir={sortDir} /></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-32 text-center text-flux-text-muted">Chargement…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-32 text-center text-flux-text-muted">Aucun dossier</td></tr>
              )}
              {filtered.map((job) => (
                <JobRow key={job.id} job={job} exiting={exitingIds.has(job.internalId!)} onToggleInvoiced={handleToggleInvoiced} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

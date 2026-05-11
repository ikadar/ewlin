import { useState, useMemo, useCallback, memo } from 'react';
import { CircleCheck, Circle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
  useGetProductionEventsQuery,
  useToggleEventSeenMutation,
  type ProductionEventResponse,
} from '@/store';

type FilterTab = 'all' | 'important' | 'info' | 'seen';
type SortCol = 'type' | 'job' | 'task' | 'offset' | 'station' | 'operator' | 'time';
type SortDir = 'asc' | 'desc';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'important', label: 'Important' },
  { key: 'info', label: 'Pour info' },
  { key: 'seen', label: 'Vu' },
];

const TYPE_LABELS: Record<string, string> = {
  retard_minor: 'Retard',
  retard_major: 'Retard',
  a_lheure: 'À l\'heure',
  avance: 'Avance',
  panne_machine: 'Panne machine',
  absence: 'Absence opérateur',
};

const TYPE_ORDER: Record<string, number> = {
  panne_machine: 0, absence: 1, retard_major: 2, retard_minor: 3, a_lheure: 4, avance: 5,
};

const IMPORTANT_TYPES = new Set(['retard_major', 'panne_machine', 'absence']);

function severity(type: string): 'important' | 'info' {
  return IMPORTANT_TYPES.has(type) ? 'important' : 'info';
}

function TypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type] ?? type;
  if (type === 'retard_major' || type === 'panne_machine' || type === 'absence') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.25rem] border font-medium whitespace-nowrap leading-snug bg-red-900/20 text-red-400 border-red-800/50" style={{ fontSize: '11px' }}>{label}</span>;
  }
  if (type === 'retard_minor') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.25rem] border font-medium whitespace-nowrap leading-snug bg-yellow-900/20 text-yellow-400 border-yellow-800/50" style={{ fontSize: '11px' }}>{label}</span>;
  }
  if (type === 'avance') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded-[0.25rem] border font-medium whitespace-nowrap leading-snug bg-green-900/20 text-green-400 border-green-800/50" style={{ fontSize: '11px' }}>{label}</span>;
  }
  return <span className="text-sm text-flux-text-secondary">{label}</span>;
}

function OffsetCell({ event }: { event: ProductionEventResponse }) {
  if (event.offsetMinutes == null) return <span className="text-flux-text-muted">—</span>;
  if (event.offsetMinutes === 0) return <span className="font-mono font-semibold text-flux-text-muted" style={{ fontSize: '11px' }}>0 min</span>;
  const abs = Math.abs(event.offsetMinutes);
  const sign = event.offsetMinutes > 0 ? '+' : '-';
  const color = event.type === 'retard_minor' ? 'text-yellow-400'
    : event.type === 'retard_major' ? 'text-red-400'
    : 'text-flux-text-secondary';
  return <span className={`font-mono font-semibold ${color}`} style={{ fontSize: '11px' }}>{sign}{abs} min</span>;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h${String(mins % 60).padStart(2, '0')}`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

function SortChevron({ col, active, dir }: { col: SortCol; active: SortCol; dir: SortDir }) {
  if (col !== active) {
    return <ChevronsUpDown className="w-3 h-3 text-flux-text-muted opacity-0 group-hover:opacity-100 transition-opacity inline ml-0.5" strokeWidth={2} />;
  }
  if (dir === 'asc') return <ChevronUp className="w-3 h-3 text-blue-400 inline ml-0.5" strokeWidth={2.5} />;
  return <ChevronDown className="w-3 h-3 text-blue-400 inline ml-0.5" strokeWidth={2.5} />;
}

const EventRow = memo(function EventRow({
  event,
  onToggleSeen,
}: {
  event: ProductionEventResponse;
  onToggleSeen: (id: string, seen: boolean) => void;
}) {
  return (
    <tr
      className={`border-b border-flux-border group transition-colors hover:bg-flux-hover ${event.seen ? 'opacity-40 hover:opacity-60' : ''}`}
      style={{ height: '2.25rem' }}
    >
      <td className="px-2 py-0 text-sm text-flux-text-secondary whitespace-nowrap">
        <TypeBadge type={event.type} />
      </td>
      <td className="px-4 py-0 text-sm whitespace-nowrap">
        {event.jobReference && (
          <>
            <span className="font-mono font-medium text-flux-text-primary">{event.jobReference}</span>
            <span className="text-zinc-600 mx-[3px]">·</span>
            <span className="text-flux-text-tertiary">{event.jobClient}</span>
          </>
        )}
      </td>
      <td className="px-4 py-0 text-sm text-flux-text-secondary whitespace-nowrap">{event.taskName ?? '—'}</td>
      <td className="px-4 py-0 text-sm whitespace-nowrap"><OffsetCell event={event} /></td>
      <td className="px-4 py-0 text-sm text-flux-text-secondary whitespace-nowrap">{event.stationName ?? '—'}</td>
      <td className="px-4 py-0 text-sm text-flux-text-secondary whitespace-nowrap">{event.operatorName ?? '—'}</td>
      <td className="px-4 py-0 text-sm text-flux-text-muted whitespace-nowrap text-right" style={{ fontSize: '11px' }}>{timeAgo(event.createdAt)}</td>
      <td className="px-2 py-0 whitespace-nowrap">
        <button
          type="button"
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
          onClick={() => onToggleSeen(event.id, !event.seen)}
          title={event.seen ? 'Marquer comme non vu' : 'Marquer comme vu'}
        >
          {event.seen ? (
            <CircleCheck className="w-4 h-4 text-emerald-500" strokeWidth={2} />
          ) : (
            <Circle className="w-4 h-4 text-zinc-600" strokeWidth={2} />
          )}
        </button>
      </td>
    </tr>
  );
});

export function ProductionReportPage() {
  const { data: events = [], isLoading } = useGetProductionEventsQuery();
  const [toggleSeen] = useToggleEventSeenMutation();
  const [tab, setTab] = useState<FilterTab>('all');
  const [sortCol, setSortCol] = useState<SortCol>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const counts = useMemo(() => {
    const c = { all: events.length, important: 0, info: 0, seen: 0 };
    for (const e of events) {
      if (e.seen) c.seen++;
      else c[severity(e.type)]++;
    }
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    let list = [...events];
    if (tab === 'important') list = list.filter((e) => !e.seen && severity(e.type) === 'important');
    else if (tab === 'info') list = list.filter((e) => !e.seen && severity(e.type) === 'info');
    else if (tab === 'seen') list = list.filter((e) => e.seen);

    list.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortCol) {
        case 'type': va = TYPE_ORDER[a.type] ?? 9; vb = TYPE_ORDER[b.type] ?? 9; break;
        case 'job': va = a.jobReference ?? ''; vb = b.jobReference ?? ''; break;
        case 'task': va = a.taskName ?? ''; vb = b.taskName ?? ''; break;
        case 'offset': va = a.offsetMinutes ?? -999; vb = b.offsetMinutes ?? -999; break;
        case 'station': va = a.stationName ?? ''; vb = b.stationName ?? ''; break;
        case 'operator': va = a.operatorName ?? ''; vb = b.operatorName ?? ''; break;
        case 'time': default: va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); break;
      }
      const r = typeof va === 'string' ? va.localeCompare(vb as string) : (va < (vb as number) ? -1 : va > (vb as number) ? 1 : 0);
      return sortDir === 'desc' ? -r : r;
    });
    return list;
  }, [events, tab, sortCol, sortDir]);

  const handleSort = useCallback((col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir(col === 'time' ? 'desc' : 'asc'); }
  }, [sortCol]);

  const handleToggleSeen = useCallback((id: string, seen: boolean) => {
    toggleSeen({ id, seen });
  }, [toggleSeen]);

  const hc = 'px-2 py-3 text-left text-sm font-medium whitespace-nowrap text-flux-text-secondary group cursor-pointer select-none';

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-flux-base">
      <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden flex flex-col flex-1 m-4">
        {/* Tab bar — FluxTabBar */}
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
                <th className={hc} onClick={() => handleSort('type')}>Type <SortChevron col="type" active={sortCol} dir={sortDir} /></th>
                <th className={hc} onClick={() => handleSort('job')}>Job <SortChevron col="job" active={sortCol} dir={sortDir} /></th>
                <th className={hc} onClick={() => handleSort('task')}>Tâche <SortChevron col="task" active={sortCol} dir={sortDir} /></th>
                <th className={hc} onClick={() => handleSort('offset')}>Écart <SortChevron col="offset" active={sortCol} dir={sortDir} /></th>
                <th className={hc} onClick={() => handleSort('station')}>Station <SortChevron col="station" active={sortCol} dir={sortDir} /></th>
                <th className={hc} onClick={() => handleSort('operator')}>Opérateur <SortChevron col="operator" active={sortCol} dir={sortDir} /></th>
                <th className={`${hc} text-right`} onClick={() => handleSort('time')}>Quand <SortChevron col="time" active={sortCol} dir={sortDir} /></th>
                <th className="px-2 py-3 text-left text-sm font-medium whitespace-nowrap text-flux-text-secondary">Vu</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-flux-text-muted">Chargement…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-flux-text-muted">Aucun événement</td></tr>
              )}
              {filtered.map((ev) => (
                <EventRow key={ev.id} event={ev} onToggleSeen={handleToggleSeen} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

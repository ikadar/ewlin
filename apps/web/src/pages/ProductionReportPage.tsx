import { useState, useMemo, useCallback, memo } from 'react';
import {
  useGetProductionEventsQuery,
  useToggleEventSeenMutation,
  type ProductionEventResponse,
} from '@/store';
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
  FLUX_HEADER_CELL,
  FLUX_BODY_TR,
  FLUX_BODY_TR_STYLE,
  FLUX_BODY_CELL,
} from '@/components/FluxStyledTable';

type FilterTab = 'all' | 'important' | 'info' | 'seen';
type SortCol = 'type' | 'job' | 'task' | 'offset' | 'station' | 'operator' | 'time';

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

const defaultDirForCol = (col: SortCol) => col === 'time' ? 'desc' as const : 'asc' as const;

const EventRow = memo(function EventRow({
  event,
  exiting,
  collapsing,
  onToggleSeen,
}: {
  event: ProductionEventResponse;
  exiting?: boolean;
  collapsing?: boolean;
  onToggleSeen: (id: string, seen: boolean) => void;
}) {
  return (
    <tr
      className={`${FLUX_BODY_TR} ${
        collapsing ? 'opacity-0 pointer-events-none flux-row-collapsing'
        : exiting ? 'opacity-0 transition-opacity duration-1000 pointer-events-none'
        : event.seen ? 'opacity-40 hover:opacity-60' : ''
      }`}
      style={collapsing ? { height: 0 } : FLUX_BODY_TR_STYLE}
    >
      <td className={`${FLUX_BODY_CELL} px-2 whitespace-nowrap`}>
        <TypeBadge type={event.type} />
      </td>
      <td className={`${FLUX_BODY_CELL} whitespace-nowrap`}>
        {event.jobReference && (
          <>
            <span className="font-mono font-medium text-flux-text-primary">{event.jobReference}</span>
            <span className="text-zinc-600 mx-[3px]">·</span>
            <span className="text-flux-text-tertiary">{event.jobClient}</span>
          </>
        )}
      </td>
      <td className={`${FLUX_BODY_CELL} whitespace-nowrap`}>{event.taskName ?? '—'}</td>
      <td className={`${FLUX_BODY_CELL} whitespace-nowrap`}><OffsetCell event={event} /></td>
      <td className={`${FLUX_BODY_CELL} whitespace-nowrap`}>{event.stationName ?? '—'}</td>
      <td className={`${FLUX_BODY_CELL} whitespace-nowrap`}>{event.operatorName ?? '—'}</td>
      <td className={`${FLUX_BODY_CELL} whitespace-nowrap text-right text-flux-text-muted`} style={{ fontSize: '11px' }}>{timeAgo(event.createdAt)}</td>
      <td className="px-2 py-0 whitespace-nowrap">
        <FluxToggle
          active={event.seen}
          onToggle={() => onToggleSeen(event.id, !event.seen)}
          activeTitle="Marquer comme non vu"
          inactiveTitle="Marquer comme vu"
        />
      </td>
    </tr>
  );
});

export function ProductionReportPage() {
  const { data: events = [], isLoading, isError, error } = useGetProductionEventsQuery();
  const [toggleSeen] = useToggleEventSeenMutation();
  const [tab, setTab] = useState<FilterTab>('all');
  const { sortCol, sortDir, handleSort } = useSort<SortCol>('time', 'desc', defaultDirForCol);

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = { all: events.length, important: 0, info: 0, seen: 0 };
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

  const commitSeen = useCallback((id: string) => {
    const ev = events.find(e => e.id === id);
    if (ev) toggleSeen({ id, seen: !ev.seen });
  }, [toggleSeen, events]);

  const { exitingIds, collapsingIds, triggerExit } = useRowExitAnimation(commitSeen);

  const handleToggleSeen = useCallback((id: string, seen: boolean) => {
    const willLeave = (tab === 'important' || tab === 'info') ? seen : tab === 'seen' ? !seen : false;
    if (willLeave) {
      triggerExit(id);
    } else {
      toggleSeen({ id, seen });
    }
  }, [toggleSeen, tab, triggerExit]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-flux-base">
      <div className={FLUX_TABLE_CARD}>
        <FluxTabBar
          tabs={TABS}
          activeTab={tab}
          counts={counts}
          onTabChange={setTab}
          testIdPrefix="report-tab"
        />

        {/* Table */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <table className={FLUX_TABLE}>
            <thead className={FLUX_THEAD}>
              <tr className={FLUX_HEADER_TR}>
                <SortableHeader col="type" active={sortCol} dir={sortDir} onSort={handleSort}>Type</SortableHeader>
                <SortableHeader col="job" active={sortCol} dir={sortDir} onSort={handleSort}>Job</SortableHeader>
                <SortableHeader col="task" active={sortCol} dir={sortDir} onSort={handleSort}>Tâche</SortableHeader>
                <SortableHeader col="offset" active={sortCol} dir={sortDir} onSort={handleSort}>Écart</SortableHeader>
                <SortableHeader col="station" active={sortCol} dir={sortDir} onSort={handleSort}>Station</SortableHeader>
                <SortableHeader col="operator" active={sortCol} dir={sortDir} onSort={handleSort}>Opérateur</SortableHeader>
                <SortableHeader col="time" active={sortCol} dir={sortDir} onSort={handleSort} align="right">Quand</SortableHeader>
                <th className={FLUX_HEADER_CELL}>Vu</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev) => (
                <EventRow key={ev.id} event={ev} exiting={exitingIds.has(ev.id)} collapsing={collapsingIds.has(ev.id)} onToggleSeen={handleToggleSeen} />
              ))}
            </tbody>
          </table>
          {isError && (
            <FluxEmptyState
              title={`Erreur lors du chargement des événements${error && 'status' in error ? ` (${error.status})` : ''}`}
              error
            />
          )}
          {isLoading && !isError && <FluxEmptyState title="Chargement…" />}
          {!isLoading && !isError && filtered.length === 0 && <FluxEmptyState title="Aucun événement" />}
        </div>
      </div>
    </div>
  );
}

/**
 * Simulation detail — read-only KPI strip + audit metadata.
 *
 * Mirrors ArchiveDetail (same KPI computation, same metadata table)
 * because conceptually a sim is a frozen-Preprod blob with a TTL +
 * label. Mutation is deferred to a later phase, so this is read-only;
 * the user's only action is "delete" (top-right).
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FlaskConical, AlertTriangle, CalendarRange, CircleDot, Hash, History, Tag, Trash2 } from 'lucide-react';
import { useGetSimulationQuery, useDeleteSimulationMutation } from '../store';

interface PayloadKpis {
  jobsTotal: number;
  jobsScheduled: number;
  lateJobs: number;
}

function computeKpis(payload: Record<string, unknown> | null): PayloadKpis | null {
  if (!payload) return null;
  const jobs = Array.isArray(payload.jobs) ? (payload.jobs as Array<Record<string, unknown>>) : [];
  const assignments = Array.isArray(payload.assignments)
    ? (payload.assignments as Array<Record<string, unknown>>)
    : [];
  const lateJobsArr = Array.isArray(payload.lateJobs)
    ? (payload.lateJobs as Array<Record<string, unknown>>)
    : [];

  const scheduledJobIds = new Set<string>();
  for (const a of assignments) {
    const id = a.jobId;
    if (typeof id === 'string') scheduledJobIds.add(id);
  }
  const lateScheduled = lateJobsArr.filter((j) => {
    const id = j.id ?? j.jobId;
    return typeof id === 'string' && scheduledJobIds.has(id);
  }).length;

  return { jobsTotal: jobs.length, jobsScheduled: scheduledJobIds.size, lateJobs: lateScheduled };
}

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'medium' });
}

function KpiTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'neutral' | 'warning';
}) {
  const valueColor = tone === 'warning' ? 'text-rose-300' : 'text-zinc-100';
  return (
    <div className="bg-zinc-900 rounded-md p-3 border border-zinc-800">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold ${valueColor}`}>{value}</div>
    </div>
  );
}

function MetadataRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] py-1.5">
      <div className="flex items-center gap-1.5 text-zinc-500 w-32 shrink-0">
        {icon}
        <span className="uppercase tracking-wider text-[10px]">{label}</span>
      </div>
      <div className={`text-zinc-200 truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

export function SimulationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: detail, isLoading, error } = useGetSimulationQuery(id ?? '', { skip: !id });
  const [deleteSimulation, deleteState] = useDeleteSimulationMutation();

  const kpis = useMemo(() => computeKpis(detail?.payload ?? null), [detail?.payload]);

  const handleDelete = async () => {
    if (!id || !detail) return;
    const ok = window.confirm(`Supprimer la simulation "${detail.name ?? id}" ?`);
    if (!ok) return;
    await deleteSimulation(id);
    navigate('/simulations');
  };

  if (!id) {
    return (
      <div className="p-6 text-xs text-rose-300">URL invalide.</div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-flux-bg text-flux-text-primary">
      <header className="px-5 py-3 border-b border-zinc-800 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/simulations')}
          className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          aria-label="Retour"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <FlaskConical size={16} className="text-violet-300" />
          <div>
            <div className="text-sm font-medium">{detail?.name ?? 'Simulation'}</div>
            <div className="text-[11px] text-zinc-500">
              Snapshot figé · TTL {formatStamp(detail?.ttlExpiresAt ?? null)}
            </div>
          </div>
        </div>
        {detail && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteState.isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-zinc-900 hover:bg-rose-950/50 hover:text-rose-300 border border-zinc-800 text-zinc-300 disabled:opacity-50"
          >
            <Trash2 size={13} />
            Supprimer
          </button>
        )}
      </header>

      {isLoading && <div className="p-6 text-xs text-zinc-500">Chargement…</div>}
      {error && (
        <div className="p-6 text-xs text-rose-300">
          Simulation introuvable. Elle a peut-être été reapée.
        </div>
      )}
      {detail && (
        <>
          <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-zinc-800">
            <KpiTile
              icon={<CircleDot size={12} className="text-zinc-300" />}
              label="Jobs total"
              value={kpis ? kpis.jobsTotal : '—'}
              tone="neutral"
            />
            <KpiTile
              icon={<CircleDot size={12} className="text-emerald-400" />}
              label="Jobs planifiés"
              value={kpis ? kpis.jobsScheduled : '—'}
              tone="neutral"
            />
            <KpiTile
              icon={<AlertTriangle size={12} className="text-rose-400" />}
              label="Jobs en retard"
              value={kpis ? kpis.lateJobs : '—'}
              tone="warning"
            />
          </div>

          <div className="px-5 py-4 flex-1 overflow-y-auto">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Audit</div>
            <MetadataRow icon={<Tag size={11} />} label="Nom" value={detail.name ?? '—'} />
            <MetadataRow icon={<CalendarRange size={11} />} label="Forkée le" value={formatStamp(detail.createdAt)} />
            <MetadataRow icon={<CalendarRange size={11} />} label="Dernière vue" value={formatStamp(detail.lastTouchedAt)} />
            <MetadataRow icon={<CalendarRange size={11} />} label="Expire le" value={formatStamp(detail.ttlExpiresAt)} />
            <MetadataRow icon={<History size={11} />} label="Engine" value={detail.engineVersion ?? '—'} mono />
            <MetadataRow icon={<Hash size={11} />} label="Algo hash" value={detail.algoParamsHash ?? '—'} mono />
            {detail.parentScenarioId && (
              <MetadataRow icon={<FlaskConical size={11} />} label="Forkée de" value={detail.parentScenarioId} mono />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Simulation detail — KPI strip + audit metadata + mutation editor +
 * convert-to-Préprod action.
 *
 * The chef can now queue mutations on the sim (cancel a job, push a
 * deadline, bump a priority) and apply them en bloc to Préprod via
 * the dwell-confirm convert dialog. Failure = transactional rollback,
 * the sim survives so the chef can fix and retry.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightCircle, FlaskConical, AlertTriangle, CalendarRange, CircleDot, Hash, History, Tag, Trash2 } from 'lucide-react';
import { useGetSimulationQuery, useDeleteSimulationMutation } from '../store';
import { MutationEditor } from '../components/SimulationBrowser/MutationEditor';
import { ConvertSimulationDialog } from '../components/SimulationBrowser/ConvertSimulationDialog';

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

interface PayloadJob {
  id: string;
  reference: string;
  description: string;
}

function extractJobs(payload: Record<string, unknown> | null): PayloadJob[] {
  if (!payload) return [];
  const raw = Array.isArray(payload.jobs) ? (payload.jobs as Array<Record<string, unknown>>) : [];
  return raw
    .map((j) => {
      const id = typeof j.id === 'string' ? j.id : null;
      if (!id) return null;
      const reference = typeof j.reference === 'string' ? j.reference : id.slice(0, 8);
      const description = typeof j.description === 'string'
        ? j.description
        : typeof j.intitule === 'string'
        ? (j.intitule as string)
        : '';
      return { id, reference, description };
    })
    .filter((j): j is PayloadJob => j !== null);
}

export function SimulationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: detail, isLoading, error } = useGetSimulationQuery(id ?? '', { skip: !id });
  const [deleteSimulation, deleteState] = useDeleteSimulationMutation();
  const [convertOpen, setConvertOpen] = useState(false);

  const kpis = useMemo(() => computeKpis(detail?.payload ?? null), [detail?.payload]);
  const jobs = useMemo(() => extractJobs(detail?.payload ?? null), [detail?.payload]);

  const handleDelete = async () => {
    if (!id || !detail) return;
    const ok = window.confirm(`Supprimer la simulation "${detail.name ?? id}" ?`);
    if (!ok) return;
    await deleteSimulation(id);
    navigate('/simulations');
  };

  const handleConverted = () => {
    setConvertOpen(false);
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConvertOpen(true)}
              disabled={detail.mutationCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="convert-trigger"
              title={detail.mutationCount === 0 ? 'Ajoute au moins une mutation pour convertir' : 'Appliquer les mutations à la préprod'}
            >
              <ArrowRightCircle size={13} />
              Convertir vers préprod
              {detail.mutationCount > 0 && (
                <span className="ml-1 px-1 rounded bg-violet-700 text-[10px] font-mono">
                  {detail.mutationCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteState.isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-zinc-900 hover:bg-rose-950/50 hover:text-rose-300 border border-zinc-800 text-zinc-300 disabled:opacity-50"
            >
              <Trash2 size={13} />
              Supprimer
            </button>
          </div>
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

          <div className="px-5 py-4 flex-1 overflow-y-auto space-y-4">
            <MutationEditor
              simulationId={detail.id}
              mutations={detail.mutations}
              jobs={jobs}
            />

            <div>
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
          </div>

          <ConvertSimulationDialog
            open={convertOpen}
            simulationId={detail.id}
            simulationName={detail.name ?? detail.id}
            mutations={detail.mutations}
            onClose={() => setConvertOpen(false)}
            onConverted={handleConverted}
          />
        </>
      )}
    </div>
  );
}

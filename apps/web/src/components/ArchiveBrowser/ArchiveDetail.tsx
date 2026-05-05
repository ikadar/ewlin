/**
 * Archive browser — right-pane detail view.
 *
 * Shows a 3-tile KPI strip computed from the archived snapshot, plus
 * audit metadata (engine version, algo hash, promoted-by) and the restore
 * action that opens the confirmation dialog. The KPIs are computed
 * client-side from the JSON blob — the snapshot has the canonical lateJobs
 * list already, so no extra round-trip is needed.
 */
import { useMemo, useState } from 'react';
import { Archive, AlertTriangle, CalendarRange, CircleDot, History, Hash, RotateCcw, User } from 'lucide-react';
import { useGetArchiveQuery } from '../../store';
import { RestoreDialog } from './RestoreDialog';

interface ArchiveDetailProps {
  archiveId: string;
  onRestored: (undoExpiresAt: string | null) => void;
}

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

  return {
    jobsTotal: jobs.length,
    jobsScheduled: scheduledJobIds.size,
    lateJobs: lateScheduled,
  };
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

export function ArchiveDetail({ archiveId, onRestored }: ArchiveDetailProps) {
  const { data: detail, isLoading, error } = useGetArchiveQuery(archiveId);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const kpis = useMemo(() => computeKpis(detail?.payload ?? null), [detail?.payload]);

  if (isLoading) {
    return (
      <div className="p-6 text-xs text-zinc-500">Chargement…</div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-6 text-xs text-rose-300">
        Archive introuvable. Elle a peut-être été purgée.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 py-3.5 border-b border-zinc-800 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-violet-600/15 border border-violet-600/30 flex items-center justify-center">
            <Archive size={16} className="text-violet-300" />
          </div>
          <div>
            <div className="text-sm font-medium">Archive</div>
            <div className="text-[11px] text-zinc-500">
              {formatStamp(detail.promotedAt)}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRestoreOpen(true)}
          disabled={detail.restoreAvailable === false}
          title={detail.restoreAvailable === false ? 'Archive antérieure à T6 — non restaurable' : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-violet-600 hover:bg-violet-500 text-white disabled:bg-zinc-700 disabled:hover:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed"
          data-testid="archive-restore-trigger"
        >
          <RotateCcw size={13} />
          Restaurer dans la prod
        </button>
      </header>

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
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
          Audit
        </div>
        <MetadataRow
          icon={<CalendarRange size={11} />}
          label="Promotion"
          value={formatStamp(detail.promotedAt)}
        />
        <MetadataRow
          icon={<User size={11} />}
          label="Promu par"
          value={detail.promotedByUserId ?? '—'}
          mono
        />
        <MetadataRow
          icon={<History size={11} />}
          label="Engine"
          value={detail.engineVersion ?? '—'}
          mono
        />
        <MetadataRow
          icon={<Hash size={11} />}
          label="Algo hash"
          value={detail.algoParamsHash ?? '—'}
          mono
        />
        {detail.promotedFromId && (
          <MetadataRow
            icon={<Archive size={11} />}
            label="Issue de"
            value={detail.promotedFromId}
            mono
          />
        )}
      </div>

      <RestoreDialog
        open={restoreOpen}
        archiveId={archiveId}
        archiveStamp={formatStamp(detail.promotedAt)}
        onClose={() => setRestoreOpen(false)}
        onRestored={(undoExpiresAt) => {
          setRestoreOpen(false);
          onRestored(undoExpiresAt);
        }}
      />
    </div>
  );
}

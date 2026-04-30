/**
 * Audit page — chronological table of every Prod plan ever engaged with
 * the workshop floor. The active Prod is pinned on top with a green
 * pulse; archives below newest-first. Each row carries the engine
 * version + algo hash that produced the underlying assignments — paired
 * together they let an auditor reproduce a promoted plan by re-running
 * the same engine binary with the same options against the same input
 * snapshot (ISO requirement).
 *
 * Read-only by design. Restoration goes through the dedicated
 * /archives/:id flow which has its own confirmation UX.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, FolderOpen } from 'lucide-react';
import { useGetAuditQuery } from '../store';
import type { AuditEntry } from '../store/api/archiveApi';
import {
  FLUX_TABLE, FLUX_THEAD, FLUX_HEADER_TR, FLUX_HEADER_CELL,
  FLUX_BODY_TR, FLUX_BODY_TR_STYLE, FLUX_BODY_CELL, FLUX_BODY_CELL_PRIMARY,
} from '../components/FluxStyledTable';

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
}

function StateBadge({ entry }: { entry: AuditEntry }) {
  if (entry.state === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-600/15 border border-emerald-600/30 text-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-300">
      Archive
    </span>
  );
}

export function AuditPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetAuditQuery();

  return (
    <div className="flex flex-col h-full bg-flux-bg text-flux-text-primary">
      <header className="px-5 py-3 border-b border-zinc-800 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          aria-label="Retour"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-violet-300" />
          <div>
            <div className="text-sm font-medium">Journal d'audit</div>
            <div className="text-[11px] text-zinc-500">
              Chaque promotion stampée avec son engine + hash d'algorithme (ISO)
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-6 text-xs text-zinc-500">Chargement…</div>
        )}
        {error && (
          <div className="p-6 text-xs text-rose-300">Impossible de charger le journal d'audit.</div>
        )}
        {data && data.entries.length === 0 && (
          <div className="p-12 text-center text-xs text-zinc-500">
            <ClipboardCheck size={20} className="mx-auto mb-2 text-zinc-600" />
            <div className="font-medium text-zinc-400 mb-1">Aucun événement à auditer</div>
            <div>Le journal se remplit à mesure des promotions et restaurations.</div>
          </div>
        )}
        {data && data.entries.length > 0 && (
          <table className={FLUX_TABLE}>
            <thead className={FLUX_THEAD}>
              <tr className={FLUX_HEADER_TR}>
                <th className={FLUX_HEADER_CELL}>État</th>
                <th className={FLUX_HEADER_CELL}>Promotion</th>
                <th className={FLUX_HEADER_CELL}>Engine</th>
                <th className={FLUX_HEADER_CELL}>Hash algo</th>
                <th className={FLUX_HEADER_CELL}>Promu par</th>
                <th className={FLUX_HEADER_CELL}></th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => (
                <tr
                  key={entry.id}
                  className={FLUX_BODY_TR}
                  style={FLUX_BODY_TR_STYLE}
                  data-testid={`audit-row-${entry.id}`}
                >
                  <td className={FLUX_BODY_CELL}>
                    <StateBadge entry={entry} />
                  </td>
                  <td className={FLUX_BODY_CELL_PRIMARY}>
                    {formatStamp(entry.promotedAt)}
                  </td>
                  <td className={`${FLUX_BODY_CELL} font-mono`}>
                    {entry.engineVersion ?? '—'}
                  </td>
                  <td className={`${FLUX_BODY_CELL} font-mono text-flux-text-muted`}>
                    {entry.algoParamsHash
                      ? `#${entry.algoParamsHash.slice(0, 12)}`
                      : '—'}
                  </td>
                  <td className={`${FLUX_BODY_CELL} font-mono text-flux-text-muted`}>
                    {entry.promotedByUserId ? `${entry.promotedByUserId.slice(0, 8)}…` : '—'}
                  </td>
                  <td className={`${FLUX_BODY_CELL} text-right whitespace-nowrap`}>
                    {entry.state === 'archived' && (
                      <button
                        type="button"
                        onClick={() => navigate(`/historique/archives/${entry.id}`)}
                        title="Ouvrir l'archive"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <FolderOpen className="w-4 h-4" strokeWidth={2} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

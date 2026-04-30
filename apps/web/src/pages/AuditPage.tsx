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
import { ArrowLeft, ClipboardCheck, ExternalLink } from 'lucide-react';
import { useGetAuditQuery } from '../store';
import type { AuditEntry } from '../store/api/archiveApi';

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
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
              <tr className="text-[10px] text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2 text-left font-medium">État</th>
                <th className="px-4 py-2 text-left font-medium">Promotion</th>
                <th className="px-4 py-2 text-left font-medium">Engine</th>
                <th className="px-4 py-2 text-left font-medium">Hash algo</th>
                <th className="px-4 py-2 text-left font-medium">Promu par</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {data.entries.map((entry) => (
                <tr
                  key={entry.id}
                  className={`${entry.state === 'active' ? 'bg-emerald-950/10' : 'hover:bg-zinc-900/40'}`}
                  data-testid={`audit-row-${entry.id}`}
                >
                  <td className="px-4 py-2.5">
                    <StateBadge entry={entry} />
                  </td>
                  <td className="px-4 py-2.5 text-zinc-200">
                    {formatStamp(entry.promotedAt)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-300">
                    {entry.engineVersion ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-500">
                    {entry.algoParamsHash
                      ? `#${entry.algoParamsHash.slice(0, 12)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-500">
                    {entry.promotedByUserId ? `${entry.promotedByUserId.slice(0, 8)}…` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {entry.state === 'archived' && (
                      <button
                        type="button"
                        onClick={() => navigate(`/historique/archives/${entry.id}`)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
                      >
                        Détail
                        <ExternalLink size={10} />
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

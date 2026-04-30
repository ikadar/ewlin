/**
 * Archives page — Flux-style flat table.
 *
 * URL contract:
 *   /historique/archives        — flat list, click row to open detail
 *   /historique/archives/:id    — full-width detail view
 *
 * After a successful restore the page navigates to /?env=prod and
 * surfaces the standard PromotionUndoToast (5-min undo).
 */
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, FolderOpen, History } from 'lucide-react';
import { useGetArchivesQuery } from '../store';
import { ArchiveDetail } from '../components/ArchiveBrowser';
import { PromotionUndoToast } from '../components/PromotionUndoToast/PromotionUndoToast';
import {
  FLUX_TABLE, FLUX_THEAD, FLUX_HEADER_TR, FLUX_HEADER_CELL,
  FLUX_BODY_TR, FLUX_BODY_TR_STYLE, FLUX_BODY_CELL, FLUX_BODY_CELL_PRIMARY,
} from '../components/FluxStyledTable';

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function describeAge(iso: string | null): string {
  if (!iso) return '';
  const ageMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

export function ArchivesPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [undoExpiresAt, setUndoExpiresAt] = useState<string | null>(null);

  const handleRestored = useCallback(
    (expiresAt: string | null) => {
      setUndoExpiresAt(expiresAt);
      navigate('/?env=prod');
    },
    [navigate],
  );

  // ── Detail view (when an id is in the URL) ──────────────────────────
  if (id) {
    return (
      <div className="flex flex-col h-full bg-flux-bg text-flux-text-primary">
        <header className="px-5 py-3 border-b border-zinc-800 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/historique/archives')}
            className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            aria-label="Retour à la liste"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-violet-300" />
            <div>
              <div className="text-sm font-medium">Détail de l'archive</div>
              <div className="text-[11px] text-zinc-500">Consulte le contenu et restaure si besoin</div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <ArchiveDetail archiveId={id} onRestored={handleRestored} />
        </div>
        <PromotionUndoToast
          expiresAt={undoExpiresAt}
          onUndone={() => setUndoExpiresAt(null)}
          onDismiss={() => setUndoExpiresAt(null)}
        />
      </div>
    );
  }

  // ── List view (flat Flux-style table) ───────────────────────────────
  return <ArchivesListView onUndo={() => setUndoExpiresAt(null)} undoExpiresAt={undoExpiresAt} />;
}

function ArchivesListView({
  undoExpiresAt,
  onUndo,
}: {
  undoExpiresAt: string | null;
  onUndo: () => void;
}) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetArchivesQuery();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-flux-base">
      <div className="flex-1 overflow-hidden">
        <div className="p-4 h-full">
          <div className="bg-flux-elevated rounded-lg border border-flux-border h-full overflow-hidden flex flex-col">
            <div className="border-b border-flux-border bg-flux-elevated px-6 py-4 flex items-center gap-2">
              <Archive className="w-4 h-4 text-violet-300" />
              <h1 className="text-xl font-semibold text-flux-text-primary">Archives</h1>
              <span className="text-flux-text-tertiary text-sm ml-2">
                {data?.archives.length ?? 0} archive{(data?.archives.length ?? 0) > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex-1 overflow-auto">
              {isLoading && <div className="p-6 text-xs text-flux-text-muted">Chargement…</div>}
              {error && (
                <div className="p-6 text-xs text-rose-300">
                  Impossible de charger les archives.
                </div>
              )}
              {data && data.archives.length === 0 && (
                <div className="p-12 text-center text-xs text-flux-text-muted">
                  <History size={20} className="mx-auto mb-2 text-flux-text-muted opacity-60" />
                  <div className="font-medium text-flux-text-secondary mb-1">Aucune archive pour l'instant</div>
                  <div>Une archive est créée automatiquement à chaque promotion.</div>
                </div>
              )}
              {data && data.archives.length > 0 && (
                <table className={FLUX_TABLE}>
                  <thead className={FLUX_THEAD}>
                    <tr className={FLUX_HEADER_TR}>
                      <th className={FLUX_HEADER_CELL}>Promotion</th>
                      <th className={FLUX_HEADER_CELL}>Âge</th>
                      <th className={FLUX_HEADER_CELL}>Engine</th>
                      <th className={FLUX_HEADER_CELL}>Hash algo</th>
                      <th className={FLUX_HEADER_CELL}>Promu par</th>
                      <th className={FLUX_HEADER_CELL}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.archives.map((archive) => (
                      <tr
                        key={archive.id}
                        className={FLUX_BODY_TR}
                        style={FLUX_BODY_TR_STYLE}
                        onClick={() => navigate(`/historique/archives/${archive.id}`)}
                        data-testid={`archive-row-${archive.id}`}
                      >
                        <td className={FLUX_BODY_CELL_PRIMARY}>
                          {formatStamp(archive.promotedAt)}
                        </td>
                        <td className={FLUX_BODY_CELL}>
                          {describeAge(archive.promotedAt)}
                        </td>
                        <td className={`${FLUX_BODY_CELL} font-mono`}>
                          {archive.engineVersion ?? '—'}
                        </td>
                        <td className={`${FLUX_BODY_CELL} font-mono text-flux-text-muted`}>
                          {archive.algoParamsHash
                            ? `#${archive.algoParamsHash.slice(0, 12)}`
                            : '—'}
                        </td>
                        <td className={`${FLUX_BODY_CELL} font-mono text-flux-text-muted`}>
                          {archive.promotedByUserId
                            ? `${archive.promotedByUserId.slice(0, 8)}…`
                            : '—'}
                        </td>
                        <td
                          className={`${FLUX_BODY_CELL} text-right whitespace-nowrap`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                            onClick={() => navigate(`/historique/archives/${archive.id}`)}
                            title="Ouvrir l'archive"
                          >
                            <FolderOpen className="w-4 h-4" strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <PromotionUndoToast
        expiresAt={undoExpiresAt}
        onUndone={onUndo}
        onDismiss={onUndo}
      />
    </div>
  );
}

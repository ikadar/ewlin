/**
 * Archives page — split layout (list ◾ detail).
 *
 * URL contract:
 *   /archives          — list only (right pane shows empty-state)
 *   /archives/:id      — list + detail
 *
 * After a successful restore the page navigates to /?env=prod (live prod
 * view) and surfaces the standard PromotionUndoToast so the operator can
 * roll back within 5 min if the restore was a misclick.
 */
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft } from 'lucide-react';
import { ArchiveList, ArchiveDetail } from '../components/ArchiveBrowser';
import { PromotionUndoToast } from '../components/PromotionUndoToast/PromotionUndoToast';

export function ArchivesPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [undoExpiresAt, setUndoExpiresAt] = useState<string | null>(null);

  const handleSelect = useCallback(
    (archiveId: string) => {
      navigate(`/archives/${archiveId}`);
    },
    [navigate],
  );

  const handleRestored = useCallback(
    (expiresAt: string | null) => {
      setUndoExpiresAt(expiresAt);
      navigate('/?env=prod');
    },
    [navigate],
  );

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
          <Archive size={16} className="text-violet-300" />
          <div>
            <div className="text-sm font-medium">Archives</div>
            <div className="text-[11px] text-zinc-500">
              Historique des prods promues, restauration au-delà des 5 min
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[320px_1fr] min-h-0">
        <aside className="border-r border-zinc-800 overflow-y-auto">
          <ArchiveList selectedId={id ?? null} onSelect={handleSelect} />
        </aside>
        <section className="overflow-hidden">
          {id ? (
            <ArchiveDetail archiveId={id} onRestored={handleRestored} />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-zinc-500">
              Sélectionne une archive pour voir le détail.
            </div>
          )}
        </section>
      </div>

      <PromotionUndoToast
        expiresAt={undoExpiresAt}
        onUndone={() => setUndoExpiresAt(null)}
        onDismiss={() => setUndoExpiresAt(null)}
      />
    </div>
  );
}

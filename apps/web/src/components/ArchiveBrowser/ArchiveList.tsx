/**
 * Archive browser — left-rail list.
 *
 * Newest-first vertical list of archive cards. Click selects, double-click
 * is reserved for v1.x quick actions. Selection is purely visual; the
 * detail view drives off the URL `:id` segment so deep-linking works.
 */
import { History } from 'lucide-react';
import { useGetArchivesQuery } from '../../store';
import type { ArchiveSummary } from '../../store/api/archiveApi';

interface ArchiveListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function describeAge(iso: string | null): string {
  if (!iso) return '';
  const ageMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

function ArchiveCard({
  archive,
  isSelected,
  onSelect,
}: {
  archive: ArchiveSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors ${
        isSelected
          ? 'bg-zinc-800/60 border-l-violet-400'
          : 'bg-zinc-900/40 border-l-transparent hover:bg-zinc-900/70'
      }`}
      data-testid={`archive-list-item-${archive.id}`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <div className="text-xs font-medium text-zinc-100">
          {formatStamp(archive.promotedAt)}
        </div>
        <div className="text-[10px] text-zinc-500">{describeAge(archive.promotedAt)}</div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
        <span className="font-mono truncate">
          {archive.engineVersion ?? 'engine ?'}
        </span>
        {archive.algoParamsHash && (
          <span className="font-mono text-zinc-600">
            #{archive.algoParamsHash.slice(0, 6)}
          </span>
        )}
      </div>
    </button>
  );
}

export function ArchiveList({ selectedId, onSelect }: ArchiveListProps) {
  const { data, isLoading, error } = useGetArchivesQuery();

  if (isLoading) {
    return (
      <div className="p-4 text-xs text-zinc-500 flex items-center gap-2">
        <History size={14} className="animate-pulse" />
        Chargement des archives…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-xs text-rose-300">
        Impossible de charger les archives.
      </div>
    );
  }

  const archives = data?.archives ?? [];

  if (archives.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-zinc-500">
        <History size={20} className="mx-auto mb-2 text-zinc-600" />
        <div className="font-medium text-zinc-400 mb-1">Aucune archive pour l'instant</div>
        <div>Une archive est créée automatiquement à chaque promotion.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-zinc-900" data-testid="archive-list">
      {archives.map((archive) => (
        <ArchiveCard
          key={archive.id}
          archive={archive}
          isSelected={archive.id === selectedId}
          onSelect={() => onSelect(archive.id)}
        />
      ))}
    </div>
  );
}

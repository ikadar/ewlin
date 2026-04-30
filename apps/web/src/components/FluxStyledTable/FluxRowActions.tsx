import { Trash2, FolderOpen } from 'lucide-react';

interface FluxRowActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  editTitle?: string;
  deleteTitle?: string;
  editTestId?: string;
  deleteTestId?: string;
  /** Render an extra slot before the standard pair (e.g. a "Promote" pill). */
  before?: React.ReactNode;
}

/**
 * Standardised "delete + open/edit" action pair, identical to the
 * pattern used in FluxTable's frozen right column:
 *
 *   <Trash2 red>  <FolderOpen blue>
 *
 * Both are icon-only, no border/background, just the colour. Drop
 * this in the rightmost <td> of any row to align with /flux.
 */
export function FluxRowActions({
  onEdit,
  onDelete,
  editTitle = 'Modifier',
  deleteTitle = 'Supprimer',
  editTestId,
  deleteTestId,
  before,
}: FluxRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {before}
      {onDelete && (
        <button
          className="text-red-400 hover:text-red-300 transition-colors"
          onClick={onDelete}
          title={deleteTitle}
          data-testid={deleteTestId}
        >
          <Trash2 className="w-4 h-4" strokeWidth={2} />
        </button>
      )}
      {onEdit && (
        <button
          className="text-blue-400 hover:text-blue-300 transition-colors"
          onClick={onEdit}
          title={editTitle}
          data-testid={editTestId}
        >
          <FolderOpen className="w-4 h-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

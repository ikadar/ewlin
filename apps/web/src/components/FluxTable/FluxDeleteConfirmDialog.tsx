/**
 * Delete confirmation dialog for the Flux dashboard (qa.md K6.1).
 * Rendered by FluxPage when a delete action is triggered.
 */
export function FluxDeleteConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
      data-testid="flux-delete-dialog-backdrop"
    >
      {/* Dialog card */}
      <div
        className="bg-flux-elevated border border-flux-border rounded-lg p-6 shadow-xl"
        style={{ minWidth: '22rem' }}
        onClick={e => e.stopPropagation()}
        data-testid="flux-delete-dialog"
      >
        <h2 className="text-flux-text-primary font-semibold mb-2">
          Supprimer le job ?
        </h2>
        <p className="text-flux-text-secondary mb-6" style={{ fontSize: '13px' }}>
          Cette action est irréversible.
        </p>

        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded text-sm text-flux-text-secondary hover:bg-flux-hover border border-flux-border transition-colors"
            onClick={onCancel}
            data-testid="flux-delete-cancel"
          >
            Annuler
          </button>
          <button
            className="px-4 py-2 rounded text-sm bg-red-700 hover:bg-red-600 text-white font-medium transition-colors"
            onClick={onConfirm}
            data-testid="flux-delete-confirm"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

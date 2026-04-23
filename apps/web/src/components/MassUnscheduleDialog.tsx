import type { MassUnscheduleState } from '../hooks/useMassUnschedule';

interface Props {
  state: MassUnscheduleState;
  getClearableCount: (
    includeInProgress?: boolean,
    includePinned?: boolean,
    includeFrozen?: boolean,
  ) => number;
  onConfirm: () => void;
  onDismiss: () => void;
  onUpdate: (updater: (prev: MassUnscheduleState | null) => MassUnscheduleState | null) => void;
}

export function MassUnscheduleDialog({ state, getClearableCount, onConfirm, onDismiss, onUpdate }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
         onClick={onDismiss}
         onKeyDown={e => { if (e.key === 'Escape') onDismiss(); }}
         tabIndex={-1}
         ref={el => el?.focus()}>
      <div className="bg-flux-elevated border border-flux-border rounded-lg p-6 shadow-xl"
           style={{ width: '28rem' }}
           onClick={e => e.stopPropagation()}>
        <h2 className="text-flux-text-primary font-semibold mb-3">
          Effacer toutes les tuiles
        </h2>
        <p className="text-flux-text-secondary mb-1" style={{ fontSize: '13px' }}>
          Les tuiles terminées seront toujours conservées.
        </p>
        <p className="text-flux-text-primary font-mono mb-4" style={{ fontSize: '13px' }}>
          {getClearableCount(state.includeInProgress, state.includePinned, state.includeFrozen)} tuile(s) à effacer
        </p>
        <div className="flex flex-col gap-2 mb-6">
          <label className="flex items-center gap-2 cursor-pointer text-flux-text-secondary" style={{ fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={state.includeInProgress}
              onChange={(e) => onUpdate((prev) => prev ? { ...prev, includeInProgress: e.target.checked } : prev)}
              className="accent-red-600"
            />
            Inclure les tuiles en cours d'exécution
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-flux-text-secondary" style={{ fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={state.fuseSplits}
              onChange={(e) => onUpdate((prev) => prev ? { ...prev, fuseSplits: e.target.checked } : prev)}
              className="accent-red-600"
            />
            Fusionner les tuiles splittées
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-flux-text-secondary" style={{ fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={state.includePinned}
              onChange={(e) => onUpdate((prev) => prev ? { ...prev, includePinned: e.target.checked } : prev)}
              className="accent-red-600"
            />
            Inclure les tuiles épinglées
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-flux-text-secondary" style={{ fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={state.includeFrozen}
              onChange={(e) => onUpdate((prev) => prev ? { ...prev, includeFrozen: e.target.checked } : prev)}
              className="accent-red-600"
            />
            Inclure les tuiles avec flocon actif (safety zone)
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 rounded text-sm text-flux-text-secondary hover:bg-flux-hover border border-flux-border transition-colors"
                  onClick={onDismiss}>
            Annuler
          </button>
          <button className="px-4 py-2 rounded text-sm bg-red-700 hover:bg-red-600 text-white font-medium transition-colors"
                  onClick={onConfirm}>
            Tout effacer
          </button>
        </div>
      </div>
    </div>
  );
}

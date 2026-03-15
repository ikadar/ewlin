import { useEffect } from 'react';
import { useAutoPlaceAllStream } from '../../hooks/useAutoPlaceAllStream';

interface AutoPlaceAllModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal for global auto-placement (CTRL+ALT+P).
 *
 * Three states:
 * 1. Confirm — "Auto-place all unscheduled tiles?" + Cancel/Start
 * 2. Running — Progress bar + current job reference + running total
 * 3. Complete — Summary "X tiles placed across Y jobs in Zms" + Close
 */
export function AutoPlaceAllModal({ isOpen, onClose }: AutoPlaceAllModalProps) {
  const { start, cancel, progress, isRunning, error } = useAutoPlaceAllStream();

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    // Fresh state each time modal opens — hook resets on start()
  }, [isOpen]);

  if (!isOpen) return null;

  const isComplete = progress?.type === 'complete';
  const hasError = error !== null || progress?.type === 'error';
  const percentage = progress && progress.totalJobs > 0
    ? Math.round((progress.jobIndex / progress.totalJobs) * 100)
    : 0;

  const handleClose = () => {
    if (isRunning) {
      cancel();
    }
    onClose();
  };

  // State 1: Confirm
  if (!isRunning && !isComplete && !hasError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
           style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
           onClick={handleClose}>
        <div className="bg-flux-elevated border border-flux-border rounded-lg p-6 shadow-xl"
             style={{ minWidth: '22rem' }}
             onClick={e => e.stopPropagation()}>
          <h2 className="text-flux-text-primary font-semibold mb-2">
            Placer toutes les tuiles non planifiées ?
          </h2>
          <p className="text-flux-text-secondary mb-6" style={{ fontSize: '13px' }}>
            Toutes les tâches non planifiées de tous les jobs seront placées
            avec l'algorithme EDD + ASAP. Les jobs avec des deadlines plus proches sont prioritaires.
          </p>
          <div className="flex justify-end gap-3">
            <button className="px-4 py-2 rounded text-sm text-flux-text-secondary hover:bg-flux-hover border border-flux-border transition-colors"
                    onClick={handleClose}>
              Annuler
            </button>
            <button className="px-4 py-2 rounded text-sm bg-blue-700 hover:bg-blue-600 text-white font-medium transition-colors"
                    onClick={start}>
              Démarrer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Running / State 3: Complete / Error
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-flux-elevated border border-flux-border rounded-lg p-6 shadow-xl"
           style={{ minWidth: '26rem' }}
           onClick={e => e.stopPropagation()}>
        <h2 className="text-flux-text-primary font-semibold mb-4">
          {hasError ? 'Erreur de placement' : isComplete ? 'Placement terminé' : 'Placement en cours...'}
        </h2>

        {/* Progress bar */}
        <div className="w-full bg-flux-surface rounded-full h-3 mb-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${hasError ? 'bg-red-600' : isComplete ? 'bg-green-600' : 'bg-blue-600'}`}
            style={{ width: `${isComplete ? 100 : percentage}%` }}
          />
        </div>

        {/* Status text */}
        <div className="text-flux-text-secondary mb-4" style={{ fontSize: '13px' }}>
          {hasError && (
            <p className="text-red-400">{error || progress?.message || 'Unknown error'}</p>
          )}
          {isRunning && progress && (
            <>
              <p>Job {progress.jobIndex}/{progress.totalJobs} : <span className="text-flux-text-primary font-medium">{progress.jobReference}</span></p>
              <p>{progress.totalPlacedCount} tuile(s) placée(s)</p>
            </>
          )}
          {isComplete && progress && (
            <p>
              {progress.totalPlacedCount} tuile(s) placée(s) sur {progress.totalJobs} job(s)
              {progress.computeMs != null && ` en ${progress.computeMs}ms`}
            </p>
          )}
        </div>

        {/* Close button (only when done or error) */}
        {(isComplete || hasError) && (
          <div className="flex justify-end">
            <button className="px-4 py-2 rounded text-sm bg-flux-hover hover:bg-flux-hover-strong text-flux-text-primary border border-flux-border transition-colors"
                    onClick={handleClose}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

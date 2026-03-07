import { useState } from 'react';
import { Save, Upload, Trash2, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  useGetSavedSchedulesQuery,
  useSaveScheduleMutation,
  useLoadScheduleMutation,
  useDeleteSavedScheduleMutation,
} from '../../store';
import type { LoadScheduleResponse } from '../../store/api/scheduleApi';

function LoadSummaryView({ result, onClose }: { result: LoadScheduleResponse; onClose: () => void }) {
  const filteredCount = result.warnings.filter(
    (w) => w.type === 'task_filtered_deleted' || w.type === 'task_filtered_cancelled' || w.type === 'target_filtered_deleted'
  ).length;
  const recalculatedCount = result.warnings.filter(
    (w) => w.type === 'end_time_recalculated'
  ).length;
  const hasWarnings = filteredCount > 0 || recalculatedCount > 0;

  return (
    <div className="px-5 py-6" data-testid="load-summary">
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
        <h2 className="text-flux-text-primary font-semibold text-base">Chargement terminé</h2>
      </div>

      <p className="text-sm text-flux-text-secondary mb-4">
        {result.assignmentCount} assignments chargés
      </p>

      {hasWarnings && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-4" data-testid="load-warnings">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm font-medium text-amber-300">Avertissements</span>
          </div>
          <ul className="text-sm text-flux-text-secondary space-y-1">
            {filteredCount > 0 && (
              <li>{filteredCount} tâche(s) filtrée(s)</li>
            )}
            {recalculatedCount > 0 && (
              <li>{recalculatedCount} fin(s) recalculée(s)</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          data-testid="load-summary-close"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

export interface ScheduleSaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduleSaveLoadModal({ isOpen, onClose }: ScheduleSaveLoadModalProps) {
  const [saveName, setSaveName] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'load' | 'delete'; id: string; name: string } | null>(null);
  const [loadResult, setLoadResult] = useState<LoadScheduleResponse | null>(null);

  const { data: savedSchedules = [], isLoading } = useGetSavedSchedulesQuery(undefined, { skip: !isOpen });
  const [saveSchedule, { isLoading: isSaving }] = useSaveScheduleMutation();
  const [loadSchedule, { isLoading: isLoadingSchedule }] = useLoadScheduleMutation();
  const [deleteSavedSchedule, { isLoading: isDeleting }] = useDeleteSavedScheduleMutation();

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    await saveSchedule({ name: trimmed });
    setSaveName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'load') {
      try {
        const result = await loadSchedule(confirmAction.id).unwrap();
        setConfirmAction(null);
        setLoadResult(result);
      } catch {
        setConfirmAction(null);
      }
    } else {
      await deleteSavedSchedule(confirmAction.id);
      setConfirmAction(null);
    }
  };

  const handleCloseSummary = () => {
    setLoadResult(null);
    onClose();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isBusy = isSaving || isLoadingSchedule || isDeleting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
      data-testid="schedule-save-load-backdrop"
    >
      <div
        className="bg-flux-elevated border border-flux-border rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="schedule-save-load-modal"
      >
        {loadResult ? (
          <LoadSummaryView result={loadResult} onClose={handleCloseSummary} />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-flux-border">
              <h2 className="text-flux-text-primary font-semibold text-base">Sauvegardes</h2>
              <button
                onClick={onClose}
                className="text-flux-text-secondary hover:text-flux-text-primary transition-colors"
                data-testid="schedule-save-load-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Save section */}
            <div className="px-5 py-4 border-b border-flux-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nom de la sauvegarde..."
                  maxLength={100}
                  className="flex-1 px-3 py-2 rounded bg-flux-base border border-flux-border text-flux-text-primary text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  data-testid="schedule-save-name-input"
                  disabled={isBusy}
                />
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim() || isBusy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="schedule-save-button"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Sauvegarder
                </button>
              </div>
            </div>

            {/* List section */}
            <div className="px-5 py-3 max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                </div>
              ) : savedSchedules.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-6">Aucune sauvegarde</p>
              ) : (
                <div className="space-y-1">
                  {savedSchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-flux-hover group transition-colors"
                      data-testid={`saved-schedule-${schedule.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-flux-text-primary font-medium truncate">{schedule.name}</div>
                        <div className="text-xs text-zinc-500">
                          {schedule.assignmentCount} assignments &middot; {formatDate(schedule.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setConfirmAction({ type: 'load', id: schedule.id, name: schedule.name })}
                          disabled={isBusy}
                          className="p-1.5 rounded text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                          title="Charger"
                          data-testid={`load-schedule-${schedule.id}`}
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmAction({ type: 'delete', id: schedule.id, name: schedule.name })}
                          disabled={isBusy}
                          className="p-1.5 rounded text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          title="Supprimer"
                          data-testid={`delete-schedule-${schedule.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirmation dialog overlay */}
            {confirmAction && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                onClick={() => setConfirmAction(null)}
                data-testid="confirm-dialog-backdrop"
              >
                <div
                  className="bg-flux-elevated border border-flux-border rounded-lg p-6 shadow-xl"
                  style={{ minWidth: '22rem' }}
                  onClick={(e) => e.stopPropagation()}
                  data-testid="confirm-dialog"
                >
                  <h3 className="text-flux-text-primary font-semibold mb-2">
                    {confirmAction.type === 'load' ? 'Charger la sauvegarde ?' : 'Supprimer la sauvegarde ?'}
                  </h3>
                  <p className="text-flux-text-secondary mb-1 text-sm font-medium">
                    {confirmAction.name}
                  </p>
                  <p className="text-flux-text-secondary mb-6" style={{ fontSize: '13px' }}>
                    {confirmAction.type === 'load'
                      ? 'Cela remplacera tous les assignments actuels.'
                      : 'Cette action est irréversible.'}
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      className="px-4 py-2 rounded text-sm text-flux-text-secondary hover:bg-flux-hover border border-flux-border transition-colors"
                      onClick={() => setConfirmAction(null)}
                      data-testid="confirm-cancel"
                    >
                      Annuler
                    </button>
                    <button
                      className={`px-4 py-2 rounded text-sm font-medium text-white transition-colors ${
                        confirmAction.type === 'load'
                          ? 'bg-blue-600 hover:bg-blue-500'
                          : 'bg-red-700 hover:bg-red-600'
                      }`}
                      onClick={handleConfirm}
                      disabled={isBusy}
                      data-testid="confirm-ok"
                    >
                      {isBusy && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}
                      {confirmAction.type === 'load' ? 'Charger' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

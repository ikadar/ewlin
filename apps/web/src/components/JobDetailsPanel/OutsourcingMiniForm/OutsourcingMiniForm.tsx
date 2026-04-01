import { memo, useCallback, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { OutsourcedTask, OutsourcedProvider } from '@flux/types';
import { calculateOutsourcingDates, formatOutsourcingDateTime } from '../../../utils/outsourcingCalculation';

export interface OutsourcingMiniFormProps {
  task: OutsourcedTask;
  provider: OutsourcedProvider | undefined;
  jobColor: string;
  predecessorEndTime?: string;
  workshopExitDate?: string;
  onDepartureChange?: (taskId: string, departure: Date | undefined) => void;
  onReturnChange?: (taskId: string, returnDate: Date | undefined) => void;
  isLastTaskOfJob?: boolean;
  isPlaced?: boolean;
  /** Inline icons (circle, pin) rendered in the header row */
  headerIcons?: React.ReactNode;
}

export const OutsourcingMiniForm = memo(function OutsourcingMiniForm({
  task,
  provider,
  jobColor,
  predecessorEndTime,
  onDepartureChange,
  onReturnChange,
  isLastTaskOfJob,
  isPlaced = false,
  headerIcons,
}: OutsourcingMiniFormProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDep, setModalDep] = useState('');
  const [modalRet, setModalRet] = useState('');
  // Convert ISO/Date to YYYY-MM-DDTHH:mm for native datetime-local
  const toNative = (d: string | undefined): string => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  // Build today's date at a given HH:MM time for default picker values
  const toNativeWithDefaultTime = (time: string): string => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const [hh, min] = time.split(':');
    return `${yyyy}-${mm}-${dd}T${(hh ?? '12').padStart(2, '0')}:${(min ?? '00').padStart(2, '0')}`;
  };

  const calculatedDates = useMemo(() => {
    if (!provider || !predecessorEndTime) return null;
    return calculateOutsourcingDates(predecessorEndTime, {
      workDays: task.duration.openDays,
      latestDepartureTime: provider.latestDepartureTime,
      receptionTime: provider.receptionTime,
      transitDays: provider.transitDays,
      oneWay: isLastTaskOfJob,
    });
  }, [predecessorEndTime, provider, task.duration.openDays, isLastTaskOfJob]);

  const handleClearAllDates = useCallback(() => {
    onDepartureChange?.(task.id, undefined);
    onReturnChange?.(task.id, undefined);
  }, [task.id, onDepartureChange, onReturnChange]);

  const providerName = provider?.name ?? 'Unknown Provider';
  const hasManualDep = !!task.manualDeparture;
  const hasManualRet = !!task.manualReturn;
  const hasAnyManual = hasManualDep || (hasManualRet && !isLastTaskOfJob);

  const fmt = (d: Date | string | undefined): string => {
    if (!d) return '';
    return formatOutsourcingDateTime(d);
  };

  // Modal open: pre-fill with manual dates → calculated dates → provider default times
  const openModal = useCallback(() => {
    const calcDep = calculatedDates?.departure ? toNative(calculatedDates.departure.toISOString()) : '';
    const calcRet = calculatedDates?.return ? toNative(calculatedDates.return.toISOString()) : '';
    const fallbackDep = calcDep || (provider ? toNativeWithDefaultTime(provider.latestDepartureTime) : '');
    const fallbackRet = calcRet || (provider ? toNativeWithDefaultTime(provider.receptionTime) : '');
    setModalDep(task.manualDeparture ? toNative(task.manualDeparture) : fallbackDep);
    setModalRet(task.manualReturn ? toNative(task.manualReturn) : fallbackRet);
    setIsModalOpen(true);
  }, [task.manualDeparture, task.manualReturn, provider, calculatedDates]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleModalSave = useCallback(() => {
    const depDate = modalDep ? new Date(modalDep) : null;
    const retDate = modalRet ? new Date(modalRet) : null;

    if (depDate && !isNaN(depDate.getTime())) {
      onDepartureChange?.(task.id, depDate);
    } else if (!modalDep && hasManualDep) {
      onDepartureChange?.(task.id, undefined);
    }

    if (!isLastTaskOfJob) {
      if (retDate && !isNaN(retDate.getTime())) {
        onReturnChange?.(task.id, retDate);
      } else if (!modalRet && hasManualRet) {
        onReturnChange?.(task.id, undefined);
      }
    }

    setIsModalOpen(false);
  }, [modalDep, modalRet, task.id, isLastTaskOfJob, hasManualDep, hasManualRet, onDepartureChange, onReturnChange]);

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  }, [closeModal]);

  // Validation: departure always required, return required for non-terminal
  const canSave = modalDep !== '' && (isLastTaskOfJob || modalRet !== '');

  return (
    <>
      <div
        className="text-sm border-l-4 bg-zinc-900/50"
        style={{ borderLeftColor: jobColor }}
        data-testid={`outsourcing-mini-form-${task.id}`}
      >
        {/* Header */}
        <div className="px-2 py-1 flex items-center gap-1.5" style={isPlaced ? undefined : { backgroundColor: `${jobColor}15` }}>
          {headerIcons}
          <span className="font-medium truncate" style={{ color: jobColor }}>{task.actionType}</span>
        </div>

        {/* Body */}
        <div className="px-2 py-1.5">
          <div className="text-xs text-zinc-500 mb-1">{providerName} · {task.duration.openDays} JO</div>

          {/* Departure */}
          <div className="flex items-center gap-1 text-xs leading-relaxed">
            <span className="text-zinc-500">Départ</span>
            {hasManualDep ? (
              <span className="font-mono text-zinc-100">{fmt(task.manualDeparture)}</span>
            ) : predecessorEndTime && calculatedDates?.departure ? (
              <span className="font-mono text-zinc-500">{fmt(calculatedDates.departure)}</span>
            ) : (
              <span className="text-zinc-600 italic">non calculable</span>
            )}
          </div>

          {/* Return */}
          {isLastTaskOfJob ? (
            <div className="text-xs text-zinc-600 italic leading-relaxed">Aller simple</div>
          ) : (
            <div className="flex items-center gap-1 text-xs leading-relaxed">
              <span className="text-zinc-500">Retour</span>
              {hasManualRet ? (
                <span className="font-mono text-zinc-100">{fmt(task.manualReturn)}</span>
              ) : predecessorEndTime && calculatedDates?.return ? (
                <span className="font-mono text-zinc-500">{fmt(calculatedDates.return)}</span>
              ) : (
                <span className="text-zinc-600 italic">non calculable</span>
              )}
            </div>
          )}

          {/* Link */}
          {(onDepartureChange || onReturnChange) && (
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={openModal}
                className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline bg-transparent border-none cursor-pointer p-0"
              >
                {hasAnyManual ? 'Modifier les dates' : 'Saisir des dates manuelles'}
              </button>
              {hasAnyManual && (
                <button
                  onClick={handleClearAllDates}
                  className="text-zinc-600 hover:text-red-400 transition-colors leading-none"
                  title="Supprimer toutes les dates manuelles"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Date entry modal */}
      {isModalOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={closeModal}
          onKeyDown={handleModalKeyDown}
          tabIndex={-1}
          ref={el => el?.focus()}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 shadow-xl"
            style={{ width: '22rem' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-zinc-100 font-semibold text-sm mb-1">Dates de sous-traitance</h2>
            <div className="text-xs text-zinc-500 mb-4">{task.actionType} · {providerName} · {task.duration.openDays} JO</div>

            {/* Calculated dates info */}
            {predecessorEndTime && calculatedDates && (
              <div className="mb-3">
                <div className="text-xs text-zinc-600 mb-1 font-medium uppercase tracking-wide" style={{ fontSize: '10px' }}>Dates calculées</div>
                <div className="text-xs text-zinc-500 font-mono">
                  Dép: {fmt(calculatedDates.departure)}
                  {!isLastTaskOfJob && calculatedDates.return && ` · Ret: ${fmt(calculatedDates.return)}`}
                </div>
              </div>
            )}

            {/* Manual date inputs */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Départ manuel</label>
                <input
                  type="datetime-local"
                  value={modalDep}
                  onChange={e => setModalDep(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Retour manuel{isLastTaskOfJob && <span className="text-zinc-600 italic"> (Aller simple)</span>}
                </label>
                <input
                  type="datetime-local"
                  value={isLastTaskOfJob ? '' : modalRet}
                  onChange={e => setModalRet(e.target.value)}
                  disabled={isLastTaskOfJob}
                  className="w-full px-2 py-1.5 text-sm font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:border-blue-500 [color-scheme:dark] disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeModal}
                className="px-3 py-1.5 rounded text-xs text-zinc-300 hover:bg-zinc-800 border border-zinc-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleModalSave}
                disabled={!canSave}
                className="px-3 py-1.5 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

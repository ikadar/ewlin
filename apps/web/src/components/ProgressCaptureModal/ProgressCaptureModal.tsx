/**
 * ProgressCaptureModal v6 — 3-variant progress capture modal.
 *
 * Variants (derived from scheduledStart/End vs now):
 *   - in-progress: stepper "Je finirai à :" + blocked sub-mode
 *   - done-past-end: stepper "J'ai terminé à :"
 *   - future-blocked: predecessor info, no stepper
 *
 * The modal owns the stepper state. The parent (SaisieModalContext) owns
 * the RTK Query mutations and blocking callbacks.
 */
import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { Clock, AlertTriangle, X } from 'lucide-react';
import { IdentitySection } from './IdentitySection';
import { TriptychSection } from './TriptychSection';
import { ProgressBand } from './ProgressBand';
import { NonLinearStepper } from './NonLinearStepper';
import { BlockedMode } from './BlockedMode';
import { PredecessorCard, type PredecessorInfo } from './PredecessorCard';
import { isoToMinFromMidnight } from '../Tile/saisieMath';

export type SaisieVariant = 'in-progress' | 'done-past-end' | 'future-blocked';

export function deriveSaisieVariant(scheduledStart: string, scheduledEnd: string, now: Date): SaisieVariant {
  const startMs = new Date(scheduledStart).getTime();
  const endMs = new Date(scheduledEnd).getTime();
  const nowMs = now.getTime();
  if (nowMs < startMs) return 'future-blocked';
  if (nowMs >= endMs) return 'done-past-end';
  return 'in-progress';
}

export interface ProgressCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (estimatedEndMin: number) => Promise<void> | void;

  job: { reference: string; client: string; designation?: string };
  machineName: string;
  operatorName: string;

  scheduledStart: string;
  scheduledEnd: string;
  now: Date;
  setupMinutes: number;

  slotVolumePct?: number;
  tileColor?: string;

  onBlockPrerequisite?: () => Promise<void>;
  onBlockMachine?: () => Promise<void>;
  onBlockAbsence?: () => Promise<void>;

  predecessorInfo?: PredecessorInfo | null;
}

export function ProgressCaptureModal({
  isOpen,
  onClose,
  onSave,
  job,
  machineName,
  operatorName,
  scheduledStart,
  scheduledEnd,
  now,
  setupMinutes,
  slotVolumePct,
  tileColor,
  onBlockPrerequisite,
  onBlockMachine,
  onBlockAbsence,
  predecessorInfo,
}: ProgressCaptureModalProps): ReactElement | null {
  const [saving, setSaving] = useState(false);
  const [blockedMode, setBlockedMode] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [currentTimeMin, setCurrentTimeMin] = useState(0);

  const slotStartMin = isoToMinFromMidnight(scheduledStart);
  const slotEndMin = isoToMinFromMidnight(scheduledEnd);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const variant = deriveSaisieVariant(scheduledStart, scheduledEnd, now);

  useEffect(() => {
    if (isOpen) {
      setCurrentTimeMin(slotEndMin);
      setSaving(false);
      setBlockedMode(false);
      setSelectedReason(null);
    }
  }, [isOpen, slotEndMin]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleTimeChange = useCallback((timeMin: number) => {
    setCurrentTimeMin(timeMin);
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave(currentTimeMin));
      onClose();
    } finally {
      setSaving(false);
    }
  }, [saving, onSave, currentTimeMin, onClose]);

  const handleBlockSignal = useCallback(async () => {
    if (!selectedReason || saving) return;
    setSaving(true);
    try {
      const callbacks: Record<string, (() => Promise<void>) | undefined> = {
        prerequis: onBlockPrerequisite,
        machine: onBlockMachine,
        absence: onBlockAbsence,
      };
      const cb = callbacks[selectedReason];
      if (cb) await cb();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [selectedReason, saving, onBlockPrerequisite, onBlockMachine, onBlockAbsence, onClose]);

  if (!isOpen) return null;

  const headerTitle = blockedMode ? 'Je suis bloqué(e)' : 'Avancement';
  const HeaderIcon = blockedMode ? AlertTriangle : Clock;
  const headerIconClass = blockedMode ? 'text-amber-300' : 'text-flux-text-secondary';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
      data-testid="progress-capture-modal"
    >
      <div
        className="bg-flux-elevated border border-flux-border rounded-lg shadow-xl overflow-hidden"
        style={{ maxWidth: '30rem', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="pm-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-[11px] border-b border-flux-border bg-zinc-900">
          <div className="flex items-center gap-2">
            <HeaderIcon size={16} className={headerIconClass} />
            <h2 id="pm-title" className="text-flux-text-primary font-semibold text-[14px]">
              {headerTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-flux-text-muted hover:text-flux-text-primary hover:bg-flux-hover p-1 rounded-[3px] transition-colors"
            data-testid="pm-close-btn"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Identity */}
        <IdentitySection
          jobReference={job.reference}
          client={job.client}
          designation={job.designation}
        />

        {/* Triptych */}
        <TriptychSection
          operatorName={operatorName}
          machineName={machineName}
          slotStartMin={slotStartMin}
          slotEndMin={slotEndMin}
          slotVolumePct={slotVolumePct}
        />

        {/* Variant-specific content */}
        {variant === 'future-blocked' ? (
          <PredecessorCard predecessor={predecessorInfo ?? null} />
        ) : (
          <>
            <ProgressBand
              variant={variant}
              slotStartMin={slotStartMin}
              slotEndMin={slotEndMin}
              nowMin={nowMin}
              setupMinutes={setupMinutes}
              slotVolumePct={slotVolumePct}
              tileColor={tileColor}
            />

            {blockedMode ? (
              <BlockedMode
                onBlockPrerequisite={onBlockPrerequisite}
                onBlockMachine={onBlockMachine}
                onBlockAbsence={onBlockAbsence}
                onBack={() => { setBlockedMode(false); setSelectedReason(null); }}
                onReasonSelected={setSelectedReason}
              />
            ) : (
              <NonLinearStepper
                plannedEndMin={slotEndMin}
                label={variant === 'done-past-end' ? "J'ai terminé à :" : "Je finirai à :"}
                onTimeChange={handleTimeChange}
                showBlockedButton={variant === 'in-progress'}
                onBlockedClick={() => setBlockedMode(true)}
              />
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-[10px] bg-zinc-900">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-[13px] py-[6px] rounded-[3px] text-[13px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
            data-testid="pm-cancel-btn"
          >
            {variant === 'future-blocked' ? 'Fermer' : 'Annuler'}
          </button>
          {variant !== 'future-blocked' && (
            <button
              onClick={blockedMode ? handleBlockSignal : handleSave}
              disabled={saving || (blockedMode && !selectedReason)}
              className={`px-[13px] py-[6px] rounded-[3px] text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                blockedMode
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
              data-testid="pm-confirm-btn"
            >
              {saving ? '…' : blockedMode ? 'Signaler' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

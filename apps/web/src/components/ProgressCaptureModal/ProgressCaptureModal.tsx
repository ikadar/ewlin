/**
 * ProgressCaptureModal — V2 progress capture (cf. progress-capture-design.md).
 *
 * Single-question UX: the operator declares an estimated end time. The engine
 * absorbs everything else (productivity ratio, propagation to subsequent
 * fragments, replan, planning re-render).
 *
 * Layout (cf. playgrounds/tile-prompts-and-menu.html, pm-* block):
 *   ┌─ Avancement                                            [×] ─┐
 *   │  J-XXXX · Client                                              │
 *   │  Machine                                                       │
 *   │                                                                 │
 *   │  ┌─ Votre créneau ────────────────────────────────────────┐  │
 *   │  │  9h30 → 12h00                                            │  │
 *   │  │  [VolumeGauge — 100% job scale, slot isolated]           │  │
 *   │  └──────────────────────────────────────────────────────────┘  │
 *   │                                                                  │
 *   │  Quand finirez-vous ?                                           │
 *   │  [QuickActionsRow — À l'heure massive + 6 adjustments]          │
 *   │  [CustomTimeStepper — escape hatch]                              │
 *   │  [StatusLine — live ✓/↓/↑]                                       │
 *   │                                                                   │
 *   │                                          [Annuler] [Enregistrer]│
 *   └────────────────────────────────────────────────────────────────┘
 *
 * The modal owns the `pmTime` state. All interactions (quick / custom) update
 * it ; the StatusLine and QuickActionsRow.is-active highlights derive from it.
 *
 * Save flow: click Enregistrer → onSave(pmTime) → close. The parent owns the
 * actual mutation (RTK Query) so the modal stays API-agnostic and easy to test.
 */
import { useState, useEffect, type ReactElement } from 'react';
import { Clock, X } from 'lucide-react';
import { VolumeGauge } from './VolumeGauge';
import { QuickActionsRow } from './QuickActionsRow';
import { CustomTimeStepper } from './CustomTimeStepper';
import { StatusLine } from './StatusLine';
import { fmtTimeMin } from './timeUtils';

export interface ProgressCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (estimatedEndMin: number) => Promise<void> | void;

  /** Job identity displayed in the modal header. */
  job: { reference: string; client: string };
  /** Machine label (e.g., "Heidelberg"). */
  machineName: string;

  /** Slot bounds (minutes-from-midnight). */
  slotStartMin: number;
  slotEndMin: number;

  /** Volume context for the gauge — see VolumeGauge.tsx. */
  cumulBeforeSlotPct: number;
  slotVolumePct: number;
  expectedAtNowPct: number;

  /** "Now" in minutes-from-midnight — used as lower bound for time inputs. */
  nowMin: number;
}

export function ProgressCaptureModal({
  isOpen,
  onClose,
  onSave,
  job,
  machineName,
  slotStartMin,
  slotEndMin,
  cumulBeforeSlotPct,
  slotVolumePct,
  expectedAtNowPct,
  nowMin,
}: ProgressCaptureModalProps): ReactElement | null {
  const [pmTime, setPmTime] = useState<number>(slotEndMin);
  const [saving, setSaving] = useState<boolean>(false);

  // Reset on open (so the modal always starts on "à l'heure" — the dominant
  // case — even after a previous saisie session).
  useEffect(() => {
    if (isOpen) {
      setPmTime(slotEndMin);
      setSaving(false);
    }
  }, [isOpen, slotEndMin]);

  // Escape closes — we attach a window listener ourselves rather than rely
  // on a Dialog primitive so the modal stays self-contained and testable.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave(pmTime));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
      data-testid="progress-capture-modal"
    >
      <div
        className="bg-flux-elevated border border-flux-border rounded-lg shadow-xl"
        style={{ maxWidth: '30rem', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="pm-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-flux-border">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-flux-text-primary" />
            <h2 id="pm-title" className="text-flux-text-primary font-semibold text-sm">
              Avancement
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-flux-text-secondary hover:text-flux-text-primary transition-colors"
            data-testid="pm-close-btn"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Job identity (no fragment number, per UX decision) */}
          <div>
            <div className="text-[14px] font-semibold text-flux-text-primary">
              {job.reference} · {job.client}
            </div>
            <div className="text-[11.5px] text-flux-text-tertiary mt-0.5">{machineName}</div>
          </div>

          {/* Slot context with the gauge */}
          <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3">
            <div className="text-[10px] font-semibold text-flux-text-tertiary uppercase tracking-wider mb-1.5">
              Votre créneau
            </div>
            <div className="font-mono font-semibold text-[14px] text-flux-text-primary">
              {fmtTimeMin(slotStartMin)} → {fmtTimeMin(slotEndMin)}
            </div>
            <div className="mt-2">
              <VolumeGauge
                cumulBeforeSlotPct={cumulBeforeSlotPct}
                slotVolumePct={slotVolumePct}
                expectedAtNowPct={expectedAtNowPct}
              />
            </div>
          </div>

          {/* Question */}
          <div className="text-[13px] text-flux-text-primary font-medium mt-1">
            Quand finirez-vous&nbsp;?
          </div>

          {/* Inputs */}
          <QuickActionsRow
            plannedEndMin={slotEndMin}
            currentTimeMin={pmTime}
            lowerBoundMin={nowMin}
            onSelect={setPmTime}
          />

          <CustomTimeStepper
            currentTimeMin={pmTime}
            lowerBoundMin={nowMin}
            onChange={setPmTime}
          />

          <StatusLine currentTimeMin={pmTime} plannedEndMin={slotEndMin} />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-flux-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded text-sm bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors disabled:opacity-50"
            data-testid="pm-cancel-btn"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
            data-testid="pm-confirm-btn"
          >
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

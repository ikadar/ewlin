/**
 * SetStartTimeDialog — V2 progress capture, parameterized pin sub-dialog.
 *
 * Opens from the TileContextMenu's "Définir heure de début…" item. Lets the
 * operator pick a target date + time at 15-min granularity, with a live
 * faisabilité preview (✓ disponible / ⚠ glissé) sourced from the backend
 * via debounced `feasibilityPreview` mutation. On confirm, fires `pinAtTime`
 * which creates or moves a pin to the target slot ; if the slot is
 * unavailable the engine resolves via slide-to-nearest (the cohérence
 * « Pin = créneau » memory).
 *
 * Composition (cf. playgrounds/tile-prompts-and-menu.html, sd-overlay block) :
 *   - Header        : icon + "Définir heure de début" + close
 *   - Tile context  : job identity + current scheduled (formatted)
 *   - CompactCalendar (jour cible)
 *   - CustomTimeStepper (heure cible — réutilisé depuis ProgressCaptureModal)
 *   - FeasibilityPreview (live preview)
 *   - Footer        : Annuler + Définir (primary blue)
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { CompactCalendar } from './CompactCalendar';
import { FeasibilityPreview } from './FeasibilityPreview';
import { CustomTimeStepper } from '../ProgressCaptureModal/CustomTimeStepper';
import { fmtTimeMin } from '../ProgressCaptureModal/timeUtils';
import {
  useFeasibilityPreviewMutation,
  usePinAtTimeMutation,
} from '../../store';

const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function frFullDateTime(d: Date): string {
  const time = d.getMinutes() === 0
    ? `${d.getHours()}h`
    : `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} · ${time}`;
}

/** Combine a date (day) + a time (minutes from midnight) into an ISO datetime. */
function combineDayAndTimeIso(day: Date, minutesFromMidnight: number): string {
  const result = new Date(day);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutesFromMidnight);
  return result.toISOString();
}

export interface SetStartTimeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional callback when the pin is saved successfully (with resolved ISO). */
  onSaved?: (resolvedIso: string) => void;
  /** Task being pinned. */
  taskId: string;
  /** Job identity for display. */
  job: { reference: string; client: string };
  /** Currently scheduled start (ISO) — the dialog's default. */
  currentScheduledStart: string;
}

const PREVIEW_DEBOUNCE_MS = 200;

export function SetStartTimeDialog({
  isOpen,
  onClose,
  onSaved,
  taskId,
  job,
  currentScheduledStart,
}: SetStartTimeDialogProps): ReactElement | null {
  const initialDate = new Date(currentScheduledStart);
  const initialMinutes = initialDate.getHours() * 60 + initialDate.getMinutes();

  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date(initialDate);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedTimeMin, setSelectedTimeMin] = useState<number>(initialMinutes);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date(initialDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [today] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Reset on re-open
  useEffect(() => {
    if (!isOpen) return;
    const dt = new Date(currentScheduledStart);
    const day = new Date(dt);
    day.setHours(0, 0, 0, 0);
    setSelectedDay(day);
    setSelectedTimeMin(dt.getHours() * 60 + dt.getMinutes());
    setCurrentMonth(new Date(dt.getFullYear(), dt.getMonth(), 1));
  }, [isOpen, currentScheduledStart]);

  // Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const targetIso = combineDayAndTimeIso(selectedDay, selectedTimeMin);

  // Live faisabilité preview — debounced 200 ms after the user stops adjusting.
  const [runPreview, { data: previewResult, isLoading: previewLoading }] =
    useFeasibilityPreviewMutation();
  const lastPreviewedRef = useRef<string>('');
  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => {
      if (lastPreviewedRef.current === targetIso) return;
      lastPreviewedRef.current = targetIso;
      runPreview({ taskId, targetDateTime: targetIso });
    }, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [isOpen, targetIso, taskId, runPreview]);

  const [pinAtTime, { isLoading: pinning }] = usePinAtTimeMutation();

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (pinning) return;
    try {
      const result = await pinAtTime({ taskId, targetDateTime: targetIso }).unwrap();
      onSaved?.(result.scheduledStart);
      onClose();
    } catch {
      // Stay open ; error toast is the parent's concern via mutation state.
    }
  };

  // Default-fall the preview to "feasible at target" until the first response
  // arrives, so the UX doesn't flash a "loading" on every keystroke.
  const feasible = previewResult?.feasible ?? true;
  const resolvedIso = previewResult?.resolvedDateTime ?? targetIso;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
      data-testid="set-start-time-dialog"
    >
      <div
        className="bg-flux-elevated border border-flux-border rounded-lg shadow-xl"
        style={{ maxWidth: '28rem', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="sd-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-flux-border">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-blue-400" />
            <h2 id="sd-title" className="text-flux-text-primary font-semibold text-sm">
              Définir heure de début
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-flux-text-tertiary hover:text-flux-text-primary transition-colors"
            data-testid="sd-close-btn"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Tile context */}
          <div className="bg-white/[0.03] border border-white/10 rounded px-3 py-2">
            <div className="text-[12.5px] font-semibold text-flux-text-primary">
              {job.reference} · {job.client}
            </div>
            <div className="text-[11px] text-flux-text-tertiary mt-0.5">
              Actuellement prévu&nbsp;: {frFullDateTime(initialDate)}
            </div>
          </div>

          {/* Calendar */}
          <div>
            <div className="text-[10px] font-semibold tracking-[0.06em] text-flux-text-tertiary uppercase mb-1.5">
              Jour cible
            </div>
            <CompactCalendar
              currentMonth={currentMonth}
              selectedDay={selectedDay}
              today={today}
              onSelectDay={setSelectedDay}
              onChangeMonth={setCurrentMonth}
            />
          </div>

          {/* Time picker */}
          <div>
            <div className="text-[10px] font-semibold tracking-[0.06em] text-flux-text-tertiary uppercase mb-1.5">
              Heure cible
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <CustomTimeStepper
                currentTimeMin={selectedTimeMin}
                lowerBoundMin={0}
                onChange={setSelectedTimeMin}
              />
              <span className="text-[11px] text-flux-text-tertiary">granularité 15&nbsp;min</span>
            </div>
            <div className="text-[11px] text-flux-text-tertiary mt-1">
              Heure choisie&nbsp;: <span className="font-mono text-flux-text-secondary">{fmtTimeMin(selectedTimeMin)}</span>
            </div>
          </div>

          {/* Feasibility */}
          <div>
            <div className="text-[10px] font-semibold tracking-[0.06em] text-flux-text-tertiary uppercase mb-1.5">
              Faisabilité
            </div>
            <FeasibilityPreview
              isLoading={previewLoading}
              feasible={feasible}
              resolvedIso={resolvedIso}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-flux-border">
          <button
            onClick={onClose}
            disabled={pinning}
            className="px-4 py-2 rounded text-sm bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors disabled:opacity-50"
            data-testid="sd-cancel-btn"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={pinning}
            className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
            data-testid="sd-confirm-btn"
          >
            {pinning ? '…' : 'Définir'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { Plus, Trash2 } from 'lucide-react';
import { OperatingScheduleEditor } from './OperatingScheduleEditor';
import type { OperatingSchedule } from './OperatingScheduleEditor';
import { getISOWeek } from '@flux/types';

const SCHEDULE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface RotatingScheduleEditorProps {
  schedules: OperatingSchedule[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSchedulesChange: (schedules: OperatingSchedule[]) => void;
  referenceWeek: number | null;
  onReferenceWeekChange: (week: number | null) => void;
}

const DEFAULT_SCHEDULE: OperatingSchedule = {
  monday: { isOperating: true, slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  tuesday: { isOperating: true, slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  wednesday: { isOperating: true, slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  thursday: { isOperating: true, slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  friday: { isOperating: true, slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  saturday: { isOperating: false, slots: [] },
  sunday: { isOperating: false, slots: [] },
};

export function RotatingScheduleEditor({
  schedules,
  activeIndex,
  onActiveIndexChange,
  onSchedulesChange,
  referenceWeek,
  onReferenceWeekChange,
}: RotatingScheduleEditorProps) {
  const currentISOWeek = getISOWeek(new Date());
  const hasRotation = schedules.length > 1;

  const addSchedule = () => {
    // Copy current schedule as starting point
    const source = schedules[activeIndex] ?? DEFAULT_SCHEDULE;
    const copy: OperatingSchedule = JSON.parse(JSON.stringify(source));
    const next = [...schedules, copy];
    onSchedulesChange(next);
    onActiveIndexChange(next.length - 1);
    // Set default reference week if first time creating rotation
    if (schedules.length === 1 && referenceWeek === null) {
      onReferenceWeekChange(currentISOWeek);
    }
  };

  const removeSchedule = (index: number) => {
    if (schedules.length <= 1) return;
    const next = schedules.filter((_, i) => i !== index);
    onSchedulesChange(next);
    if (activeIndex >= next.length) {
      onActiveIndexChange(next.length - 1);
    } else if (activeIndex > index) {
      onActiveIndexChange(activeIndex - 1);
    }
    // Clear reference week if back to single schedule
    if (next.length === 1) {
      onReferenceWeekChange(null);
    }
  };

  const updateSchedule = (schedule: OperatingSchedule) => {
    const next = [...schedules];
    next[activeIndex] = schedule;
    onSchedulesChange(next);
  };

  // Compute current active schedule label
  let currentLabel = '';
  if (hasRotation && referenceWeek !== null) {
    const n = schedules.length;
    const idx = ((currentISOWeek - referenceWeek) % n + n) % n;
    currentLabel = SCHEDULE_LABELS[idx] ?? `${idx + 1}`;
  }

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5">
        {schedules.map((_, i) => {
          const label = SCHEDULE_LABELS[i] ?? `${i + 1}`;
          const isActive = i === activeIndex;
          return (
            <div key={i} className="flex items-center">
              <button
                type="button"
                onClick={() => onActiveIndexChange(i)}
                className={`px-3 py-1.5 text-sm font-medium rounded-t-md border border-b-0 transition-colors ${
                  isActive
                    ? 'bg-flux-surface text-flux-text-primary border-flux-border-light'
                    : 'bg-flux-base text-flux-text-tertiary border-transparent hover:text-flux-text-secondary hover:border-flux-border-light'
                }`}
              >
                Semaine {label}
              </button>
              {schedules.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSchedule(i)}
                  className="ml-0.5 p-1 text-flux-text-tertiary hover:text-red-500 transition-colors"
                  title={`Supprimer la semaine ${label}`}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={addSchedule}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-flux-text-tertiary hover:text-flux-text-secondary transition-colors"
          title="Ajouter une semaine de rotation"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Active schedule editor */}
      <OperatingScheduleEditor
        value={schedules[activeIndex]}
        onChange={updateSchedule}
      />

      {/* Reference week + current rotation indicator */}
      {hasRotation && (
        <div className="flex items-center gap-4 px-3 py-2 bg-flux-base border border-flux-border-light rounded-md text-sm">
          <label className="flex items-center gap-2 text-flux-text-secondary">
            <span className="whitespace-nowrap">Semaine de référence (ISO) :</span>
            <input
              type="number"
              min={1}
              max={53}
              value={referenceWeek ?? currentISOWeek}
              onChange={(e) => onReferenceWeekChange(parseInt(e.target.value, 10) || 1)}
              className="w-16 px-2 py-1 bg-flux-surface border border-flux-border-light rounded text-flux-text-primary text-center"
            />
          </label>
          <span className="text-flux-text-tertiary">
            Cette semaine (S{currentISOWeek}) : <strong className="text-flux-text-secondary">Semaine {currentLabel}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

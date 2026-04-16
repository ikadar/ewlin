import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { OperatingScheduleEditor } from './OperatingScheduleEditor';
import type { OperatingSchedule } from './OperatingScheduleEditor';
import { getISOWeek } from '@flux/types';

const FALLBACK_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface RotatingScheduleEditorProps {
  schedules: OperatingSchedule[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSchedulesChange: (schedules: OperatingSchedule[]) => void;
  scheduleNames: string[];
  onScheduleNamesChange: (names: string[]) => void;
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

/** Get display label for a schedule index, using custom name or fallback letter. */
function getLabel(names: string[], index: number): string {
  const custom = names[index];
  if (custom && custom.trim()) return custom.trim();
  return `Semaine ${FALLBACK_LABELS[index] ?? index + 1}`;
}

export function RotatingScheduleEditor({
  schedules,
  activeIndex,
  onActiveIndexChange,
  onSchedulesChange,
  scheduleNames,
  onScheduleNamesChange,
  referenceWeek,
  onReferenceWeekChange,
}: RotatingScheduleEditorProps) {
  const currentISOWeek = getISOWeek(new Date());
  const hasRotation = schedules.length > 1;

  // Naming modal state
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ((showNameModal || renamingIndex !== null) && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [showNameModal, renamingIndex]);

  const openAddModal = () => {
    const nextLetter = FALLBACK_LABELS[schedules.length] ?? `${schedules.length + 1}`;
    setNameInput(`Semaine ${nextLetter}`);
    setRenamingIndex(null);
    setShowNameModal(true);
  };

  const confirmAdd = () => {
    const name = nameInput.trim();
    if (!name) return;

    // Copy current schedule as starting point
    const source = schedules[activeIndex] ?? DEFAULT_SCHEDULE;
    const copy: OperatingSchedule = JSON.parse(JSON.stringify(source));
    const nextSchedules = [...schedules, copy];
    const nextNames = [...scheduleNames, name];

    onSchedulesChange(nextSchedules);
    onScheduleNamesChange(nextNames);
    onActiveIndexChange(nextSchedules.length - 1);

    // Set default reference week if first time creating rotation
    if (schedules.length === 1 && referenceWeek === null) {
      onReferenceWeekChange(currentISOWeek);
    }

    setShowNameModal(false);
  };

  const openRename = (index: number) => {
    setNameInput(scheduleNames[index] || getLabel(scheduleNames, index));
    setRenamingIndex(index);
    setShowNameModal(false);
  };

  const confirmRename = () => {
    if (renamingIndex === null) return;
    const name = nameInput.trim();
    if (!name) return;
    const next = [...scheduleNames];
    next[renamingIndex] = name;
    onScheduleNamesChange(next);
    setRenamingIndex(null);
  };

  const removeSchedule = (index: number) => {
    if (schedules.length <= 1) return;
    const nextSchedules = schedules.filter((_, i) => i !== index);
    const nextNames = scheduleNames.filter((_, i) => i !== index);
    onSchedulesChange(nextSchedules);
    onScheduleNamesChange(nextNames);
    if (activeIndex >= nextSchedules.length) {
      onActiveIndexChange(nextSchedules.length - 1);
    } else if (activeIndex > index) {
      onActiveIndexChange(activeIndex - 1);
    }
    // Clear reference week if back to single schedule
    if (nextSchedules.length === 1) {
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
    currentLabel = getLabel(scheduleNames, idx);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (renamingIndex !== null) confirmRename();
      else if (showNameModal) confirmAdd();
    } else if (e.key === 'Escape') {
      setShowNameModal(false);
      setRenamingIndex(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {schedules.map((_, i) => {
          const label = getLabel(scheduleNames, i);
          const isActive = i === activeIndex;

          // Inline rename mode
          if (renamingIndex === i) {
            return (
              <div key={i} className="flex items-center">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={confirmRename}
                  className="px-2 py-1 text-sm bg-flux-surface border border-flux-accent rounded text-flux-text-primary w-32"
                  maxLength={30}
                />
              </div>
            );
          }

          return (
            <div key={i} className="flex items-center group">
              <button
                type="button"
                onClick={() => onActiveIndexChange(i)}
                className={`px-3 py-1.5 text-sm font-medium rounded-t-md border border-b-0 transition-colors ${
                  isActive
                    ? 'bg-flux-surface text-flux-text-primary border-flux-border-light'
                    : 'bg-flux-base text-flux-text-tertiary border-transparent hover:text-flux-text-secondary hover:border-flux-border-light'
                }`}
              >
                {label}
              </button>
              {schedules.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => openRename(i)}
                    className="p-1 text-flux-text-tertiary hover:text-flux-text-secondary transition-colors opacity-0 group-hover:opacity-100"
                    title="Renommer"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSchedule(i)}
                    className="p-1 text-flux-text-tertiary hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title={`Supprimer ${label}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-flux-text-tertiary hover:text-flux-text-secondary transition-colors"
          title="Ajouter une semaine de rotation"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Name modal (inline popup) */}
      {showNameModal && (
        <div className="flex items-center gap-2 px-3 py-2 bg-flux-surface border border-flux-border-light rounded-md">
          <label className="text-sm text-flux-text-secondary whitespace-nowrap">Nom du planning :</label>
          <input
            ref={nameInputRef}
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 text-sm bg-flux-base border border-flux-border-light rounded text-flux-text-primary"
            maxLength={30}
            placeholder="ex. Matin, Après-midi…"
          />
          <button
            type="button"
            onClick={confirmAdd}
            className="px-3 py-1 text-sm bg-flux-accent text-white rounded hover:opacity-90 transition-opacity"
          >
            Ajouter
          </button>
          <button
            type="button"
            onClick={() => setShowNameModal(false)}
            className="px-2 py-1 text-sm text-flux-text-tertiary hover:text-flux-text-secondary"
          >
            Annuler
          </button>
        </div>
      )}

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
            Cette semaine (S{currentISOWeek}) : <strong className="text-flux-text-secondary">{currentLabel}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { OperatingScheduleEditor } from './OperatingScheduleEditor';
import type { OperatingSchedule } from './OperatingScheduleEditor';
import { FluxSelect } from './FluxSelect';
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

  // Naming state
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ((showNamePrompt || renamingIndex !== null) && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [showNamePrompt, renamingIndex]);

  // Compute which schedule is active this week
  const currentScheduleIndex = hasRotation && referenceWeek !== null
    ? ((currentISOWeek - referenceWeek) % schedules.length + schedules.length) % schedules.length
    : 0;

  // ─── Add schedule ───
  const openAddPrompt = () => {
    const nextLetter = FALLBACK_LABELS[schedules.length] ?? `${schedules.length + 1}`;
    setNameInput(`Semaine ${nextLetter}`);
    setRenamingIndex(null);
    setShowNamePrompt(true);
  };

  const confirmAdd = () => {
    const name = nameInput.trim();
    if (!name) return;

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

    setShowNamePrompt(false);
  };

  // ─── Rename schedule ───
  const openRename = (index: number) => {
    setNameInput(scheduleNames[index] || getLabel(scheduleNames, index));
    setRenamingIndex(index);
    setShowNamePrompt(false);
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

  // ─── Remove schedule ───
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
    if (nextSchedules.length === 1) {
      onReferenceWeekChange(null);
    }
  };

  // ─── Update current schedule ───
  const updateSchedule = (schedule: OperatingSchedule) => {
    const next = [...schedules];
    next[activeIndex] = schedule;
    onSchedulesChange(next);
  };

  // ─── Rotation dropdown change ───
  const handleRotationChange = (value: string) => {
    const selectedIdx = parseInt(value, 10);
    // referenceWeek = currentISOWeek - selectedIdx
    onReferenceWeekChange(currentISOWeek - selectedIdx);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (renamingIndex !== null) confirmRename();
      else if (showNamePrompt) confirmAdd();
    } else if (e.key === 'Escape') {
      setShowNamePrompt(false);
      setRenamingIndex(null);
    }
  };

  // FluxSelect options for the rotation dropdown
  const rotationOptions = schedules.map((_, i) => ({
    value: String(i),
    label: getLabel(scheduleNames, i),
  }));

  return (
    <div className="space-y-3">
      {/* ── Cards row ── */}
      <div className="flex gap-2 flex-wrap">
        {schedules.map((_, i) => {
          const label = getLabel(scheduleNames, i);
          const isEditing = i === activeIndex;
          const isCurrent = hasRotation && i === currentScheduleIndex;

          // Inline rename mode
          if (renamingIndex === i) {
            return (
              <div key={i} className="flex items-center px-3 py-2 min-w-[140px] border border-flux-accent rounded-lg bg-flux-elevated">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={confirmRename}
                  className="w-full px-1 py-0.5 text-sm bg-transparent border-none text-flux-text-primary focus:outline-none"
                  maxLength={30}
                />
              </div>
            );
          }

          return (
            <div
              key={i}
              onClick={() => onActiveIndexChange(i)}
              className={`px-3 py-2 min-w-[140px] border rounded-lg cursor-pointer transition-colors ${
                isEditing
                  ? 'border-indigo-500/60 bg-flux-elevated'
                  : 'border-flux-border bg-flux-base hover:border-flux-border-light hover:bg-flux-elevated'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[13px] font-medium text-flux-text-primary">{label}</span>
                {isCurrent && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/30">
                    en cours
                  </span>
                )}
              </div>
              <div className="flex gap-2.5 mt-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openRename(i); }}
                  className="text-[11px] text-flux-text-muted hover:text-flux-text-secondary hover:underline"
                >
                  Renommer
                </button>
                {schedules.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeSchedule(i); }}
                    className="text-[11px] text-flux-text-muted hover:text-red-500 hover:underline"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add button */}
        <button
          type="button"
          onClick={openAddPrompt}
          className="px-3 py-2 min-w-[80px] border border-dashed border-flux-border rounded-lg flex items-center justify-center gap-1.5 text-xs text-flux-text-muted hover:text-flux-text-secondary hover:border-flux-border-light hover:bg-flux-elevated transition-colors"
        >
          <Plus size={14} />
          Ajouter
        </button>
      </div>

      {/* ── Name prompt (inline) ── */}
      {showNamePrompt && (
        <div className="flex items-center gap-2 px-3 py-2 bg-flux-surface border border-flux-border-light rounded-lg">
          <label className="text-sm text-flux-text-secondary whitespace-nowrap">Nom du planning :</label>
          <input
            ref={nameInputRef}
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 text-sm bg-flux-base border border-flux-border-light rounded text-flux-text-primary focus:outline-none focus:border-flux-text-secondary"
            maxLength={30}
            placeholder="ex. Matin, Après-midi…"
          />
          <button
            type="button"
            onClick={confirmAdd}
            className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
          >
            Ajouter
          </button>
          <button
            type="button"
            onClick={() => setShowNamePrompt(false)}
            className="px-2 py-1 text-sm text-flux-text-tertiary hover:text-flux-text-secondary"
          >
            Annuler
          </button>
        </div>
      )}

      {/* ── Schedule editor for the active card ── */}
      <OperatingScheduleEditor
        value={schedules[activeIndex]}
        onChange={updateSchedule}
      />

      {/* ── Rotation dropdown (below editor, only when 2+ schedules) ── */}
      {hasRotation && (
        <div className="flex items-center gap-2 text-sm text-flux-text-tertiary">
          <span className="whitespace-nowrap">Planning de la semaine en cours (S{currentISOWeek}) :</span>
          <FluxSelect
            options={rotationOptions}
            value={String(currentScheduleIndex)}
            onChange={handleRotationChange}
            className="w-44"
          />
        </div>
      )}
    </div>
  );
}

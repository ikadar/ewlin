import { Plus, Trash2 } from 'lucide-react';
import { generateId } from '../../utils/generateId';
import { DayScheduleRow } from './DayScheduleRow';
import type { DaySchedule } from './DayScheduleRow';

export interface ScheduleExceptionInput {
  id: string;
  date: string;
  reason: string;
  schedule: DaySchedule;
}

interface ExceptionsEditorProps {
  value: ScheduleExceptionInput[];
  onChange: (exceptions: ScheduleExceptionInput[]) => void;
}

export function ExceptionsEditor({ value, onChange }: ExceptionsEditorProps) {
  const addException = () => {
    const today = new Date().toISOString().split('T')[0];
    onChange([
      ...value,
      {
        id: generateId(),
        date: today,
        reason: '',
        schedule: { isOperating: false, slots: [] },
      },
    ]);
  };

  const removeException = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateField = (index: number, field: 'date' | 'reason', fieldValue: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: fieldValue };
    onChange(updated);
  };

  const updateSchedule = (index: number, schedule: DaySchedule) => {
    const updated = [...value];
    updated[index] = { ...updated[index], schedule };
    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.map((exc, i) => (
        <div key={exc.id} className="bg-flux-elevated border border-flux-border-light rounded-lg p-3">
          {/* Top row: date, reason, delete */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={exc.date}
              onChange={(e) => updateField(i, 'date', e.target.value)}
              className="bg-flux-base border border-flux-border-light rounded px-3 py-[7px] text-sm leading-[1.5] text-flux-text-primary outline-none focus:border-flux-text-secondary"
            />
            <input
              type="text"
              value={exc.reason}
              onChange={(e) => updateField(i, 'reason', e.target.value)}
              placeholder="Raison (optionnel)"
              className="flex-1 min-w-[120px] bg-flux-base border border-flux-border-light rounded px-3 py-[7px] text-sm leading-[1.5] text-flux-text-primary placeholder:text-flux-text-muted outline-none focus:border-flux-text-secondary"
            />
            <button
              type="button"
              onClick={() => removeException(i)}
              className="p-1 text-flux-text-tertiary hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Schedule: checkbox unchecked = indisponible, checked = modified hours */}
          <div className="mt-2.5 pt-2.5 border-t border-flux-border">
            <DayScheduleRow
              label="Disponibilité"
              schedule={exc.schedule}
              onChange={(s) => updateSchedule(i, s)}
              compact
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addException}
        className="flex items-center justify-center gap-1.5 w-full py-2 text-sm text-flux-text-tertiary border border-dashed border-flux-border-light rounded-lg hover:text-flux-text-secondary hover:border-flux-text-tertiary transition-colors"
      >
        <Plus size={14} />
        Ajouter une exception
      </button>
    </div>
  );
}

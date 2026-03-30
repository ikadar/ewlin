import { Copy } from 'lucide-react';
import { DayScheduleRow } from './DayScheduleRow';
import type { DaySchedule } from './DayScheduleRow';

export interface OperatingSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

const DAYS: { key: keyof OperatingSchedule; label: string }[] = [
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
  { key: 'sunday', label: 'Dimanche' },
];

const WEEKDAY_KEYS: (keyof OperatingSchedule)[] = ['tuesday', 'wednesday', 'thursday', 'friday'];

interface OperatingScheduleEditorProps {
  value: OperatingSchedule;
  onChange: (schedule: OperatingSchedule) => void;
}

export function OperatingScheduleEditor({ value, onChange }: OperatingScheduleEditorProps) {
  const updateDay = (key: keyof OperatingSchedule, day: DaySchedule) => {
    onChange({ ...value, [key]: day });
  };

  const copyMondayToWeekdays = () => {
    const monday = value.monday;
    const updates: Partial<OperatingSchedule> = {};
    for (const key of WEEKDAY_KEYS) {
      updates[key] = { isOperating: monday.isOperating, slots: monday.slots.map((s) => ({ ...s })) };
    }
    onChange({ ...value, ...updates });
  };

  return (
    <div className="bg-flux-base border border-flux-border-light rounded-lg p-3">
      {DAYS.map((day) => (
        <DayScheduleRow
          key={day.key}
          label={day.label}
          schedule={value[day.key]}
          onChange={(s) => updateDay(day.key, s)}
        />
      ))}
      <button
        type="button"
        onClick={copyMondayToWeekdays}
        className="flex items-center gap-1.5 mt-2 text-xs text-flux-text-tertiary hover:text-flux-text-secondary transition-colors"
      >
        <Copy size={12} />
        Copier Lundi vers tous les jours ouvrés
      </button>
    </div>
  );
}

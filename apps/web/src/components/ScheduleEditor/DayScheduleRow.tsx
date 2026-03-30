import { Plus } from 'lucide-react';
import { TimeSlotInput } from './TimeSlotInput';
import type { TimeSlot } from './TimeSlotInput';

export interface DaySchedule {
  isOperating: boolean;
  slots: TimeSlot[];
}

interface DayScheduleRowProps {
  label: string;
  schedule: DaySchedule;
  onChange: (schedule: DaySchedule) => void;
  compact?: boolean;
}

const DEFAULT_SLOT: TimeSlot = { start: '08:00', end: '17:00' };

export function DayScheduleRow({ label, schedule, onChange, compact }: DayScheduleRowProps) {
  const updateSlot = (index: number, slot: TimeSlot) => {
    const slots = [...schedule.slots];
    slots[index] = slot;
    onChange({ isOperating: true, slots });
  };

  const removeSlot = (index: number) => {
    const newSlots = schedule.slots.filter((_, i) => i !== index);
    onChange({ isOperating: newSlots.length > 0, slots: newSlots });
  };

  const addSlot = () => {
    onChange({ isOperating: true, slots: [...schedule.slots, { ...DEFAULT_SLOT }] });
  };

  return (
    <div className={`flex items-center gap-2.5 ${compact ? 'py-1' : 'py-1.5 border-b border-flux-border last:border-b-0'}`}>
      <span className={`text-sm text-flux-text-secondary flex-shrink-0 ${compact ? 'w-auto' : 'w-[80px]'}`}>
        {label}
      </span>

      <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[28px]">
        {schedule.slots.map((slot, i) => (
          <TimeSlotInput
            key={i}
            slot={slot}
            onChange={(s) => updateSlot(i, s)}
            onRemove={() => removeSlot(i)}
            canRemove={true}
          />
        ))}
        {schedule.slots.length === 0 && (
          <span className="text-xs text-flux-text-muted italic mr-1">Indisponible</span>
        )}
        <button
          type="button"
          onClick={addSlot}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-flux-text-tertiary border border-dashed border-flux-border-light rounded-md hover:text-flux-text-secondary hover:border-flux-text-tertiary transition-colors"
        >
          <Plus size={12} />
          Ajouter
        </button>
      </div>
    </div>
  );
}

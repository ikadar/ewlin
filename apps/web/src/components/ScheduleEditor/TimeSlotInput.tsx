import { X } from 'lucide-react';

export interface TimeSlot {
  start: string;
  end: string;
}

interface TimeSlotInputProps {
  slot: TimeSlot;
  onChange: (slot: TimeSlot) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function TimeSlotInput({ slot, onChange, onRemove, canRemove }: TimeSlotInputProps) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-flux-elevated border border-flux-border-light rounded-md px-1.5 py-0.5">
      <input
        type="time"
        value={slot.start}
        onChange={(e) => onChange({ ...slot, start: e.target.value })}
        className="bg-transparent border-none text-flux-text-primary font-mono text-xs w-[72px] outline-none"
      />
      <span className="text-flux-text-tertiary text-xs">→</span>
      <input
        type="time"
        value={slot.end}
        onChange={(e) => onChange({ ...slot, end: e.target.value })}
        className="bg-transparent border-none text-flux-text-primary font-mono text-xs w-[72px] outline-none"
      />
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-0.5 text-flux-text-tertiary hover:text-red-400 transition-colors rounded"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

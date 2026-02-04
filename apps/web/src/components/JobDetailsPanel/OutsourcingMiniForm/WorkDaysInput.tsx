import { memo, useCallback } from 'react';

export interface WorkDaysInputProps {
  /** Current value (number of work days) */
  value: number;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Minimum value (default: 1) */
  min?: number;
  /** Maximum value (default: 30) */
  max?: number;
}

/**
 * WorkDaysInput - Number input for outsourcing work days (JO).
 * v0.5.11: Outsourcing Mini-Form
 */
export const WorkDaysInput = memo(function WorkDaysInput({
  value,
  onChange,
  disabled = false,
  min = 1,
  max = 30,
}: WorkDaysInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseInt(e.target.value, 10);
      if (!isNaN(newValue) && newValue >= min && newValue <= max) {
        onChange(newValue);
      }
    },
    [onChange, min, max]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const newValue = parseInt(e.target.value, 10);
      if (isNaN(newValue) || newValue < min) {
        onChange(min);
      } else if (newValue > max) {
        onChange(max);
      }
    },
    [onChange, min, max]
  );

  return (
    <div className="flex items-center gap-2">
      <label className="text-zinc-500 text-xs shrink-0">JO:</label>
      <input
        type="number"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        min={min}
        max={max}
        className="w-12 px-1.5 py-0.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="work-days-input"
      />
    </div>
  );
});

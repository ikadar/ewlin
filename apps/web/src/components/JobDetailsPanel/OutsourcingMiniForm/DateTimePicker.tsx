import { memo, useCallback, useState, useMemo } from 'react';
import { formatOutsourcingDateTime, parseOutsourcingDateTime } from '../../../utils/outsourcingCalculation';

export interface DateTimePickerProps {
  /** Label for the input (e.g., "Dép:", "Ret:") */
  label: string;
  /** Current value as Date or ISO string */
  value: Date | string | undefined;
  /** Callback when value changes */
  onChange: (value: Date | undefined) => void;
  /** Placeholder when no value */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Test ID for the input */
  testId?: string;
  /** Validation state for visual feedback */
  validationState?: 'valid' | 'warning' | 'error';
  /** Validation message (shown as title tooltip) */
  validationMessage?: string;
}

/**
 * DateTimePicker - Combined date/time input for outsourcing dates.
 * Format: DD/MM HH:MM
 * v0.5.11: Outsourcing Mini-Form
 */
export const DateTimePicker = memo(function DateTimePicker({
  label,
  value,
  onChange,
  placeholder = '--/-- --:--',
  disabled = false,
  testId,
  validationState = 'valid',
  validationMessage,
}: DateTimePickerProps) {
  // Track if user is actively editing
  const [isEditing, setIsEditing] = useState(false);
  // Store the user's input while editing
  const [editingValue, setEditingValue] = useState('');

  // Format the display value - either the user's editing input or the formatted prop value
  const displayValue = useMemo(() => {
    if (isEditing) {
      return editingValue;
    }
    return formatOutsourcingDateTime(value);
  }, [isEditing, editingValue, value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingValue(e.target.value);
  }, []);

  const handleFocus = useCallback(() => {
    // Start editing with current formatted value
    setEditingValue(formatOutsourcingDateTime(value));
    setIsEditing(true);
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);

    if (!editingValue.trim()) {
      onChange(undefined);
      return;
    }

    const parsed = parseOutsourcingDateTime(editingValue);
    if (parsed) {
      onChange(parsed);
    }
    // If invalid, just stop editing - displayValue will show the prop value
  }, [editingValue, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
      } else if (e.key === 'Escape') {
        // Cancel editing
        setIsEditing(false);
        e.currentTarget.blur();
      }
    },
    []
  );

  const borderClass = validationState === 'error'
    ? 'border-red-500'
    : validationState === 'warning'
      ? 'border-amber-500'
      : 'border-zinc-700';

  return (
    <div className="flex items-center gap-2">
      <label className="text-zinc-500 text-xs shrink-0 w-8">{label}</label>
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        title={validationMessage}
        className={`flex-1 px-1.5 py-0.5 text-xs bg-zinc-800 border ${borderClass} rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono`}
        data-testid={testId}
      />
    </div>
  );
});

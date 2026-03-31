import { memo, useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { parseFrenchDate, formatToFrench } from '../../JcfJobHeader/frenchDate';

export interface DateTimePickerProps {
  label: string;
  value: Date | string | undefined;
  onChange: (value: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  validationState?: 'valid' | 'warning' | 'error';
  validationMessage?: string;
  isAutoCalculated?: boolean;
}

export const DateTimePicker = memo(function DateTimePicker({
  label,
  value,
  onChange,
  placeholder = 'jj/mm HH:mm',
  disabled = false,
  testId,
  validationState = 'valid',
  validationMessage,
  isAutoCalculated = false,
}: DateTimePickerProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Convert prop value to ISO string
  const isoValue = useMemo(() => {
    if (!value) return '';
    if (value instanceof Date) {
      const yyyy = value.getFullYear();
      const mm = String(value.getMonth() + 1).padStart(2, '0');
      const dd = String(value.getDate()).padStart(2, '0');
      const hh = String(value.getHours()).padStart(2, '0');
      const min = String(value.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return match ? `${match[1]}T${match[2]}` : '';
  }, [value]);

  const frenchDisplay = isoValue ? formatToFrench(isoValue) : '';

  // Local text state — synced from prop when not focused
  const [localText, setLocalText] = useState(frenchDisplay);

  useEffect(() => {
    if (!isFocused) {
      setLocalText(frenchDisplay);
    }
  }, [frenchDisplay, isFocused]);

  const nativeValue = isoValue || `${new Date().toISOString().slice(0, 10)}T14:00`;

  const handleOpenPicker = useCallback(() => {
    if (!disabled) nativeRef.current?.showPicker();
  }, [disabled]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const raw = localText.trim();
    if (!raw) {
      onChange(undefined);
      return;
    }
    const parsed = parseFrenchDate(raw);
    if (parsed) {
      onChange(new Date(parsed));
    } else {
      // Invalid — revert to prop display
      setLocalText(frenchDisplay);
    }
  }, [localText, onChange, frenchDisplay]);

  const handleNativeDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const d = new Date(e.target.value);
      onChange(d);
      setLocalText(formatToFrench(e.target.value));
      setIsFocused(false);
      // Force-close the native picker
      nativeRef.current?.blur();
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      setLocalText(frenchDisplay);
      setIsFocused(false);
      e.currentTarget.blur();
    }
  }, [frenchDisplay]);

  const borderClass = validationState === 'error'
    ? 'border-red-500'
    : validationState === 'warning'
      ? 'border-amber-500'
      : 'border-zinc-700';

  const textColor = isAutoCalculated && !isFocused ? 'text-zinc-500' : 'text-zinc-200';

  return (
    <div className="flex items-center gap-2">
      <label className="text-zinc-500 text-xs shrink-0 w-8">{label}</label>
      <div className="relative flex-1">
        <input
          type="text"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={handleOpenPicker}
          disabled={disabled}
          placeholder={placeholder}
          title={validationMessage}
          className={`w-full px-1.5 py-0.5 text-xs bg-zinc-800 border ${borderClass} rounded ${textColor} placeholder-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono pr-6`}
          autoComplete="off"
          data-testid={testId}
        />
        <input
          ref={nativeRef}
          type="datetime-local"
          aria-hidden="true"
          value={nativeValue}
          onChange={handleNativeDateChange}
          className="absolute inset-0 opacity-0 pointer-events-none"
          tabIndex={-1}
        />
        <Calendar
          size={12}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
        />
      </div>
    </div>
  );
});

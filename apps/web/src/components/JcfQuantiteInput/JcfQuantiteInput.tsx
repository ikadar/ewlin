import { useCallback } from 'react';

export interface JcfQuantiteInputProps {
  /** Current quantity value (string for controlled input) */
  value: string;
  /** Store new value */
  onChange: (value: string) => void;
  /** HTML id for the input (cell ID for navigation) */
  id?: string;
  /** Input CSS class override */
  inputClassName?: string;
  /** Table navigation delegation: Tab/Shift+Tab */
  onTabOut?: (e: React.KeyboardEvent, direction: 'forward' | 'backward') => void;
  /** Table navigation delegation: Alt+Arrow */
  onArrowNav?: (e: React.KeyboardEvent, direction: 'up' | 'down' | 'left' | 'right') => void;
}

/**
 * Numeric input for the Quantité field in the JCF Elements Table.
 *
 * Behavior:
 * - Digits-only filter (strips non-digit characters)
 * - Strips leading zeros (007 → 7)
 * - Defaults to "1" on blur if empty or "0"
 * - Arrow Up/Down increment/decrement (minimum 1)
 * - Table navigation delegation (Tab/Alt+Arrow)
 */
export function JcfQuantiteInput({
  value,
  onChange,
  id,
  inputClassName,
  onTabOut,
  onArrowNav,
}: JcfQuantiteInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digitsOnly = e.target.value.replace(/\D/g, '');
      const stripped = digitsOnly.replace(/^0+/, '') || digitsOnly.slice(-1);
      onChange(stripped);
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    if (!value || value === '0') {
      onChange('1');
    }
  }, [value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Alt+Arrow navigation (Excel-style)
      if (e.altKey && e.key.startsWith('Arrow')) {
        if (onArrowNav) {
          const direction = e.key
            .replace('Arrow', '')
            .toLowerCase() as 'up' | 'down' | 'left' | 'right';
          onArrowNav(e, direction);
        }
        return;
      }

      // Tab navigation
      if (e.key === 'Tab') {
        if (onTabOut) {
          onTabOut(e, e.shiftKey ? 'backward' : 'forward');
        }
        return;
      }

      // Arrow Up: increment
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const current = parseInt(value) || 0;
        onChange(String(current + 1));
        return;
      }

      // Arrow Down: decrement (minimum 1)
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const current = parseInt(value) || 0;
        if (current > 1) {
          onChange(String(current - 1));
        }
        return;
      }
    },
    [value, onChange, onTabOut, onArrowNav],
  );

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${inputClassName ?? ''} text-right`}
      placeholder="1"
    />
  );
}

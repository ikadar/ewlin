import { useCallback, useMemo } from 'react';
import { isValidPagination } from './paginationValidation';

export interface JcfPaginationInputProps {
  /** Current pagination value (string for controlled input) */
  value: string;
  /** Store new value */
  onChange: (value: string) => void;
  /** HTML id for the input (cell ID for navigation) */
  id?: string;
  /** Input CSS class override (base class — validation may add border) */
  inputClassName?: string;
  /** Error border CSS class (applied when value is invalid) */
  errorClassName?: string;
  /** Table navigation delegation: Tab/Shift+Tab */
  onTabOut?: (e: React.KeyboardEvent, direction: 'forward' | 'backward') => void;
  /** Table navigation delegation: Alt+Arrow */
  onArrowNav?: (e: React.KeyboardEvent, direction: 'up' | 'down' | 'left' | 'right') => void;
}

/**
 * Numeric input for the Pagination field in the JCF Elements Table.
 *
 * Behavior:
 * - Digits-only filter (strips non-digit characters)
 * - Strips leading zeros (008 → 8)
 * - Inline validation: red border when value is non-empty and invalid
 * - Valid values: 2 (feuillet) or multiples of 4 (cahier: 4, 8, 12, 16, ...)
 * - Table navigation delegation (Tab/Alt+Arrow)
 *
 * @see implicit-logic-specification.md §1.6 (Pagination)
 */
export function JcfPaginationInput({
  value,
  onChange,
  id,
  inputClassName,
  errorClassName = 'border-red-500',
  onTabOut,
  onArrowNav,
}: JcfPaginationInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digitsOnly = e.target.value.replace(/\D/g, '');
      const stripped = digitsOnly.replace(/^0+/, '') || '';
      onChange(stripped);
    },
    [onChange],
  );

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
    },
    [onTabOut, onArrowNav],
  );

  const hasError = useMemo(
    () => value !== '' && !isValidPagination(value),
    [value],
  );

  const className = [
    inputClassName ?? '',
    'text-right',
    hasError ? errorClassName : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder=""
      data-invalid={hasError || undefined}
    />
  );
}

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatDateDDMMYYYY } from '../../utils';

// Generic dropdown option type
interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

// Status colors
function getStatusColor(type: 'paper' | 'bat' | 'plate' | 'forme', value: string): string {
  // Red for blocking states
  if (value === 'to_order' || value === 'waiting_files') {
    return 'text-red-500';
  }
  // Green for ready states
  if (value === 'in_stock' || value === 'delivered' || value === 'bat_approved' || value === 'ready') {
    return 'text-emerald-500';
  }
  // Amber for pending states
  if (value === 'ordered' || value === 'files_received' || value === 'bat_sent' || value === 'to_make') {
    return 'text-amber-500';
  }
  // Gray for none
  return 'text-zinc-500';
}

export interface PrerequisiteDropdownProps<T extends string> {
  /** Dropdown label */
  label: string;
  /** Current value */
  value: T;
  /** Available options */
  options: DropdownOption<T>[];
  /** Type for color styling */
  type: 'paper' | 'bat' | 'plate' | 'forme';
  /** Change handler */
  onChange: (value: T) => void;
  /** Test ID prefix */
  testIdPrefix?: string;
  /** Optional date to display (ISO timestamp) */
  dateValue?: string;
}

/**
 * A single prerequisite status dropdown.
 */
export function PrerequisiteDropdown<T extends string>({
  label,
  value,
  options,
  type,
  onChange,
  testIdPrefix = 'prerequisite',
  dateValue,
}: PrerequisiteDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const currentOption = options.find((o) => o.value === value);
  const colorClass = getStatusColor(type, value);
  const formattedDate = formatDateDDMMYYYY(dateValue);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
        data-testid={`${testIdPrefix}-${type}-dropdown`}
      >
        <span className="text-zinc-500 font-medium">{label}:</span>
        <span className={colorClass}>{currentOption?.label ?? value}</span>
        {formattedDate && (
          <span className="text-zinc-500 ml-0.5" data-testid={`${testIdPrefix}-${type}-date`}>
            {formattedDate}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded shadow-lg z-50 min-w-[120px]"
          data-testid={`${testIdPrefix}-${type}-options`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors ${
                option.value === value ? 'bg-white/5' : ''
              } ${getStatusColor(type, option.value)}`}
              data-testid={`${testIdPrefix}-${type}-option-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

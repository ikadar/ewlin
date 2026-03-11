import { Fragment, useRef, useState } from 'react';
import { Listbox, Portal } from '@headlessui/react';
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

function getPillBgColor(value: string): string {
  if (value === 'to_order' || value === 'waiting_files') return 'bg-red-500/15';
  if (value === 'in_stock' || value === 'delivered' || value === 'bat_approved' || value === 'ready') return 'bg-emerald-500/15';
  if (value === 'ordered' || value === 'files_received' || value === 'bat_sent' || value === 'to_make') return 'bg-amber-500/15';
  return 'bg-zinc-700/40';
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
 * A single prerequisite status dropdown with pill-style trigger.
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
  const currentOption = options.find((o) => o.value === value);
  const colorClass = getStatusColor(type, value);
  const formattedDate = formatDateDDMMYYYY(dateValue);

  // BAT: date shown only in tooltip, not next to pill
  const tooltipText =
    type === 'bat' && formattedDate
      ? `${currentOption?.label ?? value} — ${formattedDate}`
      : (currentOption?.label ?? value);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

  const handleButtonClick = () => {
    if (buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Listbox value={value} onChange={onChange}>
        <div>
          <Listbox.Button
            ref={buttonRef}
            title={tooltipText}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 cursor-pointer ${getPillBgColor(value)}`}
            data-testid={`${testIdPrefix}-${type}-dropdown`}
            onClick={handleButtonClick}
          >
            <span className={colorClass}>{label}</span>
            <ChevronDown className="w-3 h-3 opacity-50 transition-transform ui-open:rotate-180" />
          </Listbox.Button>
          <Portal>
            <Listbox.Options
              className="fixed bg-zinc-800 border border-zinc-700 rounded shadow-lg z-[9999] min-w-[130px] focus:outline-none"
              style={buttonRect ? { top: buttonRect.bottom + 4, left: buttonRect.left } : undefined}
              data-testid={`${testIdPrefix}-${type}-options`}
            >
              {options.map((option) => (
                <Listbox.Option key={option.value} value={option.value} as={Fragment}>
                  {({ active, selected }: { active: boolean; selected: boolean }) => (
                    <button
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${active ? 'bg-white/10' : ''} ${selected ? 'bg-white/5' : ''} ${getStatusColor(type, option.value)}`}
                      data-testid={`${testIdPrefix}-${type}-option-${option.value}`}
                    >
                      {option.label}
                    </button>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Portal>
        </div>
      </Listbox>
      {formattedDate && type !== 'bat' && (
        <span className="text-zinc-500 text-xs" data-testid={`${testIdPrefix}-${type}-date`}>
          {formattedDate}
        </span>
      )}
    </div>
  );
}

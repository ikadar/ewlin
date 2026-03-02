import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  COLUMN_STATUS_OPTIONS,
  PREREQUISITE_STATUS_COLOR,
  type PrerequisiteColumn,
  type PrerequisiteStatus,
} from './fluxTypes';
import { FluxPrerequisiteBadge } from './FluxPrerequisiteBadge';
import { useFluxTableContext } from './FluxTableContext';

interface FluxPrerequisiteListboxProps {
  jobId: string;
  elementId: string;
  column: PrerequisiteColumn;
  status: PrerequisiteStatus;
}

/** Bar color CSS class per prerequisite color (spec 3.9). */
const BAR_COLOR_CLASS: Record<string, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-500',
  red:    'bg-red-500',
  gray:   'bg-zinc-500',
};

/**
 * Interactive prerequisite cell with a trigger badge + fixed-position dropdown.
 * Used for single-element parent rows and sub-rows (spec 3.9, qa.md K8.1).
 */
export const FluxPrerequisiteListbox = memo(function FluxPrerequisiteListbox({
  jobId,
  elementId,
  column,
  status,
}: FluxPrerequisiteListboxProps) {
  const ctx = useFluxTableContext();
  const myId = `${jobId}-${elementId}-${column}`;
  const isOpen = ctx.openListboxId === myId;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, minWidth: 0 });
  const [focusedIndex, setFocusedIndex] = useState(0);

  const options = COLUMN_STATUS_OPTIONS[column];

  // ── Open / Close ────────────────────────────────────────────────────────

  const handleOpen = useCallback(() => {
    if (isOpen) {
      ctx.setOpenListboxId(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownStyle({
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: rect.width,
      });
    }
    const currentIdx = options.indexOf(status);
    setFocusedIndex(currentIdx >= 0 ? currentIdx : 0);
    ctx.setOpenListboxId(myId);
  }, [isOpen, ctx, myId, options, status]);

  // ── Click-outside detection ──────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        ctx.setOpenListboxId(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, ctx]);

  // ── Focus management: move focus to the active option ───────────────────

  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const buttons = dropdownRef.current.querySelectorAll<HTMLButtonElement>('button[role="option"]');
    buttons[focusedIndex]?.focus();
  }, [isOpen, focusedIndex]);

  // ── Option selection ─────────────────────────────────────────────────────

  const handleSelect = useCallback((selectedStatus: PrerequisiteStatus) => {
    ctx.onUpdatePrerequisite(jobId, elementId, column, selectedStatus);
    ctx.setOpenListboxId(null);
    triggerRef.current?.focus();
  }, [ctx, jobId, elementId, column]);

  // ── Keyboard: trigger ────────────────────────────────────────────────────

  const handleTriggerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  }, [handleOpen]);

  // ── Keyboard: dropdown ───────────────────────────────────────────────────

  const handleDropdownKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleSelect(options[focusedIndex]!);
        break;
      case 'Escape':
        e.preventDefault();
        ctx.setOpenListboxId(null);
        triggerRef.current?.focus();
        break;
    }
  }, [options, focusedIndex, handleSelect, ctx]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="inline-block w-full">
      <button
        ref={triggerRef}
        className="w-full flex items-center justify-between gap-1 px-1.5 py-0.5 rounded hover:bg-flux-hover transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500"
        onClick={handleOpen}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="flux-prereq-listbox-trigger"
      >
        <FluxPrerequisiteBadge status={status} />
        {/* Caret icon */}
        <svg
          className="w-3 h-3 flex-shrink-0 transition-transform duration-150"
          style={{
            opacity: 0.35,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'currentColor',
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label={column}
          className="fixed z-50 py-1 shadow-xl overflow-hidden"
          style={{
            top: dropdownStyle.top,
            left: dropdownStyle.left,
            minWidth: Math.max(dropdownStyle.minWidth, 80),
            backgroundColor: 'rgb(26,26,26)',
            border: '1px solid rgb(42,42,42)',
            borderRadius: '6px',
            animation: 'flux-listbox-in 150ms ease-out both',
          }}
          onKeyDown={handleDropdownKeyDown}
          data-testid="flux-prereq-dropdown"
        >
          {options.map((opt, idx) => {
            const color = PREREQUISITE_STATUS_COLOR[opt];
            const barClass = BAR_COLOR_CLASS[color ?? 'gray'] ?? 'bg-zinc-500';
            const isSelected = opt === status;

            return (
              <button
                key={opt}
                role="option"
                aria-selected={isSelected}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-flux-hover transition-colors focus:outline-none focus:bg-flux-hover"
                style={{
                  borderLeft: isSelected
                    ? '2px solid rgb(99,102,241)'
                    : '2px solid transparent',
                  fontSize: '11px',
                }}
                onClick={() => handleSelect(opt)}
                tabIndex={idx === focusedIndex ? 0 : -1}
                data-testid="flux-prereq-option"
                data-option={opt}
              >
                <span
                  className={`flex-shrink-0 rounded-sm ${barClass}`}
                  style={{ width: '3px', height: '14px' }}
                  aria-hidden="true"
                />
                <span className="text-flux-text-secondary">{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

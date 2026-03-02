import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  COLUMN_OPTIONS,
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

/** Color bar inline style per prerequisite color (spec 3.9). */
const BAR_COLOR: Record<string, string> = {
  green:  'rgb(74 222 128)',
  yellow: 'rgb(250 204 21)',
  red:    'rgb(248 113 113)',
  gray:   'rgb(128 128 128)',
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
  const [isHovered, setIsHovered] = useState(false);

  const options = COLUMN_OPTIONS[column];

  // ── Open / Close ────────────────────────────────────────────────────────

  const handleOpen = useCallback(() => {
    if (isOpen) {
      ctx.setOpenListboxId(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownStyle({
        top: rect.bottom + 2,
        left: rect.left,
        minWidth: rect.width,
      });
    }
    const currentIdx = options.findIndex(o => o.value === status);
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
        handleSelect(options[focusedIndex]!.value);
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
    <div style={{ display: 'inline-block', width: '100%' }}>
      <button
        ref={triggerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4px',
          width: '100%',
          height: '100%',
          padding: '0 5px',
          minHeight: '2.25rem',
          background: isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s',
          borderRadius: '2px',
          outline: isOpen ? '1.5px solid rgba(99,102,241,0.5)' : 'none',
          outlineOffset: '-1.5px',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleOpen}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="flux-prereq-listbox-trigger"
      >
        <FluxPrerequisiteBadge status={status} />
        {/* Caret icon */}
        <svg
          style={{
            width: '10px',
            height: '10px',
            flexShrink: 0,
            opacity: isOpen ? 0.6 : 0.35,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s, opacity 0.15s',
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

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label={column}
          style={{
            position: 'fixed',
            top: dropdownStyle.top,
            left: dropdownStyle.left,
            minWidth: Math.max(dropdownStyle.minWidth, 80),
            zIndex: 9999,
            padding: '3px',
            backgroundColor: 'rgb(26 26 26)',
            border: '1px solid rgb(42 42 42)',
            borderRadius: '6px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.3)',
            animation: 'flux-listbox-in 150ms ease both',
          }}
          onKeyDown={handleDropdownKeyDown}
          data-testid="flux-prereq-dropdown"
        >
          {options.map((opt, idx) => {
            const color = PREREQUISITE_STATUS_COLOR[opt.value];
            const barColor = BAR_COLOR[color ?? 'gray'] ?? 'rgb(128 128 128)';
            const isSelected = opt.value === status;

            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className="hover:bg-flux-hover focus:bg-flux-hover focus:outline-none"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '5px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '12px',
                  color: isSelected ? 'rgb(245 245 245)' : 'rgb(209 209 209)',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                  position: 'relative',
                  transition: 'background 0.1s',
                }}
                onClick={() => handleSelect(opt.value)}
                tabIndex={idx === focusedIndex ? 0 : -1}
                data-testid="flux-prereq-option"
                data-option={opt.value}
              >
                {/* Selected indicator bar — absolutely positioned on left edge */}
                <span
                  style={{
                    position: 'absolute',
                    left: '3px',
                    top: '4px',
                    bottom: '4px',
                    width: '2px',
                    borderRadius: '1px',
                    background: 'rgb(99 102 241)',
                    opacity: isSelected ? 1 : 0,
                    transition: 'opacity 0.1s',
                  }}
                  aria-hidden="true"
                />
                {/* Color status bar */}
                <span
                  style={{
                    flexShrink: 0,
                    width: '3px',
                    height: '14px',
                    borderRadius: '1.5px',
                    background: barColor,
                  }}
                  aria-hidden="true"
                />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
});

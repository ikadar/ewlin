import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface FluxSelectOption {
  value: string;
  label: string;
}

interface FluxSelectProps {
  options: FluxSelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FluxSelect({ options, value, onChange, className }: FluxSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, minWidth: 0 });

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  const handleOpen = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownStyle({
        top: rect.bottom + 2,
        left: rect.left,
        minWidth: Math.max(rect.width, 120),
      });
    }
    setActiveIndex(options.findIndex((o) => o.value === value));
    setIsOpen(true);
  }, [isOpen, options, value]);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  // Click-outside
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setIsOpen(false);
          triggerRef.current?.focus();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, options.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < options.length) {
            handleSelect(options[activeIndex].value);
          }
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, options, handleSelect]);

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const item = dropdownRef.current?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, activeIndex]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`flex items-center justify-between cursor-pointer text-left bg-flux-base border border-flux-border-light rounded px-3 py-[7px] text-sm leading-[1.5] text-flux-text-primary focus:outline-none focus:border-flux-text-secondary ${className ?? ''}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-flux-text-tertiary ml-1.5 shrink-0" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 bg-flux-elevated border border-flux-border-light rounded shadow-lg py-1 max-h-48 overflow-y-auto"
            style={{
              top: dropdownStyle.top,
              left: dropdownStyle.left,
              minWidth: dropdownStyle.minWidth,
            }}
          >
            {options.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-flux-hover transition-colors ${
                  idx === activeIndex ? 'bg-flux-hover' : ''
                } ${value === opt.value ? 'text-blue-400 font-medium' : 'text-flux-text-primary'}`}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

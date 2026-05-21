import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 0, label: 'Vital', color: 'text-red-500 font-bold' },
  { value: 1, label: 'Impératif', color: 'text-red-400' },
  { value: 2, label: 'Important', color: 'text-orange-400' },
  { value: 3, label: 'Standard', color: 'text-zinc-100' },
  { value: 4, label: 'Flexible', color: 'text-blue-400' },
];

interface JcfPrioritySelectProps {
  value: number;
  onChange: (value: number) => void;
  inputBaseClass: string;
}

export const JcfPrioritySelect = memo(function JcfPrioritySelect({
  value,
  onChange,
  inputBaseClass,
}: JcfPrioritySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, minWidth: 0 });

  const selected = PRIORITY_OPTIONS.find((o) => o.value === value) ?? PRIORITY_OPTIONS[3];

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
    setActiveIndex(PRIORITY_OPTIONS.findIndex((o) => o.value === value));
    setIsOpen(true);
  }, [isOpen, value]);

  const handleSelect = useCallback(
    (v: number) => {
      onChange(v);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

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
          setActiveIndex((i) => Math.min(i + 1, PRIORITY_OPTIONS.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < PRIORITY_OPTIONS.length) {
            handleSelect(PRIORITY_OPTIONS[activeIndex].value);
          }
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, handleSelect]);

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
        className={`${inputBaseClass} flex items-center justify-between cursor-pointer text-left`}
        data-testid="jcf-field-deadline-priority"
      >
        <span className={`truncate ${selected.color}`}>{selected.label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 ml-1 shrink-0" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-[3px] shadow-lg py-1 max-h-48 overflow-y-auto"
            style={{
              top: dropdownStyle.top,
              left: dropdownStyle.left,
              minWidth: dropdownStyle.minWidth,
            }}
          >
            {PRIORITY_OPTIONS.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-700 ${
                  idx === activeIndex ? 'bg-zinc-700/50' : ''
                } ${value === opt.value ? `${opt.color} font-medium` : 'text-zinc-100'}`}
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
});

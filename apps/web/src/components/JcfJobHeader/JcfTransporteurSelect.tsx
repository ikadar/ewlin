import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { ShipperResponse } from '@/store/api/shipperApi';

interface JcfTransporteurSelectProps {
  shippers: ShipperResponse[];
  value: string;
  onChange: (value: string) => void;
  inputBaseClass: string;
}

export const JcfTransporteurSelect = memo(function JcfTransporteurSelect({
  shippers,
  value,
  onChange,
  inputBaseClass,
}: JcfTransporteurSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, minWidth: 0 });

  const options = [{ id: '', name: 'Aucun' }, ...shippers];

  const selectedName = shippers.find((s) => s.id === value)?.name ?? 'Aucun';

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
        minWidth: Math.max(rect.width, 140),
      });
    }
    setActiveIndex(options.findIndex((o) => o.id === value));
    setIsOpen(true);
  }, [isOpen, options, value]);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
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
            handleSelect(options[activeIndex].id);
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
        className={`${inputBaseClass} flex items-center justify-between cursor-pointer text-left`}
        data-testid="jcf-field-transporteur"
      >
        <span className="truncate">{selectedName}</span>
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
            {options.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-700 ${
                  idx === activeIndex ? 'bg-zinc-700/50' : ''
                } ${value === opt.id ? 'text-blue-400 font-medium' : 'text-zinc-100'}`}
                onClick={() => handleSelect(opt.id)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                {opt.name}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
});

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ShipperResponse } from '@/store/api/shipperApi';
import { useFluxTableContext } from './FluxTableContext';

interface TransporteurCellProps {
  jobInternalId: string;
  jobId: string;
  currentValue: string | null;
  shippers: ShipperResponse[];
  onUpdateShipper: (jobInternalId: string, shipperId: string | null) => void;
}

/**
 * Inline-editable transporteur cell for the Flux table.
 * Click to open a fixed-position dropdown, select a shipper or "Aucun" to clear.
 * Pattern matches FluxPrerequisiteListbox (portal dropdown, click-outside, Esc).
 */
export const TransporteurCell = memo(function TransporteurCell({
  jobInternalId,
  jobId,
  currentValue,
  shippers,
  onUpdateShipper,
}: TransporteurCellProps) {
  const ctx = useFluxTableContext();
  const myId = `transporteur-${jobId}`;
  const isOpen = ctx.openListboxId === myId;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, minWidth: 0 });

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
        minWidth: Math.max(rect.width, 140),
      });
    }
    ctx.setOpenListboxId(myId);
  }, [isOpen, ctx, myId]);

  // Click-outside
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      ctx.setOpenListboxId(null);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, ctx]);

  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        ctx.setOpenListboxId(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, ctx]);

  const handleSelect = useCallback((shipperId: string | null) => {
    onUpdateShipper(jobInternalId, shipperId);
    ctx.setOpenListboxId(null);
  }, [jobInternalId, onUpdateShipper, ctx]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="w-full text-left text-sm text-flux-text-secondary hover:text-flux-text truncate cursor-pointer"
        title={currentValue ?? 'Aucun transporteur'}
      >
        {currentValue ?? '—'}
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-flux-elevated border border-flux-border rounded shadow-lg py-1 max-h-48 overflow-y-auto"
          style={{
            top: dropdownStyle.top,
            left: dropdownStyle.left,
            minWidth: dropdownStyle.minWidth,
          }}
        >
          {/* Aucun option (clear shipper) */}
          <button
            type="button"
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-flux-hover ${
              currentValue === null ? 'text-blue-400 font-medium' : 'text-flux-text-muted'
            }`}
            onClick={() => handleSelect(null)}
          >
            Aucun
          </button>
          {shippers.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-flux-hover ${
                currentValue === s.name ? 'text-blue-400 font-medium' : 'text-flux-text'
              }`}
              onClick={() => handleSelect(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
});

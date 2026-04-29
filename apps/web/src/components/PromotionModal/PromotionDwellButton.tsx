/**
 * Hold-to-confirm primary button for the promotion modal.
 *
 * The chef must press-and-hold for 1.2 s; the button fills with violet
 * during the hold. Mouse-up before completion cancels. This single
 * gesture replaces stacked confirmations (no checkbox + name retype).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Rocket } from 'lucide-react';

interface PromotionDwellButtonProps {
  onConfirmed: () => void;
  disabled?: boolean;
  label?: string;
}

const HOLD_DURATION_MS = 1200;

export function PromotionDwellButton({
  onConfirmed,
  disabled = false,
  label = 'Maintenir pour promouvoir',
}: PromotionDwellButtonProps) {
  const [isHolding, setIsHolding] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    setIsHolding(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (disabled) return;
    setIsHolding(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setIsHolding(false);
      onConfirmed();
    }, HOLD_DURATION_MS);
  }, [disabled, onConfirmed]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={(e) => { e.preventDefault(); start(); }}
      onTouchEnd={cancel}
      onTouchCancel={cancel}
      disabled={disabled}
      className={`relative px-4 py-1.5 rounded-md text-xs font-medium text-white flex items-center gap-1.5 overflow-hidden select-none transition ${
        disabled ? 'bg-zinc-700 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500'
      }`}
      data-testid="promotion-dwell-button"
    >
      <div
        className="absolute inset-0 bg-violet-400 transition-[width] ease-linear"
        style={{
          width: isHolding ? '100%' : '0%',
          transitionDuration: isHolding ? `${HOLD_DURATION_MS}ms` : '0ms',
        }}
      />
      <Rocket size={14} className="relative" />
      <span className="relative">{label}</span>
    </button>
  );
}

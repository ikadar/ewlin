/**
 * Hold-to-confirm primary button.
 *
 * Lifted from PromotionDwellButton (the prod-promotion gesture) so the
 * destructive RAZ flow can reuse the same affordance. Press-and-hold for
 * 1.2 s; the button fills with the chosen accent during the hold.
 * Mouseup, mouseleave, or touchend before completion cancels.
 *
 * The two flavours share every visual property except the color triplet.
 *  - color="violet" → bg-violet-{600,500,400} (promotion)
 *  - color="red"    → bg-red-{600,500,400}    (RAZ)
 */
import { type ComponentType, useCallback, useEffect, useRef, useState } from 'react';
import type { LucideProps } from 'lucide-react';

export type DwellButtonColor = 'violet' | 'red';

interface DwellButtonProps {
  onConfirmed: () => void;
  icon: ComponentType<LucideProps>;
  label: string;
  color?: DwellButtonColor;
  disabled?: boolean;
  testId?: string;
}

const HOLD_DURATION_MS = 1200;

const COLOR_CLASSES: Record<DwellButtonColor, { idle: string; fill: string }> = {
  violet: { idle: 'bg-violet-600 hover:bg-violet-500', fill: 'bg-violet-400' },
  red:    { idle: 'bg-red-600 hover:bg-red-500',       fill: 'bg-red-400'    },
};

export function DwellButton({
  onConfirmed,
  icon: Icon,
  label,
  color = 'violet',
  disabled = false,
  testId,
}: DwellButtonProps) {
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

  const palette = COLOR_CLASSES[color];

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
      className={`relative px-[13px] py-[6px] rounded-[3px] text-sm font-medium text-white flex items-center gap-[6px] overflow-hidden select-none transition ${
        disabled ? 'bg-zinc-700 cursor-not-allowed' : palette.idle
      }`}
      data-testid={testId}
    >
      <div
        className={`absolute inset-0 ${palette.fill} transition-[width] ease-linear`}
        style={{
          width: isHolding ? '100%' : '0%',
          transitionDuration: isHolding ? `${HOLD_DURATION_MS}ms` : '0ms',
        }}
      />
      <Icon size={14} className="relative" />
      <span className="relative">{label}</span>
    </button>
  );
}

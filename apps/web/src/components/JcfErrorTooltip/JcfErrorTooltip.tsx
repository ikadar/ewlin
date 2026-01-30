/**
 * JcfErrorTooltip - Error badge with tooltip for validation feedback
 *
 * Displays a red "!" badge in the corner of a cell when validation fails.
 * Shows a tooltip with error details on hover or when the associated input is focused.
 *
 * @see docs/releases/v0.4.23-jcf-live-format-validation.md
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';

export interface JcfErrorTooltipProps {
  /** Error message (can contain HTML: <br>, <strong>, <code>) */
  message: string;
  /** Whether the error is active/visible */
  visible: boolean;
  /** ID of the associated input element (for focus tracking) */
  inputId?: string;
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowLeft: number;
}

export function JcfErrorTooltip({
  message,
  visible,
  inputId,
}: JcfErrorTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = isHovered || isInputFocused;

  // Track focus on associated input
  useEffect(() => {
    if (!inputId || !visible) return;

    const input = document.getElementById(inputId);
    if (!input) return;

    const handleFocus = () => setIsInputFocused(true);
    const handleBlur = () => setIsInputFocused(false);

    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);

    // Check if already focused (defer to avoid synchronous setState in effect)
    if (document.activeElement === input) {
      requestAnimationFrame(() => setIsInputFocused(true));
    }

    return () => {
      input.removeEventListener('focus', handleFocus);
      input.removeEventListener('blur', handleBlur);
    };
  }, [inputId, visible]);

  // Calculate tooltip position to stay within viewport
  const updatePosition = useCallback(() => {
    if (!badgeRef.current || !tooltipRef.current || !showTooltip) {
      setPosition(null);
      return;
    }

    const badge = badgeRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const padding = 8;

    // Default: center tooltip above badge
    let left = badge.left + badge.width / 2 - tooltip.width / 2;
    let arrowLeft = tooltip.width / 2;

    // Adjust if too close to left edge
    if (left < padding) {
      const shift = padding - left;
      left = padding;
      arrowLeft = Math.max(12, arrowLeft - shift);
    }

    // Adjust if too close to right edge
    if (left + tooltip.width > viewportWidth - padding) {
      const overflow = left + tooltip.width - (viewportWidth - padding);
      left -= overflow;
      arrowLeft = Math.min(tooltip.width - 12, arrowLeft + overflow);
    }

    // Position above the badge with small gap
    const top = badge.top - tooltip.height - 8;

    setPosition({ top, left, arrowLeft });
  }, [showTooltip]);

  useEffect(() => {
    if (showTooltip) {
      requestAnimationFrame(updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [showTooltip, updatePosition]);

  if (!visible) return null;

  return (
    <>
      {/* Error badge with "!" */}
      <span
        ref={badgeRef}
        className="absolute -top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center z-20 cursor-help transition-all duration-200 hover:scale-110 hover:bg-red-400"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-hidden="true"
        data-testid="error-badge"
      >
        !
      </span>

      {/* Tooltip (portal-like, fixed positioning) */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none"
          style={{
            top: position?.top ?? -9999,
            left: position?.left ?? -9999,
            visibility: position ? 'visible' : 'hidden',
          }}
          role="tooltip"
          data-testid="error-tooltip"
        >
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl px-3 py-2.5 max-w-[320px]">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div
                className="text-xs text-zinc-200 leading-relaxed [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_code]:bg-zinc-900 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-zinc-300 [&_code]:font-mono [&_code]:text-xs"
                dangerouslySetInnerHTML={{ __html: message }}
              />
            </div>
          </div>
          {/* Arrow pointing down */}
          <div
            className="absolute -bottom-1.5 w-3 h-3 bg-zinc-800 border-r border-b border-zinc-700 transform rotate-45"
            style={{ left: position?.arrowLeft ?? '50%', marginLeft: '-6px' }}
          />
        </div>
      )}
    </>
  );
}

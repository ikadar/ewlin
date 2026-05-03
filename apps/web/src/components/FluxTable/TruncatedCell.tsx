import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TruncatedCellProps {
  /** Full label shown inside the tooltip on hover. */
  fullText: string;
  /** Optional render override — defaults to fullText. Allows trailing
   *  inline metadata (e.g. an element-count badge) to coexist with the
   *  ellipsised label while the tooltip stays focused on fullText. */
  children?: ReactNode;
  /** Extra classes on the truncating wrapper (typography, alignment). */
  className?: string;
}

const HOVER_DELAY_MS = 500;

/**
 * Single-line cell with CSS ellipsis. After 500ms hover on an actually
 * truncated cell (`scrollWidth > clientWidth`), a portal-rendered
 * tooltip surfaces the full label. Cells whose text fits don't show
 * the tooltip — keeps the dashboard quiet when nothing is hidden.
 */
export function TruncatedCell({ fullText, children, className }: TruncatedCellProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);

  function clearPendingShow() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function isTruncated(el: HTMLElement): boolean {
    return el.scrollWidth > el.clientWidth;
  }

  function handleEnter() {
    const el = wrapperRef.current;
    if (!el || !isTruncated(el)) return;
    clearPendingShow();
    timerRef.current = window.setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setTooltipPos({ left: rect.left + rect.width / 2, top: rect.top });
    }, HOVER_DELAY_MS);
  }

  function handleLeave() {
    clearPendingShow();
    setTooltipPos(null);
  }

  useEffect(() => () => clearPendingShow(), []);

  return (
    <>
      <div
        ref={wrapperRef}
        className={`truncate ${className ?? ''}`.trim()}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {children ?? fullText}
      </div>
      {tooltipPos !== null
        && createPortal(
          <div
            className="flux-tooltip"
            style={{
              position: 'fixed',
              left: tooltipPos.left,
              top: tooltipPos.top - 8,
              transform: 'translate(-50%, -100%)',
              maxWidth: '480px',
              zIndex: 9999,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            }}
            data-testid="flux-truncate-tooltip"
            role="tooltip"
          >
            {fullText}
          </div>,
          document.body,
        )}
    </>
  );
}

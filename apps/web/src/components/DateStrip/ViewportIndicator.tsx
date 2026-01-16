/**
 * ViewportIndicator - Gray border rectangle showing which portion of the day is visible in the grid.
 *
 * v0.3.64: Refactored to use RAF loop with direct DOM manipulation for smooth performance.
 * Reads position from ViewportPositionContext ref instead of props to avoid re-renders.
 * Handles its own visibility based on whether viewport overlaps this day.
 */

import { useEffect, useRef } from 'react';
import { useViewportPosition } from './ViewportPositionContext';

export interface ViewportIndicatorProps {
  /** Day index (0-based from grid start) for calculating position within this day */
  dayIndex: number;
}

/**
 * ViewportIndicator - Uses RAF loop to update position smoothly without React re-renders.
 * Automatically hides when viewport doesn't overlap this day.
 */
export function ViewportIndicator({ dayIndex }: ViewportIndicatorProps) {
  const positionRef = useViewportPosition();
  const elementRef = useRef<HTMLDivElement>(null);

  // RAF loop to update position directly in DOM
  useEffect(() => {
    let rafId: number;
    let lastTop = -1;
    let lastHeight = -1;
    let lastVisible = false;

    const updatePosition = () => {
      const { startHour, endHour } = positionRef.current;

      // Calculate day boundaries
      const dayStartHour = dayIndex * 24;
      const dayEndHour = dayStartHour + 24;

      // Check if viewport overlaps this day
      const isVisible = endHour > dayStartHour && startHour < dayEndHour;

      // Handle visibility change
      if (isVisible !== lastVisible) {
        lastVisible = isVisible;
        if (elementRef.current) {
          elementRef.current.style.display = isVisible ? 'block' : 'none';
        }
      }

      if (isVisible) {
        // Calculate position relative to this day
        const viewportStartInDay = startHour - dayStartHour;
        const viewportEndInDay = endHour - dayStartHour;

        // Calculate position as percentage of cell height (24 hours = 100%)
        const topPercent = (viewportStartInDay / 24) * 100;
        const heightPercent = ((viewportEndInDay - viewportStartInDay) / 24) * 100;

        // Only update DOM if values changed
        if (topPercent !== lastTop || heightPercent !== lastHeight) {
          lastTop = topPercent;
          lastHeight = heightPercent;

          if (elementRef.current) {
            elementRef.current.style.top = `${topPercent}%`;
            elementRef.current.style.height = `${heightPercent}%`;
          }
        }
      }

      rafId = requestAnimationFrame(updatePosition);
    };

    rafId = requestAnimationFrame(updatePosition);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [positionRef, dayIndex]);

  return (
    <div
      ref={elementRef}
      className="absolute left-0.5 right-0.5 border border-zinc-500 rounded-sm pointer-events-none overflow-visible"
      style={{
        display: 'none', // Start hidden, RAF loop will show if needed
        top: '0%',
        height: '33%',
      }}
      data-testid="viewport-indicator"
    />
  );
}

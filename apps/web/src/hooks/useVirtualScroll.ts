import { useMemo, useRef } from 'react';

/** Configuration for virtual scrolling */
export interface VirtualScrollConfig {
  /** Total number of days in the virtual range */
  totalDays: number;
  /** Number of days to render before and after the focused day */
  bufferDays: number;
  /** Height of one day in pixels (24 * pixelsPerHour) */
  dayHeightPx: number;
  /** Current scroll position */
  scrollTop: number;
  /** Viewport height for calculating visible range */
  viewportHeight?: number;
}

/** Result of virtual scroll calculation */
export interface VirtualScrollResult {
  /** Total height of the virtual scroll container */
  totalHeight: number;
  /** Index of the focused day (center of viewport) */
  focusedDayIndex: number;
  /** Range of days to render */
  visibleRange: {
    /** First day index to render */
    start: number;
    /** Last day index to render (inclusive) */
    end: number;
  };
  /** Y offset for positioning rendered content */
  offsetY: number;
  /** Number of days being rendered */
  renderedDayCount: number;
  /** First day's start hour (for filtering assignments) */
  visibleStartHour: number;
  /** Last day's end hour (for filtering assignments) */
  visibleEndHour: number;
}

/**
 * Calculate the visible day range for virtual scrolling.
 *
 * Only days within the buffer around the focused day are rendered.
 * The content is positioned using CSS transform to maintain correct scroll position.
 *
 * @example
 * ```tsx
 * const virtualScroll = useVirtualScroll({
 *   totalDays: 365,
 *   bufferDays: 3,
 *   dayHeightPx: 1920, // 24 * 80
 *   scrollTop: gridScrollTop,
 * });
 *
 * // Render only visible days
 * <div style={{ height: virtualScroll.totalHeight }}>
 *   <div style={{ transform: `translateY(${virtualScroll.offsetY}px)` }}>
 *     {/* Only render days in visibleRange *\/}
 *   </div>
 * </div>
 * ```
 */
export function useVirtualScroll(config: VirtualScrollConfig): VirtualScrollResult {
  const { totalDays, bufferDays, dayHeightPx, scrollTop, viewportHeight = 600 } = config;

  // Stabilize visibleRange reference to prevent unnecessary re-renders
  // Only create new object when start/end actually change
  const prevRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: bufferDays * 2 });

  return useMemo(() => {
    // Calculate total virtual height
    const totalHeight = totalDays * dayHeightPx;

    // Calculate focused day index from scroll position
    // The focused day is the one at the center of the viewport
    const centerY = scrollTop + viewportHeight / 2;
    const focusedDayIndex = Math.floor(centerY / dayHeightPx);

    // Clamp to valid range
    const clampedFocusedDay = Math.max(0, Math.min(totalDays - 1, focusedDayIndex));

    // Calculate visible range with buffer
    const start = Math.max(0, clampedFocusedDay - bufferDays);
    const end = Math.min(totalDays - 1, clampedFocusedDay + bufferDays);

    // Calculate Y offset for positioning rendered content
    const offsetY = start * dayHeightPx;

    // Calculate hours for filtering assignments
    const hoursPerDay = 24;
    const visibleStartHour = start * hoursPerDay;
    const visibleEndHour = (end + 1) * hoursPerDay;

    // Stabilize visibleRange reference - only change if values change
    let visibleRange = prevRangeRef.current;
    if (visibleRange.start !== start || visibleRange.end !== end) {
      visibleRange = { start, end };
      prevRangeRef.current = visibleRange;
    }

    return {
      totalHeight,
      focusedDayIndex: clampedFocusedDay,
      visibleRange,
      offsetY,
      renderedDayCount: end - start + 1,
      visibleStartHour,
      visibleEndHour,
    };
  }, [totalDays, bufferDays, dayHeightPx, scrollTop, viewportHeight]);
}

/**
 * Check if an assignment is within the visible day range.
 * Used to filter assignments for rendering.
 */
export function isAssignmentVisible(
  scheduledStart: string,
  scheduledEnd: string,
  gridStartDate: Date,
  visibleRange: { start: number; end: number }
): boolean {
  const startDate = new Date(scheduledStart);
  const endDate = new Date(scheduledEnd);

  // Calculate day indices for the assignment
  const msPerDay = 24 * 60 * 60 * 1000;
  const gridStartMs = gridStartDate.getTime();

  const assignmentStartDay = Math.floor((startDate.getTime() - gridStartMs) / msPerDay);
  const assignmentEndDay = Math.floor((endDate.getTime() - gridStartMs) / msPerDay);

  // Check if assignment overlaps with visible range
  return assignmentEndDay >= visibleRange.start && assignmentStartDay <= visibleRange.end;
}

/**
 * Calculate which dates should be rendered in the DateStrip.
 * Returns an array of Date objects for the visible range.
 */
export function getVisibleDates(
  startDate: Date,
  visibleRange: { start: number; end: number }
): Date[] {
  const dates: Date[] = [];
  for (let i = visibleRange.start; i <= visibleRange.end; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
}

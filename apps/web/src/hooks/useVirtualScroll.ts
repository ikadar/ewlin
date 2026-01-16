import { useMemo } from 'react';

/** Configuration for virtual scrolling */
export interface VirtualScrollConfig {
  /** Total number of days in the virtual range */
  totalDays: number;
  /** Height of one day in pixels (24 * pixelsPerHour) */
  dayHeightPx: number;
  /** Pre-calculated visible range (start/end day indices) */
  visibleRange: { start: number; end: number };
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
 * Calculate derived values for virtual scrolling from a pre-calculated visible range.
 *
 * v0.3.64: Refactored to accept visibleRange directly instead of scrollTop.
 * This allows the scroll handler to update only when the range changes,
 * eliminating unnecessary re-renders during native scroll.
 *
 * @example
 * ```tsx
 * const virtualScroll = useVirtualScroll({
 *   totalDays: 365,
 *   dayHeightPx: 1920, // 24 * 80
 *   visibleRange: { start: 5, end: 11 },
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
  const { totalDays, dayHeightPx, visibleRange } = config;

  return useMemo(() => {
    const { start, end } = visibleRange;

    // Calculate total virtual height
    const totalHeight = totalDays * dayHeightPx;

    // Focused day is the middle of the visible range
    const focusedDayIndex = Math.floor((start + end) / 2);
    const clampedFocusedDay = Math.max(0, Math.min(totalDays - 1, focusedDayIndex));

    // Calculate Y offset for positioning rendered content
    const offsetY = start * dayHeightPx;

    // Calculate hours for filtering assignments
    const hoursPerDay = 24;
    const visibleStartHour = start * hoursPerDay;
    const visibleEndHour = (end + 1) * hoursPerDay;

    return {
      totalHeight,
      focusedDayIndex: clampedFocusedDay,
      visibleRange,
      offsetY,
      renderedDayCount: end - start + 1,
      visibleStartHour,
      visibleEndHour,
    };
  }, [totalDays, dayHeightPx, visibleRange]);
}

/**
 * Calculate the visible range from scroll position.
 * v0.3.64: Extracted for use in scroll handler to determine when re-render is needed.
 */
export function calculateVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  dayHeightPx: number,
  bufferDays: number,
  totalDays: number
): { start: number; end: number } {
  const firstVisibleDay = Math.floor(scrollTop / dayHeightPx);
  const lastVisibleDay = Math.ceil((scrollTop + viewportHeight) / dayHeightPx);

  const start = Math.max(0, firstVisibleDay - bufferDays);
  const end = Math.min(totalDays - 1, lastVisibleDay + bufferDays);

  return { start, end };
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

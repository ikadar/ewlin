import { useMemo } from 'react';

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

  // Calculate total virtual height
  const totalHeight = totalDays * dayHeightPx;

  // Guard against pathological inputs (zero height, stale scroll past content,
  // NaN from zoom races) that could otherwise yield start > end and collapse
  // the rendered range to nothing — which hides overlays + grid lines together.
  const maxDayIndex = Math.max(0, totalDays - 1);
  const safeDayHeight = dayHeightPx > 0 ? dayHeightPx : 1;
  const safeScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const safeViewportHeight = Number.isFinite(viewportHeight) && viewportHeight > 0
    ? viewportHeight
    : 600;

  // Calculate focused day index from scroll position (for reference/sync purposes)
  // The focused day is the one at the center of the viewport
  const centerY = safeScrollTop + safeViewportHeight / 2;
  const focusedDayIndex = Math.floor(centerY / safeDayHeight);

  // Clamp to valid range
  const clampedFocusedDay = Math.max(0, Math.min(maxDayIndex, focusedDayIndex));

  // Calculate visible range based on actual viewport bounds, clamped into the
  // valid day index space before buffer expansion.
  const rawFirst = Math.floor(safeScrollTop / safeDayHeight);
  const rawLast = Math.ceil((safeScrollTop + safeViewportHeight) / safeDayHeight);
  const firstVisibleDay = Math.max(0, Math.min(maxDayIndex, rawFirst));
  const lastVisibleDay = Math.max(firstVisibleDay, Math.min(maxDayIndex, rawLast));

  // Add buffer around the actual visible range (not around center)
  const start = Math.max(0, firstVisibleDay - bufferDays);
  const end = Math.min(maxDayIndex, lastVisibleDay + bufferDays);

  // Calculate Y offset for positioning rendered content
  const offsetY = start * dayHeightPx;

  // Calculate hours for filtering assignments
  const hoursPerDay = 24;
  const visibleStartHour = start * hoursPerDay;
  const visibleEndHour = (end + 1) * hoursPerDay;

  // Memoize visibleRange to prevent unnecessary re-renders
  const visibleRange = useMemo(() => ({ start, end }), [start, end]);

  // Memoize the full result
  return useMemo(() => ({
    totalHeight,
    focusedDayIndex: clampedFocusedDay,
    visibleRange,
    offsetY,
    renderedDayCount: end - start + 1,
    visibleStartHour,
    visibleEndHour,
  }), [totalHeight, clampedFocusedDay, visibleRange, offsetY, start, end, visibleStartHour, visibleEndHour]);
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

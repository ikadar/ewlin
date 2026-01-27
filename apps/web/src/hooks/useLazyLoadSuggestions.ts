/**
 * useLazyLoadSuggestions — lazy-load autocomplete suggestions on scroll.
 *
 * Shows an initial batch, loads more on scroll, caps at a maximum.
 */

import { useState, useCallback, useMemo } from 'react';

interface UseLazyLoadSuggestionsOptions<T> {
  /** All filtered items to display */
  items: T[];
  /** Number of items to show initially (default: 10) */
  initialLimit?: number;
  /** Maximum items to show (default: 25) */
  maxLimit?: number;
  /** Pixels from bottom to trigger load more (default: 50) */
  loadMoreThreshold?: number;
}

export interface UseLazyLoadSuggestionsResult<T> {
  /** Items currently displayed */
  displayedItems: T[];
  /** Handler for scroll events on the dropdown */
  handleScroll: (e: React.UIEvent<HTMLElement>) => void;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Total count of filtered items */
  totalCount: number;
  /** Reset displayed count (call when filter changes) */
  resetDisplayCount: () => void;
}

export function useLazyLoadSuggestions<T>({
  items,
  initialLimit = 10,
  maxLimit = 25,
  loadMoreThreshold = 50,
}: UseLazyLoadSuggestionsOptions<T>): UseLazyLoadSuggestionsResult<T> {
  const [displayCount, setDisplayCount] = useState(initialLimit);

  const resetDisplayCount = useCallback(() => {
    setDisplayCount(initialLimit);
  }, [initialLimit]);

  const displayedItems = useMemo(() => {
    const effectiveLimit = Math.min(displayCount, maxLimit, items.length);
    return items.slice(0, effectiveLimit);
  }, [items, displayCount, maxLimit]);

  const hasMore = useMemo(() => {
    return displayedItems.length < items.length && displayedItems.length < maxLimit;
  }, [displayedItems.length, items.length, maxLimit]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const target = e.currentTarget;
      const { scrollTop, scrollHeight, clientHeight } = target;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < loadMoreThreshold && hasMore) {
        setDisplayCount((prev) => Math.min(prev + initialLimit, maxLimit));
      }
    },
    [hasMore, initialLimit, maxLimit, loadMoreThreshold]
  );

  return {
    displayedItems,
    handleScroll,
    hasMore,
    totalCount: items.length,
    resetDisplayCount,
  };
}

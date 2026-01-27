import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLazyLoadSuggestions } from './useLazyLoadSuggestions';

// Helper: create N items
function createItems(count: number): { id: number }[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1 }));
}

// Helper: create a scroll event that's near the bottom
function createScrollEvent(scrollTop: number, scrollHeight: number, clientHeight: number) {
  return {
    currentTarget: { scrollTop, scrollHeight, clientHeight },
  } as unknown as React.UIEvent<HTMLElement>;
}

describe('useLazyLoadSuggestions', () => {
  describe('initial limit', () => {
    it('shows first initialLimit items', () => {
      const items = createItems(20);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 10 })
      );
      expect(result.current.displayedItems).toHaveLength(10);
      expect(result.current.displayedItems[0]).toEqual({ id: 1 });
      expect(result.current.displayedItems[9]).toEqual({ id: 10 });
    });

    it('shows all items when fewer than initialLimit', () => {
      const items = createItems(5);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 10 })
      );
      expect(result.current.displayedItems).toHaveLength(5);
    });

    it('uses default initialLimit of 10', () => {
      const items = createItems(20);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items })
      );
      expect(result.current.displayedItems).toHaveLength(10);
    });
  });

  describe('scroll to load more', () => {
    it('loads more items on scroll near bottom', () => {
      const items = createItems(30);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 10, maxLimit: 25 })
      );

      expect(result.current.displayedItems).toHaveLength(10);

      // Simulate scroll near bottom (within 50px threshold)
      act(() => {
        result.current.handleScroll(
          createScrollEvent(200, 300, 60) // distanceFromBottom = 300 - 200 - 60 = 40 < 50
        );
      });

      expect(result.current.displayedItems).toHaveLength(20);
    });

    it('does not load more when not near bottom', () => {
      const items = createItems(30);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 10, maxLimit: 25 })
      );

      act(() => {
        result.current.handleScroll(
          createScrollEvent(0, 300, 60) // distanceFromBottom = 300 - 0 - 60 = 240 > 50
        );
      });

      expect(result.current.displayedItems).toHaveLength(10);
    });
  });

  describe('max limit', () => {
    it('caps displayed items at maxLimit', () => {
      const items = createItems(50);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 10, maxLimit: 25 })
      );

      // Scroll multiple times to load more
      act(() => {
        result.current.handleScroll(createScrollEvent(200, 300, 60));
      });
      act(() => {
        result.current.handleScroll(createScrollEvent(200, 300, 60));
      });
      act(() => {
        result.current.handleScroll(createScrollEvent(200, 300, 60));
      });

      expect(result.current.displayedItems).toHaveLength(25);
    });

    it('uses default maxLimit of 25', () => {
      const items = createItems(50);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 10 })
      );

      // Load all pages
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.handleScroll(createScrollEvent(200, 300, 60));
        });
      }

      expect(result.current.displayedItems).toHaveLength(25);
    });
  });

  describe('reset', () => {
    it('resets display count on resetDisplayCount', () => {
      const items = createItems(30);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 10, maxLimit: 25 })
      );

      // Load more
      act(() => {
        result.current.handleScroll(createScrollEvent(200, 300, 60));
      });
      expect(result.current.displayedItems).toHaveLength(20);

      // Reset
      act(() => {
        result.current.resetDisplayCount();
      });
      expect(result.current.displayedItems).toHaveLength(10);
    });
  });

  describe('hasMore indicator', () => {
    it('returns true when more items available', () => {
      const items = createItems(20);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 10 })
      );
      expect(result.current.hasMore).toBe(true);
    });

    it('returns false when all items displayed', () => {
      const items = createItems(5);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 10 })
      );
      expect(result.current.hasMore).toBe(false);
    });

    it('returns false when at maxLimit', () => {
      const items = createItems(50);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 25, maxLimit: 25 })
      );
      expect(result.current.hasMore).toBe(false);
    });

    it('returns totalCount of all items', () => {
      const items = createItems(30);
      const { result } = renderHook(() =>
        useLazyLoadSuggestions({ items, initialLimit: 10 })
      );
      expect(result.current.totalCount).toBe(30);
    });
  });
});

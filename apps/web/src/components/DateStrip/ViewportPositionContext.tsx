/**
 * ViewportPositionContext - Ref-based context for viewport indicator position.
 *
 * v0.3.64: Uses ref pattern (like PickPreview) to avoid React re-renders.
 * The viewport position is updated directly via ref, and ViewportIndicator
 * reads it in a RAF loop for smooth DOM updates.
 */

import { createContext, useContext, useRef, type ReactNode, type MutableRefObject } from 'react';

export interface ViewportPosition {
  startHour: number;
  endHour: number;
}

const ViewportPositionContext = createContext<MutableRefObject<ViewportPosition> | null>(null);

export function ViewportPositionProvider({ children }: { children: ReactNode }) {
  const positionRef = useRef<ViewportPosition>({ startHour: 0, endHour: 8 });

  return (
    <ViewportPositionContext.Provider value={positionRef}>
      {children}
    </ViewportPositionContext.Provider>
  );
}

/**
 * Hook to get the viewport position ref.
 * Use this to UPDATE the position (in scroll handler).
 */
export function useViewportPositionRef(): MutableRefObject<ViewportPosition> {
  const ref = useContext(ViewportPositionContext);
  if (!ref) {
    throw new Error('useViewportPositionRef must be used within ViewportPositionProvider');
  }
  return ref;
}

/**
 * Hook to get the viewport position ref for reading.
 * Use this in ViewportIndicator to READ the position in RAF loop.
 */
export function useViewportPosition(): MutableRefObject<ViewportPosition> {
  return useViewportPositionRef();
}

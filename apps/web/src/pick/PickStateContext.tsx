/**
 * PickStateContext - State management for Pick & Place mode
 *
 * Replaces drag & drop from sidebar with a click-to-pick, click-to-place pattern.
 * Like a painter dipping their brush in paint, then placing it on canvas.
 *
 * v0.3.57: Extended to support pick from grid tiles (reschedule flow)
 * v0.3.58: Added ghostPositionRef for real-time ghost positioning (bypass React re-renders)
 */

import { createContext, useContext, useReducer, useCallback, useMemo, useRef, type ReactNode, type MutableRefObject } from 'react';
import type { Task, Job } from '@flux/types';

/**
 * v0.3.58: Ghost position stored in a ref for real-time updates without re-renders.
 * PickPreview reads this via RAF for smooth 60fps tracking.
 */
export interface GhostPosition {
  stationId: string | null;
  y: number;
}

/** Source of the pick operation */
export type PickSource = 'sidebar' | 'grid';

/** Pick mode state */
export interface PickState {
  /** Whether pick mode is active (task has been picked) */
  isPicking: boolean;
  /** The task being picked (null when not picking) */
  pickedTask: Task | null;
  /** The job the picked task belongs to (null when not picking) */
  pickedJob: Job | null;
  /** v0.3.57: Source of the pick (sidebar = new placement, grid = reschedule) */
  pickSource: PickSource | null;
  /** v0.3.57: Original assignment ID when picking from grid (for reschedule) */
  originalAssignmentId: string | null;
  /** Current hover position over grid */
  hoverPosition: {
    stationId: string | null;
    snappedY: number;
  };
}

/** Initial state when no pick is active */
export const INITIAL_PICK_STATE: PickState = {
  isPicking: false,
  pickedTask: null,
  pickedJob: null,
  pickSource: null,
  originalAssignmentId: null,
  hoverPosition: {
    stationId: null,
    snappedY: 0,
  },
};

// Action types
type PickAction =
  | { type: 'PICK_TASK'; payload: { task: Task; job: Job; source: PickSource; assignmentId?: string } }
  | { type: 'CANCEL_PICK' }
  | { type: 'UPDATE_HOVER'; payload: { stationId: string | null; snappedY: number } }
  | { type: 'PLACE_TASK' };

// Reducer
function pickReducer(state: PickState, action: PickAction): PickState {
  switch (action.type) {
    case 'PICK_TASK':
      return {
        ...state,
        isPicking: true,
        pickedTask: action.payload.task,
        pickedJob: action.payload.job,
        pickSource: action.payload.source,
        originalAssignmentId: action.payload.assignmentId ?? null,
        hoverPosition: { stationId: null, snappedY: 0 },
      };
    case 'CANCEL_PICK':
    case 'PLACE_TASK':
      return INITIAL_PICK_STATE;
    case 'UPDATE_HOVER':
      return {
        ...state,
        hoverPosition: action.payload,
      };
    default:
      return state;
  }
}

// Context type
interface PickStateContextType {
  state: PickState;
  /** Pick a task. For grid picks, provide assignmentId for reschedule. */
  pickTask: (task: Task, job: Job, source?: PickSource, assignmentId?: string) => void;
  cancelPick: () => void;
  updateHover: (stationId: string | null, snappedY: number) => void;
  placeTask: () => void;
}

// Create context
const PickStateContext = createContext<PickStateContextType | null>(null);

/**
 * v0.3.58: Separate context for ghost position ref.
 * This ref is updated on every mouse move without causing re-renders.
 * PickPreview reads it via requestAnimationFrame for smooth tracking.
 */
const GhostPositionRefContext = createContext<MutableRefObject<GhostPosition> | null>(null);

// Provider component
interface PickStateProviderProps {
  children: ReactNode;
}

export function PickStateProvider({ children }: PickStateProviderProps) {
  const [state, dispatch] = useReducer(pickReducer, INITIAL_PICK_STATE);

  // v0.3.58: Ref for real-time ghost position (no re-renders on update)
  const ghostPositionRef = useRef<GhostPosition>({ stationId: null, y: 0 });

  const pickTask = useCallback((task: Task, job: Job, source: PickSource = 'sidebar', assignmentId?: string) => {
    dispatch({ type: 'PICK_TASK', payload: { task, job, source, assignmentId } });
    // Reset ghost position when picking a new task
    ghostPositionRef.current = { stationId: null, y: 0 };
  }, []);

  const cancelPick = useCallback(() => {
    dispatch({ type: 'CANCEL_PICK' });
    // Reset ghost position on cancel
    ghostPositionRef.current = { stationId: null, y: 0 };
  }, []);

  const updateHover = useCallback((stationId: string | null, snappedY: number) => {
    dispatch({ type: 'UPDATE_HOVER', payload: { stationId, snappedY } });
  }, []);

  const placeTask = useCallback(() => {
    dispatch({ type: 'PLACE_TASK' });
    // Reset ghost position on place
    ghostPositionRef.current = { stationId: null, y: 0 };
  }, []);

  const contextValue = useMemo(
    () => ({ state, pickTask, cancelPick, updateHover, placeTask }),
    [state, pickTask, cancelPick, updateHover, placeTask]
  );

  return (
    <PickStateContext.Provider value={contextValue}>
      <GhostPositionRefContext.Provider value={ghostPositionRef}>
        {children}
      </GhostPositionRefContext.Provider>
    </PickStateContext.Provider>
  );
}

// Hook to access pick state
export function usePickState(): PickStateContextType {
  const context = useContext(PickStateContext);
  if (!context) {
    throw new Error('usePickState must be used within a PickStateProvider');
  }
  return context;
}

// Convenience hook for read-only state access
export function usePickStateValue(): PickState {
  const { state } = usePickState();
  return state;
}

/**
 * v0.3.58: Hook to access ghost position ref for real-time updates.
 * Used by PickPreview to read position via RAF without causing re-renders.
 * Used by handlePickMouseMove to write position directly to ref.
 */
export function usePickGhostPosition(): MutableRefObject<GhostPosition> {
  const ref = useContext(GhostPositionRefContext);
  if (!ref) {
    throw new Error('usePickGhostPosition must be used within a PickStateProvider');
  }
  return ref;
}

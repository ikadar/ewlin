/**
 * PickStateContext - State management for Pick & Place mode
 *
 * Replaces drag & drop from sidebar with a click-to-pick, click-to-place pattern.
 * Like a painter dipping their brush in paint, then placing it on canvas.
 */

import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from 'react';
import type { Task, Job } from '@flux/types';

/** Pick mode state */
export interface PickState {
  /** Whether pick mode is active (task has been picked) */
  isPicking: boolean;
  /** The task being picked (null when not picking) */
  pickedTask: Task | null;
  /** The job the picked task belongs to (null when not picking) */
  pickedJob: Job | null;
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
  hoverPosition: {
    stationId: null,
    snappedY: 0,
  },
};

// Action types
type PickAction =
  | { type: 'PICK_TASK'; payload: { task: Task; job: Job } }
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
  pickTask: (task: Task, job: Job) => void;
  cancelPick: () => void;
  updateHover: (stationId: string | null, snappedY: number) => void;
  placeTask: () => void;
}

// Create context
const PickStateContext = createContext<PickStateContextType | null>(null);

// Provider component
interface PickStateProviderProps {
  children: ReactNode;
}

export function PickStateProvider({ children }: PickStateProviderProps) {
  const [state, dispatch] = useReducer(pickReducer, INITIAL_PICK_STATE);

  const pickTask = useCallback((task: Task, job: Job) => {
    dispatch({ type: 'PICK_TASK', payload: { task, job } });
  }, []);

  const cancelPick = useCallback(() => {
    dispatch({ type: 'CANCEL_PICK' });
  }, []);

  const updateHover = useCallback((stationId: string | null, snappedY: number) => {
    dispatch({ type: 'UPDATE_HOVER', payload: { stationId, snappedY } });
  }, []);

  const placeTask = useCallback(() => {
    dispatch({ type: 'PLACE_TASK' });
  }, []);

  const contextValue = useMemo(
    () => ({ state, pickTask, cancelPick, updateHover, placeTask }),
    [state, pickTask, cancelPick, updateHover, placeTask]
  );

  return <PickStateContext.Provider value={contextValue}>{children}</PickStateContext.Provider>;
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

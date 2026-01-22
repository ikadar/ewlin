/**
 * Pick State Context
 *
 * State management for the Pick & Place interaction pattern.
 * v0.3.54: Initial implementation for sidebar tasks.
 *
 * Key features:
 * - Ghost position tracking via useRef (no React re-renders)
 * - Pick source tracking ('sidebar' | 'grid')
 * - Target station ID for validation
 */

import { createContext, useContext, useState, useRef, useCallback, useMemo, type ReactNode } from 'react';
import type { Task, Job } from '@flux/types';

/** Source of the pick operation */
export type PickSource = 'sidebar' | 'grid';

/** Pick state for context consumers */
export interface PickState {
  /** Currently picked task (null if nothing is picked) */
  pickedTask: Task | null;
  /** Job that the picked task belongs to */
  pickedJob: Job | null;
  /** Source of the pick (sidebar or grid) */
  pickSource: PickSource | null;
  /** Target station ID (the station the task can be placed on) */
  targetStationId: string | null;
  /** Assignment ID if this is a reschedule (grid pick) */
  assignmentId: string | null;
  /** Whether a task is currently picked */
  isPicking: boolean;
  /** Pixels per hour for grid snapping (from zoom level) */
  pixelsPerHour: number;
}

/** Ghost position ref type (updated via RAF, not React state) */
export interface GhostPosition {
  x: number;
  y: number;
}

/** Actions to modify pick state */
export interface PickActions {
  /** Pick a task from the sidebar */
  pickFromSidebar: (task: Task, job: Job) => void;
  /** Pick a task from the grid (reschedule) - v0.3.57 */
  pickFromGrid: (task: Task, job: Job, assignmentId: string) => void;
  /** Update ghost position (called on mouse move) */
  updateGhostPosition: (x: number, y: number) => void;
  /** Cancel the current pick operation */
  cancelPick: () => void;
  /** Complete placement (called after successful drop) */
  completePlacement: () => void;
  /** Set pixels per hour for grid snapping */
  setPixelsPerHour: (pixelsPerHour: number) => void;
}

/** Full context value */
export interface PickContextValue {
  state: PickState;
  actions: PickActions;
  /** Ref for ghost position (access directly for RAF updates) */
  ghostPositionRef: React.MutableRefObject<GhostPosition>;
}

const initialState: PickState = {
  pickedTask: null,
  pickedJob: null,
  pickSource: null,
  targetStationId: null,
  assignmentId: null,
  isPicking: false,
  pixelsPerHour: 80, // Default, will be set from App
};

const PickStateContext = createContext<PickContextValue | null>(null);

export interface PickStateProviderProps {
  children: ReactNode;
}

/**
 * Provider component for pick state.
 * Manages the state of pick & place operations.
 */
export function PickStateProvider({ children }: PickStateProviderProps) {
  const [state, setState] = useState<PickState>(initialState);

  // Ghost position ref - updated directly via RAF, not React state
  // This allows 60fps ghost positioning without React re-renders
  const ghostPositionRef = useRef<GhostPosition>({ x: 0, y: 0 });

  const pickFromSidebar = useCallback((task: Task, job: Job) => {
    // Get target station ID from task
    const targetStationId = task.type === 'Internal' ? task.stationId : null;

    setState({
      pickedTask: task,
      pickedJob: job,
      pickSource: 'sidebar',
      targetStationId,
      assignmentId: null,
      isPicking: true,
    });
  }, []);

  const pickFromGrid = useCallback((task: Task, job: Job, assignmentId: string) => {
    // Get target station ID from task
    const targetStationId = task.type === 'Internal' ? task.stationId : null;

    setState({
      pickedTask: task,
      pickedJob: job,
      pickSource: 'grid',
      targetStationId,
      assignmentId,
      isPicking: true,
    });
  }, []);

  const updateGhostPosition = useCallback((x: number, y: number) => {
    // Direct ref update - no React state change
    ghostPositionRef.current = { x, y };
  }, []);

  const cancelPick = useCallback(() => {
    setState(initialState);
  }, []);

  const completePlacement = useCallback(() => {
    setState(initialState);
  }, []);

  const setPixelsPerHour = useCallback((pixelsPerHour: number) => {
    setState((prev) => ({ ...prev, pixelsPerHour }));
  }, []);

  // Memoize actions to prevent unnecessary re-renders in consumers
  const actions: PickActions = useMemo(() => ({
    pickFromSidebar,
    pickFromGrid,
    updateGhostPosition,
    cancelPick,
    completePlacement,
    setPixelsPerHour,
  }), [pickFromSidebar, pickFromGrid, updateGhostPosition, cancelPick, completePlacement, setPixelsPerHour]);

  // Memoize context value to prevent unnecessary re-renders
  const value: PickContextValue = useMemo(() => ({
    state,
    actions,
    ghostPositionRef,
  }), [state, actions]);

  return (
    <PickStateContext.Provider value={value}>
      {children}
    </PickStateContext.Provider>
  );
}

/**
 * Hook to access full pick context (state + actions + ref).
 */
export function usePickState(): PickContextValue {
  const context = useContext(PickStateContext);
  if (!context) {
    throw new Error('usePickState must be used within a PickStateProvider');
  }
  return context;
}

/**
 * Hook to access pick state only (for components that don't need actions).
 */
export function usePickStateValue(): PickState {
  const context = useContext(PickStateContext);
  if (!context) {
    throw new Error('usePickStateValue must be used within a PickStateProvider');
  }
  return context.state;
}

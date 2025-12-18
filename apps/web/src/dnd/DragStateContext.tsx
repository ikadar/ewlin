/**
 * DragStateContext - Shared drag state for pragmatic-drag-and-drop
 *
 * Replaces dnd-kit's DndContext for state sharing.
 * Provides drag state and update methods to all components.
 */

import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from 'react';
import type { Task, Job } from '@flux/types';
import { type DragState, type DragValidationState, INITIAL_DRAG_STATE } from './types';

// Action types for drag state reducer
type DragAction =
  | {
      type: 'DRAG_START';
      payload: {
        task: Task;
        job: Job;
        assignmentId?: string;
        grabOffset: { x: number; y: number };
      };
    }
  | { type: 'DRAG_END' }
  | { type: 'UPDATE_VALIDATION'; payload: Partial<DragValidationState> }
  | { type: 'UPDATE_GRAB_OFFSET'; payload: { x: number; y: number } };

// Reducer for drag state
function dragReducer(state: DragState, action: DragAction): DragState {
  switch (action.type) {
    case 'DRAG_START':
      return {
        ...state,
        isDragging: true,
        activeTask: action.payload.task,
        activeJob: action.payload.job,
        isRescheduleDrag: !!action.payload.assignmentId,
        activeAssignmentId: action.payload.assignmentId ?? null,
        grabOffset: action.payload.grabOffset,
      };
    case 'DRAG_END':
      return INITIAL_DRAG_STATE;
    case 'UPDATE_VALIDATION':
      return {
        ...state,
        validation: {
          ...state.validation,
          ...action.payload,
        },
      };
    case 'UPDATE_GRAB_OFFSET':
      return {
        ...state,
        grabOffset: action.payload,
      };
    default:
      return state;
  }
}

// Context type
interface DragStateContextType {
  state: DragState;
  startDrag: (task: Task, job: Job, assignmentId?: string, grabOffset?: { x: number; y: number }) => void;
  endDrag: () => void;
  updateValidation: (validation: Partial<DragValidationState>) => void;
  updateGrabOffset: (offset: { x: number; y: number }) => void;
}

// Create context
const DragStateContext = createContext<DragStateContextType | null>(null);

// Provider component
interface DragStateProviderProps {
  children: ReactNode;
}

export function DragStateProvider({ children }: DragStateProviderProps) {
  const [state, dispatch] = useReducer(dragReducer, INITIAL_DRAG_STATE);

  const startDrag = useCallback(
    (task: Task, job: Job, assignmentId?: string, grabOffset: { x: number; y: number } = { x: 0, y: 0 }) => {
      dispatch({
        type: 'DRAG_START',
        payload: { task, job, assignmentId, grabOffset },
      });
    },
    []
  );

  const endDrag = useCallback(() => {
    dispatch({ type: 'DRAG_END' });
  }, []);

  const updateValidation = useCallback((validation: Partial<DragValidationState>) => {
    dispatch({ type: 'UPDATE_VALIDATION', payload: validation });
  }, []);

  const updateGrabOffset = useCallback((offset: { x: number; y: number }) => {
    dispatch({ type: 'UPDATE_GRAB_OFFSET', payload: offset });
  }, []);

  const contextValue = useMemo(
    () => ({ state, startDrag, endDrag, updateValidation, updateGrabOffset }),
    [state, startDrag, endDrag, updateValidation, updateGrabOffset]
  );

  return (
    <DragStateContext.Provider value={contextValue}>
      {children}
    </DragStateContext.Provider>
  );
}

// Hook to access drag state
export function useDragState(): DragStateContextType {
  const context = useContext(DragStateContext);
  if (!context) {
    throw new Error('useDragState must be used within a DragStateProvider');
  }
  return context;
}

// Convenience hook for read-only state access
export function useDragStateValue(): DragState {
  const { state } = useDragState();
  return state;
}

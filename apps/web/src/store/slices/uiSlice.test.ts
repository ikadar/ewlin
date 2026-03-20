/**
 * UI Slice Unit Tests
 *
 * @see docs/releases/v0.4.37-redux-rtk-query-setup.md
 */

import { describe, it, expect } from 'vitest';
import {
  uiReducer,
  setSelectedJobId,
  setIsAltPressed,
  setPickValidation,
  setPixelsPerHour,
  setContextMenu,
  clearContextMenu,
  setFocusedDate,
  setViewportHours,
  resetUiState,
  type UiState,
} from './uiSlice';
import { DEFAULT_PIXELS_PER_HOUR } from '../../utils/zoom';

describe('uiSlice', () => {
  const initialState: UiState = {
    selectedJobId: null,
    isAltPressed: false,
    pickValidation: {
      scheduledStart: null,
      ringState: 'none',
      message: null,
      debugConflicts: [],
    },
    pixelsPerHour: DEFAULT_PIXELS_PER_HOUR,
    contextMenu: null,
    focusedDate: null,
    viewportStartHour: 0,
    viewportEndHour: 8,
  };

  describe('setSelectedJobId', () => {
    it('sets the selected job ID', () => {
      const state = uiReducer(initialState, setSelectedJobId('job-123'));
      expect(state.selectedJobId).toBe('job-123');
    });

    it('clears the selected job ID when set to null', () => {
      const stateWithJob = { ...initialState, selectedJobId: 'job-123' };
      const state = uiReducer(stateWithJob, setSelectedJobId(null));
      expect(state.selectedJobId).toBeNull();
    });
  });

  describe('setIsAltPressed', () => {
    it('sets Alt key state to true', () => {
      const state = uiReducer(initialState, setIsAltPressed(true));
      expect(state.isAltPressed).toBe(true);
    });

    it('sets Alt key state to false', () => {
      const stateWithAlt = { ...initialState, isAltPressed: true };
      const state = uiReducer(stateWithAlt, setIsAltPressed(false));
      expect(state.isAltPressed).toBe(false);
    });
  });

  describe('setPickValidation', () => {
    it('sets pick validation state', () => {
      const validation = {
        scheduledStart: '2024-02-10T08:00:00Z',
        ringState: 'valid' as const,
        message: null,
        debugConflicts: [],
      };
      const state = uiReducer(initialState, setPickValidation(validation));
      expect(state.pickValidation).toEqual(validation);
    });

    it('sets pick validation with conflicts', () => {
      const validation = {
        scheduledStart: '2024-02-10T08:00:00Z',
        ringState: 'invalid' as const,
        message: 'Precedence conflict',
        debugConflicts: [{ type: 'PrecedenceConflict', message: 'Task before predecessor' }],
      };
      const state = uiReducer(initialState, setPickValidation(validation));
      expect(state.pickValidation.ringState).toBe('invalid');
      expect(state.pickValidation.debugConflicts).toHaveLength(1);
    });
  });

  describe('setPixelsPerHour', () => {
    it('sets zoom level', () => {
      const state = uiReducer(initialState, setPixelsPerHour(24));
      expect(state.pixelsPerHour).toBe(24);
    });
  });

  describe('context menu', () => {
    it('setContextMenu opens context menu', () => {
      const menu = { x: 100, y: 200, assignmentId: 'assign-1', isCompleted: false };
      const state = uiReducer(initialState, setContextMenu(menu));
      expect(state.contextMenu).toEqual(menu);
    });

    it('clearContextMenu closes context menu', () => {
      const stateWithMenu = {
        ...initialState,
        contextMenu: { x: 100, y: 200, assignmentId: 'assign-1', isCompleted: false },
      };
      const state = uiReducer(stateWithMenu, clearContextMenu());
      expect(state.contextMenu).toBeNull();
    });
  });

  describe('setFocusedDate', () => {
    it('sets focused date', () => {
      const dateStr = '2024-02-10T12:00:00Z';
      const state = uiReducer(initialState, setFocusedDate(dateStr));
      expect(state.focusedDate).toBe(dateStr);
    });

    it('clears focused date', () => {
      const stateWithDate = { ...initialState, focusedDate: '2024-02-10T12:00:00Z' };
      const state = uiReducer(stateWithDate, setFocusedDate(null));
      expect(state.focusedDate).toBeNull();
    });
  });

  describe('setViewportHours', () => {
    it('sets viewport hours', () => {
      const state = uiReducer(initialState, setViewportHours({ start: 10, end: 20 }));
      expect(state.viewportStartHour).toBe(10);
      expect(state.viewportEndHour).toBe(20);
    });
  });

  describe('resetUiState', () => {
    it('resets all state to initial values', () => {
      const modifiedState: UiState = {
        selectedJobId: 'job-123',
        isAltPressed: true,
        pickValidation: {
          scheduledStart: '2024-02-10T08:00:00Z',
          ringState: 'valid',
          message: 'test',
          debugConflicts: [{ type: 'test' }],
        },
        pixelsPerHour: 24,
        contextMenu: { x: 100, y: 200, assignmentId: 'assign-1', isCompleted: true },
        focusedDate: '2024-02-10T12:00:00Z',
        viewportStartHour: 10,
        viewportEndHour: 20,
      };

      const state = uiReducer(modifiedState, resetUiState());
      expect(state).toEqual(initialState);
    });
  });
});

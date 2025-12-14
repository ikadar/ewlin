import { describe, it, expect } from 'vitest';
import {
  uiReducer,
  toggleLeftPanel,
  toggleRightPanel,
  setLeftPanelCollapsed,
  setRightPanelCollapsed,
  setSelectedJobId,
} from '../uiSlice';

describe('uiSlice', () => {
  const initialState = {
    gridView: 'stations' as const,
    selectedTask: null,
    activePanel: 'jobs' as const,
    isDragging: false,
    draggedTaskId: null,
    timeRange: {
      start: new Date().toISOString().split('T')[0],
      end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
    },
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    selectedJobId: null,
  };

  describe('toggleLeftPanel', () => {
    it('toggles leftPanelCollapsed from false to true', () => {
      const state = uiReducer(initialState, toggleLeftPanel());
      expect(state.leftPanelCollapsed).toBe(true);
    });

    it('toggles leftPanelCollapsed from true to false', () => {
      const state = uiReducer(
        { ...initialState, leftPanelCollapsed: true },
        toggleLeftPanel()
      );
      expect(state.leftPanelCollapsed).toBe(false);
    });
  });

  describe('toggleRightPanel', () => {
    it('toggles rightPanelCollapsed from false to true', () => {
      const state = uiReducer(initialState, toggleRightPanel());
      expect(state.rightPanelCollapsed).toBe(true);
    });

    it('toggles rightPanelCollapsed from true to false', () => {
      const state = uiReducer(
        { ...initialState, rightPanelCollapsed: true },
        toggleRightPanel()
      );
      expect(state.rightPanelCollapsed).toBe(false);
    });
  });

  describe('setLeftPanelCollapsed', () => {
    it('sets leftPanelCollapsed to true', () => {
      const state = uiReducer(initialState, setLeftPanelCollapsed(true));
      expect(state.leftPanelCollapsed).toBe(true);
    });

    it('sets leftPanelCollapsed to false', () => {
      const state = uiReducer(
        { ...initialState, leftPanelCollapsed: true },
        setLeftPanelCollapsed(false)
      );
      expect(state.leftPanelCollapsed).toBe(false);
    });
  });

  describe('setRightPanelCollapsed', () => {
    it('sets rightPanelCollapsed to true', () => {
      const state = uiReducer(initialState, setRightPanelCollapsed(true));
      expect(state.rightPanelCollapsed).toBe(true);
    });

    it('sets rightPanelCollapsed to false', () => {
      const state = uiReducer(
        { ...initialState, rightPanelCollapsed: true },
        setRightPanelCollapsed(false)
      );
      expect(state.rightPanelCollapsed).toBe(false);
    });
  });

  describe('setSelectedJobId', () => {
    it('sets selectedJobId to a value', () => {
      const state = uiReducer(initialState, setSelectedJobId('job-123'));
      expect(state.selectedJobId).toBe('job-123');
    });

    it('sets selectedJobId to null', () => {
      const state = uiReducer(
        { ...initialState, selectedJobId: 'job-123' },
        setSelectedJobId(null)
      );
      expect(state.selectedJobId).toBeNull();
    });
  });
});

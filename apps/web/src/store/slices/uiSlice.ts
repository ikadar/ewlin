/**
 * UI State Slice
 *
 * Manages UI state that was previously in App.tsx useState hooks:
 * - Selection state (selectedJobId)
 * - Keyboard state (isAltPressed)
 * - Quick Placement mode state
 * - Pick & Place validation state
 * - Zoom state (pixelsPerHour)
 * - Context menu state
 * - Date focus state
 *
 * @see docs/releases/v0.4.37-redux-rtk-query-setup.md
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_PIXELS_PER_HOUR } from '../../utils/zoom';

// ============================================================================
// Types
// ============================================================================

export interface QuickPlacementHover {
  stationId: string | null;
  y: number;
  snappedY: number;
}

export interface PickValidation {
  scheduledStart: string | null;
  ringState: 'none' | 'valid' | 'invalid' | 'warning' | 'bypass';
  message: string | null;
  debugConflicts: Array<{ type: string; message?: string }>;
}

export interface ContextMenuState {
  x: number;
  y: number;
  assignmentId: string;
  isCompleted: boolean;
}

export interface UiState {
  /** Currently selected job ID */
  selectedJobId: string | null;
  /** Whether Alt key is pressed (for precedence bypass) */
  isAltPressed: boolean;
  /** Quick Placement mode active */
  isQuickPlacementMode: boolean;
  /** Quick Placement hover state */
  quickPlacementHover: QuickPlacementHover;
  /** Pick & Place validation state */
  pickValidation: PickValidation;
  /** Zoom level in pixels per hour */
  pixelsPerHour: number;
  /** Context menu state (null when closed) */
  contextMenu: ContextMenuState | null;
  /** Currently focused date from grid scroll */
  focusedDate: string | null; // ISO string for serialization
  /** Viewport start hour (for DateStrip indicator) */
  viewportStartHour: number;
  /** Viewport end hour (for DateStrip indicator) */
  viewportEndHour: number;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: UiState = {
  selectedJobId: null,
  isAltPressed: false,
  isQuickPlacementMode: false,
  quickPlacementHover: { stationId: null, y: 0, snappedY: 0 },
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

// ============================================================================
// Slice Definition
// ============================================================================

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedJobId: (state, action: PayloadAction<string | null>) => {
      state.selectedJobId = action.payload;
      // Exit quick placement mode when job changes
      if (action.payload !== state.selectedJobId) {
        state.isQuickPlacementMode = false;
        state.quickPlacementHover = { stationId: null, y: 0, snappedY: 0 };
      }
    },

    setIsAltPressed: (state, action: PayloadAction<boolean>) => {
      state.isAltPressed = action.payload;
    },

    setIsQuickPlacementMode: (state, action: PayloadAction<boolean>) => {
      state.isQuickPlacementMode = action.payload;
      if (!action.payload) {
        state.quickPlacementHover = { stationId: null, y: 0, snappedY: 0 };
      }
    },

    setQuickPlacementHover: (
      state,
      action: PayloadAction<QuickPlacementHover>
    ) => {
      state.quickPlacementHover = action.payload;
    },

    setPickValidation: (state, action: PayloadAction<PickValidation>) => {
      state.pickValidation = action.payload;
    },

    setPixelsPerHour: (state, action: PayloadAction<number>) => {
      state.pixelsPerHour = action.payload;
    },

    setContextMenu: (state, action: PayloadAction<ContextMenuState>) => {
      state.contextMenu = action.payload;
    },

    clearContextMenu: (state) => {
      state.contextMenu = null;
    },

    setFocusedDate: (state, action: PayloadAction<string | null>) => {
      state.focusedDate = action.payload;
    },

    setViewportHours: (
      state,
      action: PayloadAction<{ start: number; end: number }>
    ) => {
      state.viewportStartHour = action.payload.start;
      state.viewportEndHour = action.payload.end;
    },

    resetUiState: () => initialState,
  },
});

// ============================================================================
// Exports
// ============================================================================

export const {
  setSelectedJobId,
  setIsAltPressed,
  setIsQuickPlacementMode,
  setQuickPlacementHover,
  setPickValidation,
  setPixelsPerHour,
  setContextMenu,
  clearContextMenu,
  setFocusedDate,
  setViewportHours,
  resetUiState,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;

/**
 * Redux Store Configuration
 *
 * Central store setup with Redux Toolkit, RTK Query, and typed hooks.
 *
 * @see docs/releases/v0.4.37-redux-rtk-query-setup.md
 * @see docs/architecture/rtk-query-design.md
 */

import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { scheduleApi } from './api/scheduleApi';
import { uiReducer } from './slices/uiSlice';
import { jcfReducer } from './slices/jcfSlice';
import { errorReducer } from './slices/errorSlice';
// ============================================================================
// Store Configuration
// ============================================================================

export const store = configureStore({
  reducer: {
    // RTK Query API reducers
    [scheduleApi.reducerPath]: scheduleApi.reducer,
    // UI state slice
    ui: uiReducer,
    // JCF form state slice
    jcf: jcfReducer,
    // Error state slice
    error: errorReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(scheduleApi.middleware),
  devTools: import.meta.env.DEV,
});

// ============================================================================
// Type Definitions
// ============================================================================

/** Root state type inferred from the store */
export type RootState = ReturnType<typeof store.getState>;

/** Dispatch type inferred from the store */
export type AppDispatch = typeof store.dispatch;

// ============================================================================
// Typed Hooks
// ============================================================================

/**
 * Typed useDispatch hook.
 * Use this instead of plain `useDispatch` for proper typing.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/**
 * Typed useSelector hook.
 * Use this instead of plain `useSelector` for proper typing.
 */
export const useAppSelector = useSelector.withTypes<RootState>();

// ============================================================================
// Re-exports
// ============================================================================

// Re-export RTK Query hooks
export {
  useGetSnapshotQuery,
  useGetClientSuggestionsQuery,
  useLookupByReferenceQuery,
  useLazyLookupByReferenceQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useAssignTaskMutation,
  useRescheduleTaskMutation,
  useUnassignTaskMutation,
  useToggleCompletionMutation,
  useCompactStationMutation,
  scheduleApi,
} from './api/scheduleApi';

// Re-export slice actions
export {
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
  setCompactingStationId,
  setIsCompactingTimeline,
  resetUiState,
} from './slices/uiSlice';

export {
  openJcfModal,
  closeJcfModal,
  setJcfJobId,
  setJcfClient,
  setJcfTemplate,
  setJcfIntitule,
  setJcfQuantity,
  setJcfDeadline,
  setJcfElements,
  setSequenceWorkflow,
  setIsTemplateEditorOpen,
  setIsTemplateSaving,
  setIsJcfSaving,
  setJcfSaveError,
  resetJcfForm,
} from './slices/jcfSlice';

export {
  setError,
  clearError,
  setServiceUnavailable,
  resetErrorState,
  selectCurrentError,
  selectIsServiceUnavailable,
} from './slices/errorSlice';


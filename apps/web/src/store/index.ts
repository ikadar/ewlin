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
import { templateApi } from './api/templateApi';
import { clientApi } from './api/clientApi';
import { stationCategoryApi } from './api/stationCategoryApi';
import { formatApi } from './api/formatApi';
import { impressionPresetApi } from './api/impressionPresetApi';
import { surfacagePresetApi } from './api/surfacagePresetApi';
import { feuilleFormatApi } from './api/feuilleFormatApi';
import { stationApi } from './api/stationApi';
import { providerApi } from './api/providerApi';
import { shipperApi } from './api/shipperApi';
import { fluxApi } from './api/fluxApi';
import { authApi } from './api/authApi';
import { adminUserApi } from './api/adminUserApi';
import { adminUserGroupApi } from './api/adminUserGroupApi';
import { uiReducer } from './slices/uiSlice';
import { jcfReducer } from './slices/jcfSlice';
import { errorReducer } from './slices/errorSlice';
import { authReducer } from './slices/authSlice';
// ============================================================================
// Store Configuration
// ============================================================================

export const store = configureStore({
  reducer: {
    // RTK Query API reducers
    [scheduleApi.reducerPath]: scheduleApi.reducer,
    [templateApi.reducerPath]: templateApi.reducer,
    [clientApi.reducerPath]: clientApi.reducer,
    [stationCategoryApi.reducerPath]: stationCategoryApi.reducer,
    [formatApi.reducerPath]: formatApi.reducer,
    [impressionPresetApi.reducerPath]: impressionPresetApi.reducer,
    [surfacagePresetApi.reducerPath]: surfacagePresetApi.reducer,
    [feuilleFormatApi.reducerPath]: feuilleFormatApi.reducer,
    [stationApi.reducerPath]: stationApi.reducer,
    [providerApi.reducerPath]: providerApi.reducer,
    [shipperApi.reducerPath]: shipperApi.reducer,
    [fluxApi.reducerPath]: fluxApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [adminUserApi.reducerPath]: adminUserApi.reducer,
    [adminUserGroupApi.reducerPath]: adminUserGroupApi.reducer,
    // Auth state slice
    auth: authReducer,
    // UI state slice
    ui: uiReducer,
    // JCF form state slice
    jcf: jcfReducer,
    // Error state slice
    error: errorReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(scheduleApi.middleware)
      .concat(templateApi.middleware)
      .concat(clientApi.middleware)
      .concat(stationCategoryApi.middleware)
      .concat(formatApi.middleware)
      .concat(impressionPresetApi.middleware)
      .concat(surfacagePresetApi.middleware)
      .concat(feuilleFormatApi.middleware)
      .concat(stationApi.middleware)
      .concat(providerApi.middleware)
      .concat(shipperApi.middleware)
      .concat(fluxApi.middleware)
      .concat(authApi.middleware)
      .concat(adminUserApi.middleware)
      .concat(adminUserGroupApi.middleware),
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
  useDeleteJobMutation,
  useClearJobAssignmentsMutation,
  useClearAllAssignmentsMutation,
  useUpdateElementStatusMutation,
  useAssignTaskMutation,
  useRescheduleTaskMutation,
  useUnassignTaskMutation,
  useToggleCompletionMutation,
  useTogglePinMutation,
  useBatchSetPinMutation,
  useBatchRescheduleMutation,
  useSplitTaskMutation,
  useFuseTaskMutation,
  useAutoPlaceJobMutation,
  useAutoPlaceJobAlapMutation,
  useGetSavedSchedulesQuery,
  useSaveScheduleMutation,
  useLoadScheduleMutation,
  useDeleteSavedScheduleMutation,
  scheduleApi,
} from './api/scheduleApi';
export type { SavedScheduleItem } from './api/scheduleApi';

export { useGetTemplatesQuery, useCreateTemplateMutation, useUpdateTemplateMutation, useDeleteTemplateMutation, templateApi } from './api/templateApi';

export {
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
  clientApi,
} from './api/clientApi';
export type { ClientResponse } from './api/clientApi';

export {
  useGetStationCategoriesQuery,
  useCreateStationCategoryMutation,
  useUpdateStationCategoryMutation,
  useDeleteStationCategoryMutation,
  stationCategoryApi,
} from './api/stationCategoryApi';
export type { StationCategoryResponse, StationCategoryInput, SimilarityCriterionInput } from './api/stationCategoryApi';

export {
  useGetFormatsQuery,
  useCreateFormatMutation,
  useUpdateFormatMutation,
  useDeleteFormatMutation,
  formatApi,
} from './api/formatApi';
export type { FormatResponse, FormatInput } from './api/formatApi';

export {
  useGetImpressionPresetsQuery,
  useCreateImpressionPresetMutation,
  useUpdateImpressionPresetMutation,
  useDeleteImpressionPresetMutation,
  impressionPresetApi,
} from './api/impressionPresetApi';
export type { ImpressionPresetResponse, ImpressionPresetInput } from './api/impressionPresetApi';

export {
  useGetSurfacagePresetsQuery,
  useCreateSurfacagePresetMutation,
  useUpdateSurfacagePresetMutation,
  useDeleteSurfacagePresetMutation,
  surfacagePresetApi,
} from './api/surfacagePresetApi';
export type { SurfacagePresetResponse, SurfacagePresetInput } from './api/surfacagePresetApi';

export {
  useGetFeuilleFormatsQuery,
  useCreateFeuilleFormatMutation,
  useUpdateFeuilleFormatMutation,
  useDeleteFeuilleFormatMutation,
  feuilleFormatApi,
} from './api/feuilleFormatApi';
export type { FeuilleFormatResponse, FeuilleFormatInput } from './api/feuilleFormatApi';

export {
  useGetStationsQuery,
  useCreateStationMutation,
  useUpdateStationMutation,
  useDeleteStationMutation,
  stationApi,
} from './api/stationApi';
export type { StationResponse, StationInput } from './api/stationApi';

export {
  useGetProvidersQuery,
  useCreateProviderMutation,
  useUpdateProviderMutation,
  useDeleteProviderMutation,
  providerApi,
} from './api/providerApi';
export type { ProviderResponse, ProviderInput } from './api/providerApi';

export {
  useGetShippersQuery,
  useCreateShipperMutation,
  useUpdateShipperMutation,
  useDeleteShipperMutation,
  shipperApi,
} from './api/shipperApi';
export type { ShipperResponse, ShipperInput } from './api/shipperApi';

export { useGetFluxJobsQuery, useUpdateSTStatusMutation, useUpdateElementPrerequisiteMutation, useUpdateJobShipperMutation, useToggleJobShippedMutation, fluxApi } from './api/fluxApi';

export { useLoginMutation, useGetMeQuery, authApi } from './api/authApi';

export {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  adminUserApi,
} from './api/adminUserApi';
export type { AdminUserResponse, AdminUserInput, AdminUserGroup } from './api/adminUserApi';

export {
  useGetUserGroupsQuery,
  useCreateUserGroupMutation,
  useUpdateUserGroupMutation,
  useDeleteUserGroupMutation,
  adminUserGroupApi,
} from './api/adminUserGroupApi';
export type { AdminUserGroupResponse, AdminUserGroupInput } from './api/adminUserGroupApi';

// Re-export slice actions
export {
  setSelectedJobId,
  setIsAltPressed,
  setPickValidation,
  setPixelsPerHour,
  setContextMenu,
  clearContextMenu,
  setFocusedDate,
  setViewportHours,
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
  setJcfShipperId,
  setJcfElements,
  setSequenceWorkflow,
  setIsTemplateEditorOpen,
  setIsTemplateSaving,
  setIsJcfSaving,
  setJcfSaveError,
  setJcfRequiredJobs,
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

export {
  setCredentials,
  logout,
  selectAuthToken,
  selectCurrentUser,
  selectIsAuthenticated,
} from './slices/authSlice';
export type { AuthUser, AuthUserGroup } from './slices/authSlice';


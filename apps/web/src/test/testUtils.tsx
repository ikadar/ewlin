/**
 * Test utilities for wrapping components with Redux Provider
 *
 * @see v0.5.5 - Required for testing components that use RTK Query hooks
 */

/* eslint-disable react-refresh/only-export-components */

import { ReactNode } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, RenderOptions } from '@testing-library/react';
import { scheduleApi } from '../store/api/scheduleApi';
import { templateApi } from '../store/api/templateApi';
import { clientApi } from '../store/api/clientApi';
import { formatApi } from '../store/api/formatApi';
import { impressionPresetApi } from '../store/api/impressionPresetApi';
import { surfacagePresetApi } from '../store/api/surfacagePresetApi';
import { stationCategoryApi } from '../store/api/stationCategoryApi';
import { uiReducer } from '../store/slices/uiSlice';
import { jcfReducer } from '../store/slices/jcfSlice';
import { errorReducer } from '../store/slices/errorSlice';

/**
 * Create a test store with optional preloaded state
 */
export function createTestStore(preloadedState?: Record<string, unknown>) {
  return configureStore({
    reducer: {
      [scheduleApi.reducerPath]: scheduleApi.reducer,
      [templateApi.reducerPath]: templateApi.reducer,
      [clientApi.reducerPath]: clientApi.reducer,
      [formatApi.reducerPath]: formatApi.reducer,
      [impressionPresetApi.reducerPath]: impressionPresetApi.reducer,
      [surfacagePresetApi.reducerPath]: surfacagePresetApi.reducer,
      [stationCategoryApi.reducerPath]: stationCategoryApi.reducer,
      ui: uiReducer,
      jcf: jcfReducer,
      error: errorReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .concat(scheduleApi.middleware)
        .concat(templateApi.middleware)
        .concat(clientApi.middleware)
        .concat(formatApi.middleware)
        .concat(impressionPresetApi.middleware)
        .concat(surfacagePresetApi.middleware)
        .concat(stationCategoryApi.middleware),
    preloadedState,
  });
}

interface WrapperProps {
  children: ReactNode;
}

/**
 * Wrapper component that provides Redux store
 */
function TestWrapper({ children }: WrapperProps) {
  const store = createTestStore();
  return <Provider store={store}>{children}</Provider>;
}

/**
 * Custom render function that wraps component with Redux Provider
 * Use this instead of @testing-library/react render for components using RTK Query
 */
export function renderWithRedux(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: TestWrapper, ...options });
}

/**
 * Re-export everything from @testing-library/react
 */
export * from '@testing-library/react';
export { renderWithRedux as render };

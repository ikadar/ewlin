/**
 * Test utilities for wrapping components with Redux Provider
 *
 * @see v0.5.5 - Required for testing components that use RTK Query hooks
 */

/* eslint-disable react-refresh/only-export-components */

import type { ReactNode } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { scheduleApi } from '../store/api/scheduleApi';
import { templateApi } from '../store/api/templateApi';
import { clientApi } from '../store/api/clientApi';
import { formatApi } from '../store/api/formatApi';
import { impressionPresetApi } from '../store/api/impressionPresetApi';
import { surfacagePresetApi } from '../store/api/surfacagePresetApi';
import { stationCategoryApi } from '../store/api/stationCategoryApi';
import { feuilleFormatApi } from '../store/api/feuilleFormatApi';
import { uiReducer } from '../store/slices/uiSlice';
import { jcfReducer } from '../store/slices/jcfSlice';
import { errorReducer } from '../store/slices/errorSlice';

/**
 * Create a test store with optional preloaded state
 */
export function createTestStore() {
  return configureStore({
    reducer: {
      scheduleApi: scheduleApi.reducer,
      templateApi: templateApi.reducer,
      clientApi: clientApi.reducer,
      formatApi: formatApi.reducer,
      impressionPresetApi: impressionPresetApi.reducer,
      surfacagePresetApi: surfacagePresetApi.reducer,
      stationCategoryApi: stationCategoryApi.reducer,
      feuilleFormatApi: feuilleFormatApi.reducer,
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
        .concat(stationCategoryApi.middleware)
        .concat(feuilleFormatApi.middleware),
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

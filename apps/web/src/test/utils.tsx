import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { uiReducer } from '../store/uiSlice';
import { scheduleReducer } from '../store/scheduleSlice';
import type { RootState } from '../store';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: Partial<RootState>;
}

export function renderWithProviders(
  ui: ReactElement,
  { preloadedState = {}, ...renderOptions }: ExtendedRenderOptions = {}
) {
  const store = configureStore({
    reducer: {
      ui: uiReducer,
      schedule: scheduleReducer,
    },
    preloadedState: preloadedState as RootState,
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Re-export commonly used testing library utilities
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
export { renderWithProviders as render };

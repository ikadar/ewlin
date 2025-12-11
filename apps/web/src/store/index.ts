import { configureStore } from '@reduxjs/toolkit';
import { scheduleReducer } from './scheduleSlice';
import { uiReducer } from './uiSlice';

export const store = configureStore({
  reducer: {
    schedule: scheduleReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { qaApi } from './qa/store/qaApi';
import { qaReducer } from './qa/store/qaSlice';

export const store = configureStore({
  reducer: {
    [qaApi.reducerPath]: qaApi.reducer,
    qa: qaReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(qaApi.middleware),
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

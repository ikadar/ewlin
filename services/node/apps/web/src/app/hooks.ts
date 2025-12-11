import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

/**
 * Typed version of useDispatch hook.
 * Use this throughout the app instead of plain useDispatch.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/**
 * Typed version of useSelector hook.
 * Use this throughout the app instead of plain useSelector.
 */
export const useAppSelector = useSelector.withTypes<RootState>();

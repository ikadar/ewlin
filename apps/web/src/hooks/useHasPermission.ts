import { useAppSelector } from '../store';
import { selectCurrentUser } from '../store/slices/authSlice';
import { shouldUseMockMode } from '../store/api/baseApi';

/**
 * Returns true if the current user has at least one of the given permissions.
 * In mock mode, always returns true.
 */
export function useHasPermission(...permissions: string[]): boolean {
  const user = useAppSelector(selectCurrentUser);
  if (shouldUseMockMode()) return true;
  if (!user) return false;
  return permissions.some((p) => user.permissions.includes(p));
}

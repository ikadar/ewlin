import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../store';
import { selectIsAuthenticated } from '../../store/slices/authSlice';
import { shouldUseMockMode } from '../../store/api/baseApi';

/**
 * Route guard that redirects unauthenticated users to /login.
 * In mock mode, auth is bypassed entirely.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  if (shouldUseMockMode()) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

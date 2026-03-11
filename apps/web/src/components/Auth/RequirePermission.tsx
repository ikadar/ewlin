import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useHasPermission } from '../../hooks/useHasPermission';

/**
 * Route guard that redirects users without the required permission.
 */
export function RequirePermission({
  permission,
  children,
  redirectTo = '/',
}: {
  permission: string | string[];
  children: ReactNode;
  redirectTo?: string;
}) {
  const permissions = Array.isArray(permission) ? permission : [permission];
  const allowed = useHasPermission(...permissions);

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useScenarioMode, type ScenarioMode } from '../../contexts/ScenarioContext';
import { resolveEnvSwitchDestination } from '../../utils/envRouteResolver';

/**
 * Route guard that redirects users out of pages forbidden in the
 * current scenario env. Twin pages (Logistique ↔ Scénarios) jump
 * to their counterpart; the `?env=` query param is preserved so
 * the X-Flux-Scenario header doesn't change silently.
 */
export function RequireEnv({
  allowed,
  children,
}: {
  allowed: ScenarioMode | ScenarioMode[];
  children: ReactNode;
}) {
  const { mode } = useScenarioMode();
  const location = useLocation();
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];
  if (!allowedList.includes(mode)) {
    const destPath = resolveEnvSwitchDestination(location.pathname, mode);
    return <Navigate to={{ pathname: destPath, search: location.search }} replace />;
  }
  return <>{children}</>;
}

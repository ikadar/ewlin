import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ScenarioMode } from '../contexts/ScenarioContext';
import { resolveEnvSwitchDestination } from '../utils/envRouteResolver';

/**
 * Toggle between Préprod and Prod with twin-aware navigation.
 *
 * Replaces the bare `setMode` call from `useScenarioMode` for any
 * UI that lets the user switch env: when the current path is
 * env-exclusive (Logistique / Scénarios), the user lands on the twin
 * screen in the target env rather than at `/`.
 */
export function useEnvSwitch() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (target: ScenarioMode) => {
      const destPath = resolveEnvSwitchDestination(location.pathname, target);
      const params = new URLSearchParams(location.search);
      if (target === 'prod') {
        params.set('env', 'prod');
      } else {
        params.delete('env');
      }
      const qs = params.toString();
      navigate(qs ? `${destPath}?${qs}` : destPath);
    },
    [location.pathname, location.search, navigate],
  );
}

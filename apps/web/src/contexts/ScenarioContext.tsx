/**
 * Scenario context — V1: 'preprod' | 'prod'.
 *
 * Source of truth: the `?env=prod` URL query param. Default is 'preprod'.
 * Persisting in the URL (not localStorage) means the chef can keep two
 * tabs open with different envs (handy for cross-checking) and the env is
 * shareable via link.
 *
 * Sim and Archive are deferred to v1.x.
 */
import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type ScenarioMode = 'preprod' | 'prod';

interface ScenarioContextValue {
  mode: ScenarioMode;
  setMode: (m: ScenarioMode) => void;
  /** Convenience: true when in prod (read-only except completion). */
  isReadOnly: boolean;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

function readModeFromSearch(search: string): ScenarioMode {
  const params = new URLSearchParams(search);
  return params.get('env') === 'prod' ? 'prod' : 'preprod';
}

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const mode = readModeFromSearch(location.search);

  const setMode = useCallback(
    (next: ScenarioMode) => {
      const params = new URLSearchParams(location.search);
      if (next === 'prod') {
        params.set('env', 'prod');
      } else {
        params.delete('env');
      }
      const qs = params.toString();
      const target = qs ? `${location.pathname}?${qs}` : location.pathname;
      navigate(target, { replace: false });
    },
    [location.pathname, location.search, navigate],
  );

  const value = useMemo<ScenarioContextValue>(
    () => ({ mode, setMode, isReadOnly: mode === 'prod' }),
    [mode, setMode],
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenarioMode(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) {
    throw new Error('useScenarioMode must be used within ScenarioProvider');
  }
  return ctx;
}

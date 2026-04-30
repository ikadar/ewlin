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
import type { NavigateOptions } from 'react-router-dom';

export type ScenarioMode = 'preprod' | 'prod';

interface ScenarioContextValue {
  mode: ScenarioMode;
  setMode: (m: ScenarioMode) => void;
  /** Convenience: true when in prod (read-only except completion). */
  isReadOnly: boolean;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

function readModeFromSearch(search: string, fallback: ScenarioMode): ScenarioMode {
  const params = new URLSearchParams(search);
  const raw = params.get('env');
  if (raw === 'prod') return 'prod';
  if (raw === 'preprod') return 'preprod';
  return fallback;
}

interface ScenarioProviderProps {
  children: ReactNode;
  /**
   * Mode used when the URL has no `?env=` param. Defaults to 'preprod'
   * (chef view). FocusLayout overrides to 'prod' because the focus view is
   * the operator-on-floor experience where execution truth is reported —
   * defaulting to préprod there would hide the CompletionToggleIcon and
   * leave operators with no way to mark tiles as done.
   */
  defaultMode?: ScenarioMode;
}

export function ScenarioProvider({ children, defaultMode = 'preprod' }: ScenarioProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const mode = readModeFromSearch(location.search, defaultMode);

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

/**
 * Wraps `useNavigate` to preserve the `?env=` query param across in-app
 * navigation. Without it, clicking from /planning to /flux drops the
 * current env, which silently switches the entire app — and crucially
 * the `X-Flux-Scenario` HTTP header on every API request — from Prod
 * back to Préprod (see realBaseQuery.resolveScenarioHeader).
 *
 * If the caller's path already carries its own `env` value, that wins.
 * The wrapper only fills in `env` when missing.
 */
export function useEnvAwareNavigate() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (to: string, options?: NavigateOptions) => {
      const env = new URLSearchParams(location.search).get('env');
      if (!env) {
        navigate(to, options);
        return;
      }
      const [pathPart, queryPart] = to.split('?');
      const params = new URLSearchParams(queryPart ?? '');
      if (!params.has('env')) {
        params.set('env', env);
      }
      const qs = params.toString();
      navigate(qs ? `${pathPart}?${qs}` : (pathPart ?? to), options);
    },
    [navigate, location.search],
  );
}

import { useEffect, useRef } from 'react';
import { useAppDispatch } from '../store';
import { useScenarioMode } from '../contexts/ScenarioContext';
import type { ScenarioMode } from '../contexts/ScenarioContext';
import { fluxApi } from '../store/api/fluxApi';
import { scheduleApi } from '../store/api/scheduleApi';
import { pinApi } from '../store/api/pinApi';
import { saisieApi } from '../store/api/saisieApi';
import { prodSnapshotApi } from '../store/api/prodSnapshotApi';
import { archiveApi } from '../store/api/archiveApi';
import { consoleApi } from '../store/api/consoleApi';
import { logisticsApi } from '../store/api/logisticsApi';

/**
 * Reset every scenario-scoped RTK Query cache when the active env
 * (Préprod ↔ Prod) flips.
 *
 * Why: `realBaseQuery.prepareHeaders` resolves `X-Flux-Scenario` per
 * request from `?env=`, but RTK Query caches by query argument — the
 * header alone never changes the cache key. A flip therefore keeps
 * the previous scenario's data on screen until the next refetch
 * trigger, which the chef reported as "I created a job in Préprod,
 * switched to Prod, and the job is still there until I refresh".
 *
 * `resetApiState()` is intentionally heavy-handed (drops queries,
 * subscriptions and state) — the user's mental model of an env
 * switch is "everything reflects the new env", so a hard reset
 * matches the contract. APIs that are scenario-independent
 * (templates, formats, station/operator settings, simulation list,
 * auth) are NOT reset because their data does not vary with `env`.
 *
 * Mounted in RootLayoutInner and ScenarioShellInner — both render
 * under the Redux store and `ScenarioProvider`.
 */
export function useScenarioCacheReset(): void {
  const { mode } = useScenarioMode();
  const dispatch = useAppDispatch();
  const prevModeRef = useRef<ScenarioMode | null>(null);

  useEffect(() => {
    if (prevModeRef.current !== null && prevModeRef.current !== mode) {
      dispatch(fluxApi.util.resetApiState());
      dispatch(scheduleApi.util.resetApiState());
      dispatch(pinApi.util.resetApiState());
      dispatch(saisieApi.util.resetApiState());
      dispatch(prodSnapshotApi.util.resetApiState());
      dispatch(archiveApi.util.resetApiState());
      dispatch(consoleApi.util.resetApiState());
      dispatch(logisticsApi.util.resetApiState());
    }
    prevModeRef.current = mode;
  }, [mode, dispatch]);
}

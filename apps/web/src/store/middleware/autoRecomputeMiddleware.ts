/**
 * autoRecomputeMiddleware — fire the Phase-1/Phase-2 compute trigger
 * whenever a mutation that changes scheduling constraints fulfils.
 *
 * Why here rather than at each call site:
 *   - Covers all current and future call sites of a given mutation by
 *     name (adding a new page that edits operators does not require
 *     touching the auto-recompute wiring).
 *   - Keeps page components unaware of the compute orchestration.
 *   - The allow-list is the single source of truth — diffing it is
 *     the only review needed to understand what triggers a recompute.
 *
 * The trigger function lives in React state (inside
 * AutoRecomputeProvider) so the middleware can only reach it through
 * a module-scope holder. The provider registers its trigger on mount
 * and clears it on unmount via registerAutoRecomputeTrigger.
 *
 * Endpoint names match the RTK Query `builder.mutation` keys. They
 * appear at runtime as action.meta.arg.endpointName on every
 * `{api}/{endpoint}/fulfilled` action RTK emits.
 */

import type { Middleware } from '@reduxjs/toolkit';
import { operatorApi } from '../api/operatorApi';
import { stationApi } from '../api/stationApi';
import { stationCategoryApi } from '../api/stationCategoryApi';
import { providerApi } from '../api/providerApi';
import { fluxApi } from '../api/fluxApi';

type TriggerFn = (reason: string) => void;

let registeredTrigger: TriggerFn | null = null;

/** Called by AutoRecomputeProvider on mount / unmount. */
export function registerAutoRecomputeTrigger(fn: TriggerFn | null): void {
  registeredTrigger = fn;
}

/**
 * Union of every RTK Query endpoint name whose fulfillment should
 * trigger an auto-recompute. Each entry is constrained to the actual
 * endpoint set of its API slice via `Extract<keyof typeof api.endpoints, ...>`
 * so renaming an endpoint surface fails at compile time rather than
 * silently dropping the trigger.
 */
type AutoRecomputeEndpointName =
  // Operator lifecycle — absences, schedules, skills propagate through.
  | Extract<keyof typeof operatorApi.endpoints,
      'createOperator' | 'updateOperator' | 'deleteOperator'
      | 'replaceSkills' | 'replaceConcurrentGroups'>
  // Station availability, tick granularity, schedule exceptions, etc.
  | Extract<keyof typeof stationApi.endpoints,
      'createStation' | 'updateStation' | 'deleteStation'>
  // Station category rules (similarityScoreRules etc.) feed the scoring.
  | Extract<keyof typeof stationCategoryApi.endpoints,
      'createStationCategory' | 'updateStationCategory' | 'deleteStationCategory'>
  // OutsourcedProvider — transitDays + action type support drive outsourcing gaps.
  | Extract<keyof typeof providerApi.endpoints,
      'createProvider' | 'updateProvider' | 'deleteProvider'>
  // Element prerequisite status — flipping to Ready unblocks held tasks.
  | Extract<keyof typeof fluxApi.endpoints, 'updateElementPrerequisite'>;

/**
 * Endpoints whose success means "the scheduling problem constraints
 * changed" and the planning may be stale. Debounce inside the trigger
 * collapses rapid-fire edits (bulk save, chained mutations) into one
 * actual compute.
 *
 * Not included (intentional): pin/completion/override toggles, split/
 * fuse, auto-place, outsourcing-date updates — these don't change the
 * engine's view of the problem, either because the safety zone already
 * protects them or because they're localised to a single task.
 */
const AUTO_RECOMPUTE_ENDPOINTS: ReadonlySet<AutoRecomputeEndpointName> = new Set<AutoRecomputeEndpointName>([
  'createOperator',
  'updateOperator',
  'deleteOperator',
  'replaceSkills',
  'replaceConcurrentGroups',
  'createStation',
  'updateStation',
  'deleteStation',
  'createStationCategory',
  'updateStationCategory',
  'deleteStationCategory',
  'createProvider',
  'updateProvider',
  'deleteProvider',
  'updateElementPrerequisite',
]);

export const autoRecomputeMiddleware: Middleware = () => (next) => (action) => {
  const result = next(action);

  if (
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    typeof action.type === 'string' &&
    action.type.endsWith('/fulfilled') &&
    'meta' in action &&
    typeof (action as { meta?: unknown }).meta === 'object' &&
    (action as { meta?: unknown }).meta !== null
  ) {
    const meta = (action as { meta: { arg?: { endpointName?: string } } }).meta;
    const endpointName = meta.arg?.endpointName;
    // Runtime membership check; the cast narrows the value to the
    // union type once the Set confirms it.
    if (endpointName && AUTO_RECOMPUTE_ENDPOINTS.has(endpointName as AutoRecomputeEndpointName)) {
      registeredTrigger?.(`mutation: ${endpointName}`);
    }
  }

  return result;
};

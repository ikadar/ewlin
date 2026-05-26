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
import { scheduleApi } from '../api/scheduleApi';
import { acompteApi } from '../api/acompteApi';
import { saisieApi } from '../api/saisieApi';
import { pinApi } from '../api/pinApi';

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
      'createOperator' | 'updateOperator' | 'deleteOperator' | 'restoreOperator'
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
  | Extract<keyof typeof fluxApi.endpoints, 'updateElementPrerequisite'>
  // JCF modification — sequence, gates, or prerequisites changed.
  | Extract<keyof typeof scheduleApi.endpoints, 'updateElementSequence'>
  // Paper lead-time hours — the global floor that gates tasks whose
  // element has paperStatus not Ready. Reducing it can unblock work.
  | Extract<keyof typeof scheduleApi.endpoints, 'updatePaperLeadTime'>
  // Forme (die) lead-time — same logic for formeStatus.
  | Extract<keyof typeof scheduleApi.endpoints, 'updateFormeLeadTime'>
  // Plate lead-time — calendar-hour offset for plateStatus gate.
  | Extract<keyof typeof scheduleApi.endpoints, 'updatePlateLeadTime'>
  // V2 progress capture — operator saisie d'avancement persists a new
  // productivityRatio + scheduledEnd on the assignment ; the engine then
  // propagates the run-only ratio to the remaining fragments of the job.
  // recordProgressDirect (Flux mode avancement pct=100/0) marks the task
  // as completed on the wall — the engine must replan to free the station.
  | Extract<keyof typeof saisieApi.endpoints, 'reportSaisie' | 'recordProgressDirect'>
  // V2 progress capture — parameterized pin moves a tile to a target
  // start. Not a toggle (cf. legacy isPinned flip): the start changes,
  // so the engine resolves slide-to-nearest on the next replan and
  // every successor is re-chained.
  | Extract<keyof typeof pinApi.endpoints, 'pinAtTime'>
  // Operator incident — station exception blocks a time window on the
  // machine, engine must replan around the blocked slot.
  | Extract<keyof typeof stationApi.endpoints, 'addStationException'>
  // Operator incident — absence blocks the operator's availability
  // window, engine must reassign or defer affected tasks.
  | Extract<keyof typeof operatorApi.endpoints, 'addOperatorAbsence'>
  // Acompte lifecycle — replace/delete acomptes changes the engine fan-out,
  // and a new progress declaration cascades into per-acompte recordedProgressPct.
  | Extract<keyof typeof acompteApi.endpoints,
      'replaceAcomptes' | 'deleteAcomptes' | 'writeAcompteProgressDeclaration'>;

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
const ENDPOINT_LABELS: Record<AutoRecomputeEndpointName, string> = {
  createOperator: 'Ajout opérateur',
  updateOperator: 'Modification opérateur',
  deleteOperator: 'Suppression opérateur',
  restoreOperator: 'Restauration opérateur',
  replaceSkills: 'Modification compétences',
  replaceConcurrentGroups: 'Modification groupes concurrents',
  createStation: 'Ajout station',
  updateStation: 'Modification station',
  deleteStation: 'Suppression station',
  createStationCategory: 'Ajout catégorie station',
  updateStationCategory: 'Modification catégorie station',
  deleteStationCategory: 'Suppression catégorie station',
  createProvider: 'Ajout sous-traitant',
  updateProvider: 'Modification sous-traitant',
  deleteProvider: 'Suppression sous-traitant',
  updateElementPrerequisite: 'Changement prérequis élément',
  updateElementSequence: 'Modification séquence',
  updatePaperLeadTime: 'Modification délai papier',
  updateFormeLeadTime: 'Modification délai forme',
  updatePlateLeadTime: 'Modification délai plaque',
  reportSaisie: 'Saisie d\'avancement',
  pinAtTime: 'Épinglage de tâche',
  addStationException: 'Incident station',
  addOperatorAbsence: 'Absence opérateur',
  replaceAcomptes: 'Modification acomptes',
  deleteAcomptes: 'Suppression acomptes',
  writeAcompteProgressDeclaration: 'Déclaration avancement acompte',
  recordProgressDirect: 'Marquage avancement',
};

const AUTO_RECOMPUTE_ENDPOINTS: ReadonlySet<AutoRecomputeEndpointName> = new Set<AutoRecomputeEndpointName>([
  'createOperator',
  'updateOperator',
  'deleteOperator',
  'restoreOperator',
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
  'updateElementSequence',
  'updatePaperLeadTime',
  'updateFormeLeadTime',
  'updatePlateLeadTime',
  'reportSaisie',
  'pinAtTime',
  'addStationException',
  'addOperatorAbsence',
  'replaceAcomptes',
  'deleteAcomptes',
  'writeAcompteProgressDeclaration',
  'recordProgressDirect',
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
      registeredTrigger?.(ENDPOINT_LABELS[endpointName as AutoRecomputeEndpointName] ?? endpointName);
    }
  }

  return result;
};

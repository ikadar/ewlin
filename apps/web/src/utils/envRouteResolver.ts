import type { ScenarioMode } from '../contexts/ScenarioContext';

interface RouteTwin {
  match: RegExp;
  destination: Record<ScenarioMode, string>;
}

/**
 * Twin pages between Préprod and Prod.
 *
 * Each entry maps a forbidden path (regex) to the equivalent screen
 * available in each env. When the active env doesn't permit the
 * current path, the user lands on the path's twin instead of the
 * homepage — preserving the conceptual workspace they were in.
 *
 * Add a new entry here when introducing another env-exclusive screen.
 */
const ROUTE_TWINS: RouteTwin[] = [
  { match: /^\/logistique/, destination: { preprod: '/scenarios', prod: '/logistique' } },
  { match: /^\/scenarios/, destination: { preprod: '/scenarios', prod: '/logistique' } },
  { match: /^\/prerequis/, destination: { preprod: '/scenarios', prod: '/prerequis' } },
  { match: /^\/rapport-production/, destination: { preprod: '/scenarios', prod: '/rapport-production' } },
];

/**
 * Resolves where the user should land for a given (path, target env) pair.
 * Twin paths jump to their counterpart; any other path stays the same.
 */
export function resolveEnvSwitchDestination(
  currentPath: string,
  target: ScenarioMode,
): string {
  const twin = ROUTE_TWINS.find((t) => t.match.test(currentPath));
  return twin ? twin.destination[target] : currentPath;
}

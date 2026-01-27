/**
 * Merge session-learned suggestions with base suggestions.
 *
 * Session items appear first (priority), followed by base items
 * that don't exist in the session set. Deduplication uses a
 * case-insensitive key extracted via `getKey`.
 */
export function mergeWithSession<T>(
  baseSuggestions: T[],
  sessionSuggestions: T[],
  getKey: (item: T) => string,
): T[] {
  if (sessionSuggestions.length === 0) return baseSuggestions;
  if (baseSuggestions.length === 0) return sessionSuggestions;

  const sessionKeys = new Set(
    sessionSuggestions.map((item) => getKey(item).toLowerCase()),
  );

  const baseOnly = baseSuggestions.filter(
    (item) => !sessionKeys.has(getKey(item).toLowerCase()),
  );

  return [...sessionSuggestions, ...baseOnly];
}

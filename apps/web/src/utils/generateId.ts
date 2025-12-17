/**
 * Generate a unique identifier for assignments.
 * Uses crypto.randomUUID() for proper UUID generation.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

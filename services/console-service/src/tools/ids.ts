/**
 * Shared ID validation helper for tool inputs.
 *
 * The LLM is instructed to ALWAYS resolve human references (a job
 * number like "5003", a first name like "Frédéric") into UUIDs via
 * the resolve_* tools before passing them to action tools. Models
 * still occasionally skip that step and pass the human reference
 * directly. We catch that here at zod validation time so the action
 * tool fails fast with a clear, LLM-readable error message instead
 * of bothering the PHP API with a 404.
 *
 * The error string deliberately names the corresponding resolve_*
 * tool so the model self-corrects on the next turn.
 */
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/**
 * Build a zod string schema that requires a UUID and emits a French
 * error message pointing the LLM at the right resolver tool.
 */
export function uuidField(resolverName: string): z.ZodString {
  return z
    .string()
    .min(1)
    .regex(
      UUID_RE,
      `Doit être un UUID complet (format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) obtenu en appelant ${resolverName} d'abord. JAMAIS le numéro/nom humain donné par l'utilisateur.`,
    );
}

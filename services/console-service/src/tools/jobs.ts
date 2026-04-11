/**
 * Job-level tools (deadline shifting, eventually metadata edits).
 *
 * Domain note (very important):
 *   - "deadline" / "date de sortie" / "date départ atelier" → workshopExitDate
 *   - "deadline BAT" / "date BAT" / "BAT"                  → batDeadline
 * The user defaults to the workshop-exit date when they say plain "deadline".
 * The BAT deadline is a separate, earlier date specific to print proofs.
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { isIsoDate, shiftDateByDays } from './dates.js';
import { uuidField } from './ids.js';

interface JobRow {
  id: string;
  reference?: string | null;
  workshopExitDate?: string | null;
  batDeadline?: string | null;
}

export const updateJobDeadlineTool: ToolDefinition = {
  name: 'update_job_deadline',
  description:
    "Modifie la deadline d'un job (par défaut la 'workshopExitDate' = date de sortie d'atelier, ce que l'utilisateur appelle simplement « la deadline » ou « la date de sortie »). Pour cibler la deadline du Bon À Tirer, passe field='bat'. Deux modes : 'absolute' (newDeadline en YYYY-MM-DD) ou 'relative' (shiftDays positif=repousser, négatif=avancer). Toujours résoudre le job avec resolve_job d'abord.",
  inputSchema: z.object({
    jobId: uuidField('resolve_job').describe(
      "UUID du job au format complet xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx, OBTENU EN APPELANT resolve_job(reference=...) D'ABORD. Ce n'est PAS le numéro de référence visible par l'utilisateur (ex 35202, 5003).",
    ),
    jobLabel: z.string().min(1).describe("Référence ou nom lisible du job pour le preview."),
    field: z
      .enum(['exit', 'bat'])
      .optional()
      .default('exit')
      .describe(
        "Quel champ modifier : 'exit' (défaut) = workshopExitDate (la 'deadline' usuelle), 'bat' = batDeadline (la deadline du Bon À Tirer). Utilise 'bat' UNIQUEMENT si l'utilisateur a dit explicitement « BAT ».",
      ),
    newDeadline: z
      .string()
      .optional()
      .describe("Nouvelle deadline absolue YYYY-MM-DD. À utiliser OU shiftDays, pas les deux."),
    shiftDays: z
      .number()
      .int()
      .optional()
      .describe(
        "Décalage relatif en jours par rapport à la deadline actuelle. Positif = repousser dans le futur (ex 4 = +4 jours).",
      ),
  }),
  handler: async (input, ctx) => {
    if ((input.newDeadline === undefined) === (input.shiftDays === undefined)) {
      return {
        ok: false,
        error: 'Provide exactly one of newDeadline (absolute) or shiftDays (relative).',
      };
    }

    const fieldKey = input.field === 'bat' ? 'batDeadline' : 'workshopExitDate';
    const fieldHumanFr = input.field === 'bat' ? 'deadline BAT' : 'deadline (sortie atelier)';

    let target: string;
    let oldDeadline: string | null = null;
    if (input.newDeadline) {
      if (!isIsoDate(input.newDeadline)) {
        return { ok: false, error: 'newDeadline must be YYYY-MM-DD' };
      }
      target = input.newDeadline;
    } else {
      // Need to fetch current deadline to compute the shift target
      const job = await ctx.php.get<JobRow>(`/api/v1/jobs/${input.jobId}`);
      const current = job[fieldKey];
      if (!current) {
        return {
          ok: false,
          error: `Job has no current ${fieldKey}; use newDeadline (absolute) instead.`,
        };
      }
      oldDeadline = current.slice(0, 10);
      target = shiftDateByDays(oldDeadline, input.shiftDays!);
    }
    const preview = oldDeadline
      ? `${fieldHumanFr} du job ${input.jobLabel} : ${oldDeadline} → ${target} (${input.shiftDays! > 0 ? '+' : ''}${input.shiftDays} jours)`
      : `${fieldHumanFr} du job ${input.jobLabel} fixée au ${target}`;
    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: { dryRun: true, jobId: input.jobId, field: fieldKey, target, oldDeadline },
      };
    }
    // PHP API accepts YYYY-MM-DD or YYYY-MM-DDTHH:mm — NOT with seconds.
    const updated = await ctx.php.put<JobRow>(`/api/v1/jobs/${input.jobId}`, {
      [fieldKey]: `${target}T17:00`,
    });
    return { ok: true, preview, data: { job: updated } };
  },
};

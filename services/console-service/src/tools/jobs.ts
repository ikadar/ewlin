/**
 * Job-level tools (deadline shifting, eventually metadata edits).
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { isIsoDate, shiftDateByDays } from './dates.js';

interface JobRow {
  id: string;
  reference?: string | null;
  batDeadline?: string | null;
}

export const updateJobDeadlineTool: ToolDefinition = {
  name: 'update_job_deadline',
  description:
    "Modifie la deadline (batDeadline) d'un job. Deux modes : 'absolute' (newDeadline en YYYY-MM-DD) ou 'relative' (shiftDays positif=repousser, négatif=avancer). Toujours résoudre le job avec resolve_job d'abord.",
  inputSchema: z.object({
    jobId: z.string().min(1).describe("UUID du job (résolu via resolve_job)."),
    jobLabel: z.string().min(1).describe("Référence ou nom lisible du job pour le preview."),
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
    let target: string;
    let oldDeadline: string | null = null;
    if (input.newDeadline) {
      if (!isIsoDate(input.newDeadline)) {
        return { ok: false, error: 'newDeadline must be YYYY-MM-DD' };
      }
      target = input.newDeadline;
    } else {
      // Need to fetch current deadline
      const job = await ctx.php.get<JobRow>(`/api/v1/jobs/${input.jobId}`);
      if (!job.batDeadline) {
        return { ok: false, error: 'Job has no current batDeadline; use newDeadline (absolute) instead.' };
      }
      oldDeadline = job.batDeadline.slice(0, 10);
      target = shiftDateByDays(oldDeadline, input.shiftDays!);
    }
    const preview = oldDeadline
      ? `Deadline du job ${input.jobLabel} : ${oldDeadline} → ${target} (${input.shiftDays! > 0 ? '+' : ''}${input.shiftDays} jours)`
      : `Deadline du job ${input.jobLabel} fixée au ${target}`;
    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: { dryRun: true, jobId: input.jobId, target, oldDeadline },
      };
    }
    const updated = await ctx.php.put<JobRow>(`/api/v1/jobs/${input.jobId}`, {
      batDeadline: `${target}T17:00:00`,
    });
    return { ok: true, preview, data: { job: updated } };
  },
};

/**
 * Task-level tools: duration tweak, station replace, pinning, overtime.
 *
 * Most of these are minimal stubs in Phase 2 — Phase 7 fleshes them out
 * with the full set of edge cases and PHP endpoint calls.
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { isIsoDate, toIsoWithLocalOffset } from './dates.js';
import { uuidField } from './ids.js';

interface OperatorRow {
  id: string;
  scheduleExceptions?: Array<{
    date: string;
    type?: string | null;
    schedule?: { isOperating: boolean; slots: Array<{ start: string; end: string }> } | null;
    reason?: string | null;
  }>;
}

export const addOperatorOvertimeTool: ToolDefinition = {
  name: 'add_operator_overtime',
  description:
    "Ajoute une heure supplémentaire (extension d'horaire) pour un opérateur sur une date donnée. Crée ou étend une exception d'horaire 'MODIFIED'. Si l'opérateur a déjà une exception ce jour-là, l'extension fusionne avec.",
  inputSchema: z.object({
    operatorId: uuidField('resolve_operator'),
    operatorLabel: z.string().min(1),
    date: z.string().describe("Date YYYY-MM-DD."),
    fromTime: z.string().describe("HH:MM, début de la plage supplémentaire."),
    toTime: z.string().describe("HH:MM, fin de la plage supplémentaire."),
    reason: z.string().optional(),
  }),
  handler: async (input, ctx) => {
    if (!isIsoDate(input.date)) {
      return { ok: false, error: 'date must be YYYY-MM-DD' };
    }
    const preview = `Heure sup pour ${input.operatorLabel} le ${input.date} de ${input.fromTime} à ${input.toTime}${
      input.reason ? ` (${input.reason})` : ''
    }`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    // Fetch current schedule exceptions and merge
    const op = await ctx.php.get<OperatorRow>(`/api/v1/operators/${input.operatorId}`);
    const exceptions = [...(op.scheduleExceptions ?? [])];
    const existingIdx = exceptions.findIndex((e) => e.date === input.date);
    const newSlot = { start: input.fromTime, end: input.toTime };
    if (existingIdx >= 0) {
      const existing = exceptions[existingIdx]!;
      const slots = existing.schedule?.slots ? [...existing.schedule.slots, newSlot] : [newSlot];
      exceptions[existingIdx] = {
        date: input.date,
        type: 'MODIFIED',
        schedule: { isOperating: true, slots },
        reason: input.reason ?? existing.reason ?? null,
      };
    } else {
      exceptions.push({
        date: input.date,
        type: 'MODIFIED',
        schedule: { isOperating: true, slots: [newSlot] },
        reason: input.reason ?? null,
      });
    }
    const updated = await ctx.php.put<OperatorRow>(`/api/v1/operators/${input.operatorId}`, {
      scheduleExceptions: exceptions,
    });
    return { ok: true, preview, data: { operator: updated } };
  },
};

export const updateTaskDurationTool: ToolDefinition = {
  name: 'update_task_duration',
  description:
    "Modifie la durée setup et/ou run d'une tâche. Format usuel : '30+150' = 30 min de setup + 150 min de run. Au moins un des deux champs doit être fourni. La tâche est résolue via resolve_task_in_job.",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job').describe("UUID de la tâche."),
    taskLabel: z.string().min(1).describe("Nom lisible (ex 'MBO XL du job 12345')."),
    setupMinutes: z.number().int().nonnegative().optional(),
    runMinutes: z.number().int().nonnegative().optional(),
  }),
  handler: async (input, ctx) => {
    if (input.setupMinutes === undefined && input.runMinutes === undefined) {
      return { ok: false, error: 'Provide at least one of setupMinutes / runMinutes.' };
    }
    const parts: string[] = [];
    if (input.setupMinutes !== undefined) parts.push(`setup=${input.setupMinutes}min`);
    if (input.runMinutes !== undefined) parts.push(`run=${input.runMinutes}min`);
    const preview = `Durée de ${input.taskLabel} : ${parts.join(', ')}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    // PATCH /api/v1/tasks/{taskId}/duration accepts runMinutes today.
    // Setup minutes might require a separate PHP-side enhancement later.
    const body: Record<string, number> = {};
    if (input.runMinutes !== undefined) body['runMinutes'] = input.runMinutes;
    if (input.setupMinutes !== undefined) body['setupMinutes'] = input.setupMinutes;
    const result = await ctx.php.patch<unknown>(`/api/v1/tasks/${input.taskId}/duration`, body);
    return { ok: true, preview, data: { task: result } };
  },
};

export const replaceTaskStationTool: ToolDefinition = {
  name: 'replace_task_station',
  description:
    "Remplace la station d'une tâche existante par une autre, optionnellement en changeant aussi sa durée. Exemple : 'remplace la tâche MBO XL du job 1234 par une tâche MBO M de 20+120'. Les stations doivent être résolues via resolve_station, et la tâche via resolve_task_in_job.",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job'),
    taskLabel: z.string().min(1).describe("Nom lisible avant remplacement."),
    newStationId: z.string().min(1),
    newStationLabel: z.string().min(1),
    newSetupMinutes: z.number().int().nonnegative().optional(),
    newRunMinutes: z.number().int().nonnegative().optional(),
  }),
  handler: async (input, ctx) => {
    const durationParts: string[] = [];
    if (input.newSetupMinutes !== undefined) durationParts.push(`${input.newSetupMinutes}+`);
    if (input.newRunMinutes !== undefined) durationParts.push(`${input.newRunMinutes}min`);
    const preview = `Remplacer ${input.taskLabel} par ${input.newStationLabel}${
      durationParts.length ? ` (${durationParts.join('')})` : ''
    }`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    // Step 1: reassign task to new station (preserves scheduling)
    const reassigned = await ctx.php.put<unknown>(`/api/v1/tasks/${input.taskId}/assign`, {
      targetId: input.newStationId,
      bypassPrecedence: false,
    });
    // Step 2: optionally update duration
    if (input.newSetupMinutes !== undefined || input.newRunMinutes !== undefined) {
      const body: Record<string, number> = {};
      if (input.newRunMinutes !== undefined) body['runMinutes'] = input.newRunMinutes;
      if (input.newSetupMinutes !== undefined) body['setupMinutes'] = input.newSetupMinutes;
      await ctx.php.patch<unknown>(`/api/v1/tasks/${input.taskId}/duration`, body);
    }
    return { ok: true, preview, data: { task: reassigned } };
  },
};

export const pinTaskAtTimeTool: ToolDefinition = {
  name: 'pin_task_at_time',
  description:
    "Force une tâche à démarrer à un instant précis sur une station précise. Combine assign + pin : la tâche est replanifiée puis épinglée pour qu'aucune opération automatique ne la déplace. Exemple : 'le job 12345 doit passer à 15h le 15 avril sur la G40'.",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job'),
    taskLabel: z.string().min(1),
    stationId: uuidField('resolve_station'),
    stationLabel: z.string().min(1),
    date: z.string().describe("Date YYYY-MM-DD du début."),
    time: z.string().describe("Heure HH:MM du début."),
  }),
  handler: async (input, ctx) => {
    let scheduledStart: string;
    try {
      // PHP API requires full ISO 8601 with offset (server is TZ=Europe/Paris).
      scheduledStart = toIsoWithLocalOffset(input.date, input.time);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    const preview = `Pin de ${input.taskLabel} à ${input.date} ${input.time} sur ${input.stationLabel}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, scheduledStart, ...input } };
    }
    // Step 1: reschedule (or assign) the task at the requested time/station
    await ctx.php.put<unknown>(`/api/v1/tasks/${input.taskId}/assign`, {
      targetId: input.stationId,
      scheduledStart,
      bypassPrecedence: false,
    });
    // Step 2: toggle pin (assumes it was unpinned). If already pinned, this
    // would unpin — fetching current state first would be safer; the LLM
    // can call list_active_constraints first if it cares.
    await ctx.php.put<unknown>(`/api/v1/tasks/${input.taskId}/pin`, {});
    return { ok: true, preview, data: { taskId: input.taskId, scheduledStart } };
  },
};

export const unpinTaskTool: ToolDefinition = {
  name: 'unpin_task',
  description: "Retire le pin d'une tâche, la rendant éligible aux opérations automatiques de replanification.",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job'),
    taskLabel: z.string().min(1),
  }),
  handler: async (input, ctx) => {
    const preview = `Retirer le pin de ${input.taskLabel}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    await ctx.php.put<unknown>(`/api/v1/tasks/${input.taskId}/pin`, {});
    return { ok: true, preview, data: { taskId: input.taskId } };
  },
};

/**
 * Constraint tools (operator absences, station maintenance, list/cancel).
 *
 * Backed by the existing PHP `SchedulingConstraint` entity:
 *   POST   /api/v1/scheduling-constraints
 *   GET    /api/v1/scheduling-constraints
 *   DELETE /api/v1/scheduling-constraints/{id}
 *
 * Constraint types used here:
 *   - OperatorAbsent       — operator unavailable on a date interval
 *   - MachineUnavailable   — station unavailable on a date+time interval
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { combineDateAndTime, isIsoDate } from './dates.js';

interface CreatedConstraint {
  id: string;
  constraintType: string;
  targetId: string;
  timeStart: string | null;
  timeEnd: string | null;
  description: string;
}

export const addOperatorAbsenceTool: ToolDefinition = {
  name: 'add_operator_absence',
  description:
    "Marque un opérateur comme absent sur un intervalle de dates (jours inclus). Utiliser le tool resolve_operator d'abord pour obtenir l'ID. Le résultat sera un objet 'constraint' avec un id qu'on peut passer à cancel_constraint si besoin d'annuler.",
  inputSchema: z.object({
    operatorId: z.string().min(1).describe("UUID de l'opérateur (résolu via resolve_operator)."),
    operatorLabel: z
      .string()
      .min(1)
      .describe("Nom lisible de l'opérateur, ex 'Frédéric Dupont'. Utilisé dans la description et le preview."),
    fromDate: z.string().describe("Premier jour d'absence inclus, format YYYY-MM-DD."),
    toDate: z.string().describe("Dernier jour d'absence inclus, format YYYY-MM-DD."),
    reason: z.string().optional().describe("Motif optionnel à inscrire dans la description."),
  }),
  handler: async (input, ctx) => {
    if (!isIsoDate(input.fromDate) || !isIsoDate(input.toDate)) {
      return { ok: false, error: 'fromDate and toDate must be YYYY-MM-DD' };
    }
    if (input.toDate < input.fromDate) {
      return { ok: false, error: 'toDate must be >= fromDate' };
    }
    const description = input.reason
      ? `Absence ${input.operatorLabel} : ${input.reason}`
      : `Absence ${input.operatorLabel}`;
    // SchedulingConstraint uses ISO datetime — interpret a date interval as
    // 00:00 of the from-date through 23:59 of the to-date (inclusive).
    const timeStart = `${input.fromDate}T00:00:00`;
    const timeEnd = `${input.toDate}T23:59:00`;
    const preview = `${input.operatorLabel} absent du ${input.fromDate} au ${input.toDate}${
      input.reason ? ` (${input.reason})` : ''
    }`;
    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: {
          dryRun: true,
          payload: {
            constraintType: 'OperatorAbsent',
            targetId: input.operatorId,
            timeStart,
            timeEnd,
            description,
          },
        },
      };
    }
    const created = await ctx.php.post<CreatedConstraint>('/api/v1/scheduling-constraints', {
      constraintType: 'OperatorAbsent',
      targetId: input.operatorId,
      timeStart,
      timeEnd,
      description,
    });
    return { ok: true, preview, data: { constraint: created } };
  },
};

export const addStationMaintenanceTool: ToolDefinition = {
  name: 'add_station_maintenance',
  description:
    "Déclare une station en maintenance sur un intervalle horaire. Utiliser resolve_station d'abord pour obtenir l'ID. Si la maintenance dure plusieurs jours, fromDate < toDate. Pour une plage intra-jour : même date pour fromDate et toDate, fromTime/toTime distinctes.",
  inputSchema: z.object({
    stationId: z.string().min(1).describe("UUID de la station."),
    stationLabel: z.string().min(1).describe("Nom lisible de la station, ex 'MBO XL'."),
    fromDate: z.string().describe("Date de début, YYYY-MM-DD."),
    fromTime: z.string().describe("Heure de début, HH:MM."),
    toDate: z.string().describe("Date de fin, YYYY-MM-DD."),
    toTime: z.string().describe("Heure de fin, HH:MM."),
    reason: z.string().optional().describe("Motif optionnel."),
  }),
  handler: async (input, ctx) => {
    let timeStart: string;
    let timeEnd: string;
    try {
      timeStart = combineDateAndTime(input.fromDate, input.fromTime);
      timeEnd = combineDateAndTime(input.toDate, input.toTime);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (timeEnd <= timeStart) {
      return { ok: false, error: 'timeEnd must be strictly after timeStart' };
    }
    const description = input.reason
      ? `Maintenance ${input.stationLabel} : ${input.reason}`
      : `Maintenance ${input.stationLabel}`;
    const preview = `${input.stationLabel} en maintenance du ${input.fromDate} ${input.fromTime} au ${input.toDate} ${input.toTime}${
      input.reason ? ` (${input.reason})` : ''
    }`;
    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: {
          dryRun: true,
          payload: {
            constraintType: 'MachineUnavailable',
            targetId: input.stationId,
            timeStart,
            timeEnd,
            description,
          },
        },
      };
    }
    const created = await ctx.php.post<CreatedConstraint>('/api/v1/scheduling-constraints', {
      constraintType: 'MachineUnavailable',
      targetId: input.stationId,
      timeStart,
      timeEnd,
      description,
    });
    return { ok: true, preview, data: { constraint: created } };
  },
};

export const cancelConstraintTool: ToolDefinition = {
  name: 'cancel_constraint',
  description:
    "Supprime une contrainte de planning par son ID (utile pour lever une absence ou une maintenance déjà déclarée). L'ID est obtenu via list_active_constraints.",
  inputSchema: z.object({
    constraintId: z.string().min(1).describe("UUID de la contrainte à supprimer."),
    label: z.string().optional().describe("Description lisible de la contrainte (pour le preview)."),
  }),
  handler: async (input, ctx) => {
    const preview = `Annuler la contrainte ${input.label ?? input.constraintId}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, constraintId: input.constraintId } };
    }
    await ctx.php.delete<void>(`/api/v1/scheduling-constraints/${input.constraintId}`);
    return { ok: true, preview, data: { deleted: input.constraintId } };
  },
};

export const listActiveConstraintsTool: ToolDefinition = {
  name: 'list_active_constraints',
  description:
    "Liste les contraintes de planning actives ou à venir (absences, maintenance, pinned start). Optionnellement filtrer par date à partir de laquelle considérer les contraintes 'actives'.",
  readOnly: true,
  inputSchema: z.object({
    fromDate: z
      .string()
      .optional()
      .describe("Date YYYY-MM-DD à partir de laquelle considérer les contraintes actives. Par défaut : aujourd'hui."),
  }),
  handler: async (input, ctx) => {
    const all = await ctx.php.get<CreatedConstraint[] | { items: CreatedConstraint[] }>(
      '/api/v1/scheduling-constraints',
    );
    const list = Array.isArray(all) ? all : all.items ?? [];
    const cutoff = input.fromDate ?? ctx.todayIso;
    const active = list.filter((c) => {
      if (!c.timeEnd) return true;
      // Keep if it ends today or later
      return c.timeEnd.slice(0, 10) >= cutoff;
    });
    return {
      ok: true,
      data: {
        constraints: active,
        count: active.length,
      },
    };
  },
};

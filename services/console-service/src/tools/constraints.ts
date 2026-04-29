/**
 * Scheduling directive tools — operator absences + station maintenance.
 *
 * Both concepts have the same shape now (ADR-017): a period
 * `{startAt, endAt, reason}` written directly on the domain entity.
 *
 *   - Operator absence    →  PUT /api/v1/operators/{id} (absences array)
 *   - Station maintenance →  PUT /api/v1/stations/{id}  (scheduleExceptions array)
 *
 * Both endpoints replace the full array on write, so we read first,
 * append or remove, then write the new full list. Matches how the
 * admin Settings UI already operates (OperatorsPage, StationsPage).
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { combineDateAndTime, isIsoDate } from './dates.js';
import { uuidField } from './ids.js';

interface AbsenceLike {
  startAt: string;
  endAt: string;
  reason?: string | null;
}

interface OperatorResponse {
  id: string;
  firstName: string;
  lastName: string;
  absences?: AbsenceLike[] | null;
  overtimes?: AbsenceLike[] | null;
  [key: string]: unknown;
}

interface StationResponse {
  id: string;
  name: string;
  scheduleExceptions?: AbsenceLike[] | null;
  [key: string]: unknown;
}

// Stable composite ids so list_active_constraints / cancel_constraint
// can round-trip between listing and deletion without a real DB id.
// Separator must not appear in UUIDs or ISO datetimes — `|` satisfies both,
// where `:` would not (datetimes embed it).
function operatorAbsenceKey(operatorId: string, absence: AbsenceLike): string {
  return `op|${operatorId}|${absence.startAt}|${absence.endAt}`;
}

function operatorOvertimeKey(operatorId: string, overtime: AbsenceLike): string {
  return `ot|${operatorId}|${overtime.startAt}|${overtime.endAt}`;
}

function stationExceptionKey(stationId: string, exception: AbsenceLike): string {
  return `st|${stationId}|${exception.startAt}|${exception.endAt}`;
}

export const addOperatorAbsenceTool: ToolDefinition = {
  name: 'add_operator_absence',
  description:
    "Marque un opérateur comme absent sur une période. Pour une journée entière, passer fromDate = toDate et laisser startTime/endTime vides. Pour une plage horaire (ex: rendez-vous médical 14h-16h), passer fromDate = toDate avec startTime et endTime. Utiliser resolve_operator d'abord pour obtenir l'ID. Voie canonique: Operator.absences.",
  inputSchema: z.object({
    operatorId: uuidField('resolve_operator').describe(
      "UUID de l'opérateur, OBTENU EN APPELANT resolve_operator(name=...) D'ABORD.",
    ),
    operatorLabel: z
      .string()
      .min(1)
      .describe("Nom lisible de l'opérateur, ex 'Frédéric Dupont'."),
    fromDate: z.string().describe("Premier jour d'absence inclus, YYYY-MM-DD."),
    toDate: z.string().describe("Dernier jour d'absence inclus, YYYY-MM-DD."),
    startTime: z
      .string()
      .optional()
      .describe("Heure HH:MM à laquelle commence l'absence le premier jour. Défaut: 00:00."),
    endTime: z
      .string()
      .optional()
      .describe("Heure HH:MM à laquelle finit l'absence le dernier jour. Défaut: 23:59."),
    reason: z
      .string()
      .min(3)
      .describe(
        "Motif requis (ex 'Visite médicale', 'Congé'). Si l'utilisateur ne précise pas, demande-lui via ask_user.",
      ),
  }),
  handler: async (input, ctx) => {
    if (!isIsoDate(input.fromDate) || !isIsoDate(input.toDate)) {
      return { ok: false, error: 'fromDate and toDate must be YYYY-MM-DD' };
    }
    if (input.toDate < input.fromDate) {
      return { ok: false, error: 'toDate must be >= fromDate' };
    }
    const startTime = input.startTime ?? '00:00';
    const endTime = input.endTime ?? '23:59';
    const startAt = combineDateAndTime(input.fromDate, startTime);
    const endAt = combineDateAndTime(input.toDate, endTime);
    const reasonText = input.reason;

    const newAbsence: AbsenceLike = { startAt, endAt, reason: reasonText };

    const hasExplicitTime = input.startTime !== undefined || input.endTime !== undefined;
    const rangeLabel = hasExplicitTime
      ? input.fromDate === input.toDate
        ? `le ${input.fromDate} ${startTime}–${endTime}`
        : `du ${input.fromDate} ${startTime} au ${input.toDate} ${endTime}`
      : input.fromDate === input.toDate
      ? `le ${input.fromDate}`
      : `du ${input.fromDate} au ${input.toDate}`;
    const preview = `${input.operatorLabel} absent ${rangeLabel}${
      reasonText ? ` (${reasonText})` : ''
    }`;

    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: { dryRun: true, operatorId: input.operatorId, absence: newAbsence },
      };
    }

    const current = await ctx.php.get<OperatorResponse>(
      `/api/v1/operators/${input.operatorId}`,
    );
    const absences = [...(current.absences ?? []), newAbsence];
    const updated = await ctx.php.put<OperatorResponse>(
      `/api/v1/operators/${input.operatorId}`,
      { absences },
    );
    return {
      ok: true,
      preview,
      data: {
        absence: {
          id: operatorAbsenceKey(input.operatorId, newAbsence),
          operatorId: input.operatorId,
          startAt,
          endAt,
          reason: reasonText,
        },
        operator: updated,
      },
    };
  },
};

export const addStationMaintenanceTool: ToolDefinition = {
  name: 'add_station_maintenance',
  description:
    "Déclare une indisponibilité de station sur une période (maintenance, panne, nettoyage). Pour une journée entière, passer fromDate = toDate et laisser startTime/endTime vides.",
  inputSchema: z.object({
    stationId: uuidField('resolve_station').describe(
      "UUID de la station, OBTENU EN APPELANT resolve_station(name=...) D'ABORD.",
    ),
    stationLabel: z.string().min(1).describe("Nom lisible de la station, ex 'MBO XL'."),
    fromDate: z.string().describe("Premier jour indisponible inclus, YYYY-MM-DD."),
    toDate: z.string().describe("Dernier jour indisponible inclus, YYYY-MM-DD."),
    startTime: z
      .string()
      .optional()
      .describe("Heure HH:MM à laquelle commence l'indispo le premier jour. Défaut: 00:00."),
    endTime: z
      .string()
      .optional()
      .describe("Heure HH:MM à laquelle finit l'indispo le dernier jour. Défaut: 23:59."),
    reason: z.string().optional().describe('Motif optionnel.'),
  }),
  handler: async (input, ctx) => {
    if (!isIsoDate(input.fromDate) || !isIsoDate(input.toDate)) {
      return { ok: false, error: 'fromDate and toDate must be YYYY-MM-DD' };
    }
    if (input.toDate < input.fromDate) {
      return { ok: false, error: 'toDate must be >= fromDate' };
    }
    const startTime = input.startTime ?? '00:00';
    const endTime = input.endTime ?? '23:59';
    const startAt = combineDateAndTime(input.fromDate, startTime);
    const endAt = combineDateAndTime(input.toDate, endTime);
    const reasonText = input.reason ?? null;

    const exception: AbsenceLike = { startAt, endAt, reason: reasonText };

    const rangeLabel =
      input.fromDate === input.toDate
        ? `le ${input.fromDate} ${startTime}–${endTime}`
        : `du ${input.fromDate} ${startTime} au ${input.toDate} ${endTime}`;
    const preview = `${input.stationLabel} indispo ${rangeLabel}${
      reasonText ? ` — ${reasonText}` : ''
    }`;

    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: { dryRun: true, stationId: input.stationId, exception },
      };
    }

    const current = await ctx.php.get<StationResponse>(
      `/api/v1/stations/${input.stationId}`,
    );
    const scheduleExceptions = [...(current.scheduleExceptions ?? []), exception];
    const updated = await ctx.php.put<StationResponse>(
      `/api/v1/stations/${input.stationId}`,
      { scheduleExceptions },
    );
    return {
      ok: true,
      preview,
      data: {
        exception: {
          id: stationExceptionKey(input.stationId, exception),
          stationId: input.stationId,
          ...exception,
        },
        station: updated,
      },
    };
  },
};

export const cancelConstraintTool: ToolDefinition = {
  name: 'cancel_constraint',
  description:
    "Supprime une absence d'opérateur, une heure sup d'opérateur, ou une indispo de station. L'ID est fourni par list_active_constraints (`op|{operatorId}|{startAt}|{endAt}` pour absence, `ot|{operatorId}|{startAt}|{endAt}` pour heure sup, `st|{stationId}|{startAt}|{endAt}` pour station).",
  inputSchema: z.object({
    constraintId: z
      .string()
      .min(1)
      .describe(
        'Identifiant composite retourné par list_active_constraints (`op|...`, `ot|...` ou `st|...`).',
      ),
    label: z.string().optional().describe("Description lisible pour le preview."),
  }),
  handler: async (input, ctx) => {
    const preview = `Annuler ${input.label ?? input.constraintId}`;
    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: { dryRun: true, constraintId: input.constraintId },
      };
    }

    const parts = input.constraintId.split('|');
    if (parts[0] === 'op' && parts.length === 4) {
      const [, operatorId, startAt, endAt] = parts;
      const current = await ctx.php.get<OperatorResponse>(
        `/api/v1/operators/${operatorId}`,
      );
      const absences = (current.absences ?? []).filter(
        (a) => a.startAt !== startAt || a.endAt !== endAt,
      );
      await ctx.php.put(`/api/v1/operators/${operatorId}`, { absences });
      return {
        ok: true,
        preview,
        data: { deleted: input.constraintId, kind: 'operator-absence' },
      };
    }
    if (parts[0] === 'ot' && parts.length === 4) {
      const [, operatorId, startAt, endAt] = parts;
      const current = await ctx.php.get<OperatorResponse>(
        `/api/v1/operators/${operatorId}`,
      );
      const overtimes = (current.overtimes ?? []).filter(
        (o) => o.startAt !== startAt || o.endAt !== endAt,
      );
      await ctx.php.put(`/api/v1/operators/${operatorId}`, { overtimes });
      return {
        ok: true,
        preview,
        data: { deleted: input.constraintId, kind: 'operator-overtime' },
      };
    }
    if (parts[0] === 'st' && parts.length === 4) {
      const [, stationId, startAt, endAt] = parts;
      const current = await ctx.php.get<StationResponse>(
        `/api/v1/stations/${stationId}`,
      );
      const scheduleExceptions = (current.scheduleExceptions ?? []).filter(
        (e) => e.startAt !== startAt || e.endAt !== endAt,
      );
      await ctx.php.put(`/api/v1/stations/${stationId}`, { scheduleExceptions });
      return {
        ok: true,
        preview,
        data: { deleted: input.constraintId, kind: 'station-exception' },
      };
    }
    return {
      ok: false,
      error: `Unrecognised constraint id format: ${input.constraintId}`,
    };
  },
};

export const listActiveConstraintsTool: ToolDefinition = {
  name: 'list_active_constraints',
  description:
    "Liste les directives qui modifient la disponibilité opérateur/station, actives ou à venir : absences opérateur, heures sup opérateur, indispos station. Filtrer par date optionnelle. Agrège Operator.absences + Operator.overtimes + Station.scheduleExceptions (même shape de plage temporelle).",
  readOnly: true,
  inputSchema: z.object({
    fromDate: z
      .string()
      .optional()
      .describe("Date YYYY-MM-DD à partir de laquelle considérer actif. Défaut: aujourd'hui."),
  }),
  handler: async (input, ctx) => {
    const cutoff = input.fromDate ?? ctx.todayIso;

    const [operatorsRaw, stationsRaw] = await Promise.all([
      ctx.php.get<OperatorResponse[] | { items: OperatorResponse[] }>('/api/v1/operators'),
      ctx.php.get<StationResponse[] | { items: StationResponse[] }>('/api/v1/stations'),
    ]);
    const operators = Array.isArray(operatorsRaw) ? operatorsRaw : operatorsRaw.items ?? [];
    const stations = Array.isArray(stationsRaw) ? stationsRaw : stationsRaw.items ?? [];

    const entries: Array<{
      id: string;
      kind: 'operator-absence' | 'operator-overtime' | 'station-exception';
      targetId: string;
      targetLabel: string;
      startDate: string;
      endDate: string;
      description: string | null;
    }> = [];

    for (const op of operators) {
      for (const abs of op.absences ?? []) {
        const endDate = abs.endAt.slice(0, 10);
        if (endDate < cutoff) continue;
        entries.push({
          id: operatorAbsenceKey(op.id, abs),
          kind: 'operator-absence',
          targetId: op.id,
          targetLabel: `${op.firstName} ${op.lastName}`,
          startDate: abs.startAt.slice(0, 10),
          endDate,
          description: abs.reason ?? null,
        });
      }
      for (const ot of op.overtimes ?? []) {
        const endDate = ot.endAt.slice(0, 10);
        if (endDate < cutoff) continue;
        entries.push({
          id: operatorOvertimeKey(op.id, ot),
          kind: 'operator-overtime',
          targetId: op.id,
          targetLabel: `${op.firstName} ${op.lastName}`,
          startDate: ot.startAt.slice(0, 10),
          endDate,
          description: ot.reason ?? null,
        });
      }
    }

    for (const st of stations) {
      for (const exc of st.scheduleExceptions ?? []) {
        const endDate = exc.endAt.slice(0, 10);
        if (endDate < cutoff) continue;
        entries.push({
          id: stationExceptionKey(st.id, exc),
          kind: 'station-exception',
          targetId: st.id,
          targetLabel: st.name,
          startDate: exc.startAt.slice(0, 10),
          endDate,
          description: exc.reason ?? null,
        });
      }
    }

    return {
      ok: true,
      data: {
        constraints: entries,
        count: entries.length,
      },
    };
  },
};
